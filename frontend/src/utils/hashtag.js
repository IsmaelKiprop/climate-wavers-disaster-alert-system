export function normalizeHashtag(raw) {
  return String(raw || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
}

export function hashtagPath(raw) {
  const tag = normalizeHashtag(raw);
  if (!tag) return "/app/community";
  return `/app/hashtag/${encodeURIComponent(tag)}`;
}
