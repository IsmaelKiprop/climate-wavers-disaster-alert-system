import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { extractUrls, resolveLocalLinkPreview } from "../utils/linkPreview";

const previewCache = new Map();

async function loadPreview(url) {
  if (previewCache.has(url)) return previewCache.get(url);
  const request = (async () => {
    try {
      const response = await fetch(
        `/api/link-preview?url=${encodeURIComponent(url)}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data?.title || data?.image) return data;
      }
    } catch {
      /* fall through to local resolver */
    }
    return resolveLocalLinkPreview(url);
  })();
  previewCache.set(url, request);
  return request;
}

const ChatLinkPreview = ({ text, mine = false }) => {
  const urls = extractUrls(text);
  const firstUrl = urls[0] || "";
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(Boolean(firstUrl));

  useEffect(() => {
    let alive = true;
    if (!firstUrl) {
      setPreview(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    loadPreview(firstUrl).then((data) => {
      if (!alive) return;
      setPreview(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [firstUrl]);

  if (!firstUrl) return null;

  if (loading && !preview) {
    return (
      <div
        className={`mt-2 overflow-hidden border animate-pulse ${
          mine ? "border-primary-foreground/25 bg-black/10" : "border-border bg-background"
        }`}
        style={{ borderRadius: 5 }}
        aria-hidden="true"
      >
        <div className="h-28 bg-border/60" />
        <div className="p-2.5 space-y-2">
          <div className="h-3 w-2/3 bg-border" />
          <div className="h-3 w-full bg-border" />
        </div>
      </div>
    );
  }

  if (!preview?.title && !preview?.image) return null;

  const href = preview.url || firstUrl;
  const host = (() => {
    try {
      return new URL(href).hostname.replace(/^www\./, "");
    } catch {
      return preview.siteName || "";
    }
  })();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block overflow-hidden border transition-opacity hover:opacity-95 ${
        mine ? "border-primary-foreground/30 bg-black/15" : "border-border bg-background"
      }`}
      style={{ borderRadius: 5 }}
    >
      {preview.image ? (
        <img
          src={preview.image}
          alt=""
          className="w-full h-32 object-cover bg-surface"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div className="px-2.5 py-2 min-w-0">
        {host ? (
          <p
            className={`text-[10px] uppercase tracking-wide truncate ${
              mine ? "text-primary-foreground/70" : "text-muted"
            }`}
          >
            {preview.siteName || host}
          </p>
        ) : null}
        <p
          className={`text-sm font-semibold leading-snug line-clamp-2 ${
            mine ? "text-primary-foreground" : "text-foreground"
          }`}
        >
          {preview.title || host}
        </p>
        {preview.description ? (
          <p
            className={`mt-0.5 text-xs leading-snug line-clamp-2 ${
              mine ? "text-primary-foreground/80" : "text-muted"
            }`}
          >
            {preview.description}
          </p>
        ) : null}
      </div>
    </a>
  );
};

ChatLinkPreview.propTypes = {
  text: PropTypes.string,
  mine: PropTypes.bool,
};

export default ChatLinkPreview;
