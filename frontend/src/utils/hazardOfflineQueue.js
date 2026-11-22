const KEY = "cw-hazard-corroboration-offline-v1";

const QUEUE_META_KEYS = new Set([
  "queued_at",
  "last_error",
  "last_error_at",
  "attempts",
  "offline",
  "was_offline",
  "disaster_id",
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
      new CustomEvent("cw-hazard-corroboration-offline-queue", {
        detail: { count: (items || []).length },
      })
    );
  } catch {
    /* ignore */
  }
}

export function listHazardCorroborationOffline() {
  return readQueue();
}

export function enqueueHazardCorroborationOffline(payload) {
  const item = {
    ...payload,
    disaster_id: payload.disaster_id,
    client_uuid: payload.client_uuid || crypto.randomUUID(),
    queued_at: new Date().toISOString(),
    attempts: 0,
  };
  const next = [...readQueue(), item];
  writeQueue(next);
  return item;
}

export function removeHazardCorroborationOffline(clientUuid) {
  writeQueue(readQueue().filter((item) => item.client_uuid !== clientUuid));
}

export function clearHazardCorroborationOffline() {
  writeQueue([]);
}

export function isHazardCorroborationNetworkError(err) {
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
  body.source_channel = "offline_sync";
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
 * Flush queued hazard corroborations.
 * postFn(disasterId, body) should POST to the corroborate endpoint.
 */
export async function flushHazardCorroborationOffline(postFn) {
  const queue = readQueue();
  const remaining = [];
  const synced = [];
  const failed = [];

  for (const item of queue) {
    try {
      const result = await postFn(item.disaster_id, toPostBody(item));
      synced.push(result);
    } catch (err) {
      const message = errorMessage(err);
      if (isHazardCorroborationNetworkError(err)) {
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
