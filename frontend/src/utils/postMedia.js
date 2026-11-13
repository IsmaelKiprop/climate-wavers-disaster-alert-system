/**
 * Post.image is a TextField that may hold a single URL or a JSON array of URLs.
 */
export function parsePostImages(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(String).map((u) => u.trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((u) => u.trim()).filter(Boolean);
      }
    } catch {
      /* treat as a plain URL */
    }
  }
  return [trimmed];
}

export function encodePostImages(urls) {
  const list = (Array.isArray(urls) ? urls : [])
    .map(String)
    .map((u) => u.trim())
    .filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return JSON.stringify(list);
}

export function createMediaItem(file) {
  if (!(file instanceof File)) return null;
  const kind = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("image/")
      ? "image"
      : null;
  if (!kind) return null;
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    kind,
    name: file.name,
  };
}

export function revokeMediaItems(items) {
  (items || []).forEach((item) => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  });
}
