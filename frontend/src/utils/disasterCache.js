const DISASTER_CACHE_KEY = "cw_live_disasters_v2";

function readFrom(store) {
  try {
    const list = JSON.parse(store.getItem(DISASTER_CACHE_KEY) || "[]");
    return Array.isArray(list) && list.length ? list : undefined;
  } catch {
    return undefined;
  }
}

/** Prefer localStorage (survives offline restarts), fall back to session. */
export function readCachedDisasters() {
  return readFrom(localStorage) || readFrom(sessionStorage);
}

export function writeCachedDisasters(list) {
  const payload = JSON.stringify((list || []).slice(0, 300));
  try {
    localStorage.setItem(DISASTER_CACHE_KEY, payload);
  } catch {
    /* ignore quota */
  }
  try {
    sessionStorage.setItem(DISASTER_CACHE_KEY, payload);
  } catch {
    /* ignore */
  }
}
