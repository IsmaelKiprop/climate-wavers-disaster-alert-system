import { hashtagPath } from "./hashtag";

/** Match http(s) URLs, www.* URLs, #hashtags, and @mentions. */
const TOKEN_RE =
  /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|#[A-Za-z0-9_]+|@[A-Za-z0-9_.]+)/g;

function trimTrailingPunctuation(value) {
  return String(value || "").replace(/[),.!?;:]+$/g, "");
}

export function normalizeExternalHref(raw) {
  const cleaned = trimTrailingPunctuation(raw);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned.replace(/^http:\/\//i, "https://");
  }
  if (/^www\./i.test(cleaned)) {
    return `https://${cleaned}`;
  }
  return "";
}

/**
 * Split text into typed segments for rendering.
 * @returns {{ type: 'text'|'url'|'hashtag'|'mention', value: string, href?: string }[]}
 */
export function tokenizeRichText(text, { mentions = [] } = {}) {
  const source = String(text || "");
  if (!source) return [];

  const mentionHandles = new Set(
    (mentions || [])
      .map((m) => String(m?.username || "").toLowerCase())
      .filter(Boolean)
  );

  const parts = [];
  let lastIndex = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: source.slice(lastIndex, index) });
    }

    if (raw.startsWith("#")) {
      parts.push({
        type: "hashtag",
        value: raw,
        href: hashtagPath(raw),
      });
    } else if (raw.startsWith("@")) {
      const handle = raw.slice(1).toLowerCase();
      parts.push({
        type: mentionHandles.size === 0 || mentionHandles.has(handle) ? "mention" : "text",
        value: raw,
      });
    } else {
      const href = normalizeExternalHref(raw);
      const trailing = raw.slice(trimTrailingPunctuation(raw).length);
      if (href) {
        parts.push({
          type: "url",
          value: trimTrailingPunctuation(raw),
          href,
        });
        if (trailing) parts.push({ type: "text", value: trailing });
      } else {
        parts.push({ type: "text", value: raw });
      }
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < source.length) {
    parts.push({ type: "text", value: source.slice(lastIndex) });
  }
  return parts;
}
