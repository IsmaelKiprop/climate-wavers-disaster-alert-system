const DISASTER_CACHE_KEY = "cw_live_disasters_v2";

export function readCachedDisasters() {
  try {
    const list = JSON.parse(sessionStorage.getItem(DISASTER_CACHE_KEY) || "[]");
    return Array.isArray(list) && list.length ? list : undefined;
  } catch {
    return undefined;
  }
}
