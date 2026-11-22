const KEY = "cw-tree-survival-offline-v1";

const QUEUE_META_KEYS = new Set([
  "queued_at",
  "last_error",
  "last_error_at",
  "attempts",
  "offline",
  "was_offline",
  "checkin_id",
]);

function readQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(KEY, JSON.stringify(items || []));
  try {
    window.dispatchEvent(
      new CustomEvent("cw-tree-survival-offline-queue", {
        detail: { count: (items || []).length },
      })
    );
  } catch {
    /* ignore */
  }
}

export function listTreeSurvivalOffline() {
  return readQueue();
}

export function enqueueTreeSurvivalOffline(payload) {
  const item = {
    ...payload,
    checkin_id: payload.checkin_id,
    client_uuid: payload.client_uuid || crypto.randomUUID(),
    queued_at: new Date().toISOString(),
    attempts: 0,
  };
  const next = [...readQueue(), item];
  writeQueue(next);
  return item;
}

export function removeTreeSurvivalOffline(clientUuid) {
  writeQueue(readQueue().filter((item) => item.client_uuid !== clientUuid));
}

export function clearTreeSurvivalOffline() {
  writeQueue([]);
}

export function isTreeSurvivalNetworkError(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const status = Number(err?.status || err?.response?.status || 0);
  if (status === 0 || status === 408 || status === 429 || status >= 500) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("offline") ||
    msg.includes("internet") ||
    msg.includes("timeout")
  );
}

function toPostBody(item) {
  const body = { ...item };
  for (const key of QUEUE_META_KEYS) delete body[key];
  body.was_offline = true;
  body.offline = true;
  return body;
}

function errorMessage(err) {
  const detail = err?.data?.detail || err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (detail && typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      /* fall through */
    }
  }
  return String(err?.message || "Sync failed").trim() || "Sync failed";
}

/**
 * Flush queued survival check-ins.
 * postFn(checkinId, body) should POST to the submit endpoint.
 */
export async function flushTreeSurvivalOffline(postFn) {
  const queue = readQueue();
  const remaining = [];
  const synced = [];
  const failed = [];

  for (const item of queue) {
    try {
      const result = await postFn(item.checkin_id, toPostBody(item));
      synced.push(result);
    } catch (err) {
      const message = errorMessage(err);
      if (isTreeSurvivalNetworkError(err)) {
        remaining.push({
          ...item,
          attempts: Number(item.attempts || 0) + 1,
          last_error: message,
          last_error_at: new Date().toISOString(),
        });
      } else {
        failed.push({ ...item, last_error: message });
      }
    }
  }

  writeQueue(remaining);
  return { synced, remaining, failed };
}
