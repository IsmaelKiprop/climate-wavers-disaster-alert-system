/**
 * Facebook-style feed cache: show the last loaded posts when offline.
 */
const PREFIX = "cw-feed-cache-v1:";
const MAX_PAGES = 8;

function keyFor(parts) {
  return PREFIX + parts.filter((p) => p != null && p !== "").join("|");
}

export function saveFeedCache(cacheKeyParts, pageData) {
  try {
    const key = keyFor(cacheKeyParts);
    const payload = {
      savedAt: new Date().toISOString(),
      page: pageData,
    };
    localStorage.setItem(key, JSON.stringify(payload));
    // Track keys for cleanup
    const indexKey = PREFIX + "__index";
    const index = JSON.parse(localStorage.getItem(indexKey) || "[]");
    const next = [key, ...index.filter((k) => k !== key)].slice(0, MAX_PAGES * 4);
    localStorage.setItem(indexKey, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

export function loadFeedCache(cacheKeyParts) {
  try {
    const raw = localStorage.getItem(keyFor(cacheKeyParts));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.page) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function feedCacheAgeLabel(savedAt) {
  if (!savedAt) return "";
  const ms = Date.now() - new Date(savedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
