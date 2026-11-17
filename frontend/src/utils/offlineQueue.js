/**
 * Store-and-forward queue for actions taken with no / low data.
 * Syncs when the browser comes back online.
 */
const QUEUE_KEY = "cw_offline_queue_v1";

function readQueue() {
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeQueue(list) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // Quota — drop oldest.
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-20)));
    } catch {
      /* ignore */
    }
  }
}

export function getOfflineQueue() {
  return readQueue();
}

export function offlineQueueCount() {
  return readQueue().length;
}

export function enqueueOfflineAction(action) {
  const entry = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...action,
  };
  const next = [...readQueue(), entry];
  writeQueue(next);
  window.dispatchEvent(new CustomEvent("cw-offline-queue", { detail: { count: next.length } }));
  return entry;
}

export function removeOfflineAction(id) {
  const next = readQueue().filter((item) => item.id !== id);
  writeQueue(next);
  window.dispatchEvent(new CustomEvent("cw-offline-queue", { detail: { count: next.length } }));
  return next;
}

export async function flushOfflineQueue(handlers = {}) {
  const queue = readQueue();
  if (!queue.length) return { sent: 0, failed: 0, remaining: 0 };

  let sent = 0;
  let failed = 0;
  const remaining = [];

  for (const item of queue) {
    const handler = handlers[item.type];
    if (!handler) {
      remaining.push(item);
      continue;
    }
    try {
      await handler(item.payload, item);
      sent += 1;
    } catch {
      failed += 1;
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  window.dispatchEvent(
    new CustomEvent("cw-offline-queue", { detail: { count: remaining.length, sent, failed } })
  );
  return { sent, failed, remaining: remaining.length };
}
