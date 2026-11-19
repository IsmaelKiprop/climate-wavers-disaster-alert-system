const KEY = "cw-plastic-offline-queue-v1";

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
}

export function listPlasticOfflineProofs() {
  return readQueue();
}

export function enqueuePlasticOfflineProof(payload) {
  const item = {
    ...payload,
    client_uuid: payload.client_uuid || crypto.randomUUID(),
    queued_at: new Date().toISOString(),
  };
  const next = [...readQueue(), item];
  writeQueue(next);
  return item;
}

export function removePlasticOfflineProof(clientUuid) {
  writeQueue(readQueue().filter((item) => item.client_uuid !== clientUuid));
}

export async function flushPlasticOfflineProofs(postFn) {
  const queue = readQueue();
  const remaining = [];
  const synced = [];
  for (const item of queue) {
    try {
      const result = await postFn({ ...item, offline: true, was_offline: true });
      synced.push(result);
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return { synced, remaining };
}
