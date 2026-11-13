import { useEffect, useRef, useState } from "react";
import {
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoVideocamOutline,
} from "react-icons/io5";
import { parsePostImages } from "../utils/postMedia";
import { secureMediaUrl } from "../utils/factory";

/**
 * Feed/post viewer: Facebook-style carousel when a post has multiple images
 * (and optional video alongside).
 */
export default function PostMediaViewer({
  image,
  video,
  onPreview,
  className = "",
}) {
  const images = parsePostImages(image).map((src) => ({
    kind: "image",
    src: secureMediaUrl(src),
  }));
  const items = [...images];
  if (video) {
    items.push({ kind: "video", src: secureMediaUrl(video) });
  }

  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    setIndex(0);
  }, [image, video]);

  if (!items.length) return null;

  const current = items[Math.min(index, items.length - 1)];
  const showNav = items.length > 1;

  const go = (dir) => {
    setIndex((prev) => (prev + dir + items.length) % items.length);
  };

  const openPreview = (item) => {
    if (!onPreview || !item?.src) return;
    onPreview({
      type: item.kind === "video" ? "video" : "image",
      src: item.src,
      alt: item.kind === "video" ? "Post video" : "Post image",
    });
  };

  return (
    <div className={`mt-4 overflow-hidden border border-border bg-background ${className}`}>
      <div
        className="relative"
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches?.[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null || !showNav) return;
          const endX = e.changedTouches?.[0]?.clientX ?? touchStartX.current;
          const delta = endX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 40) return;
          go(delta < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          className="w-full block text-left cursor-zoom-in"
          onClick={() => openPreview(current)}
          aria-label={current.kind === "video" ? "Preview video" : "Preview image"}
        >
          {current.kind === "video" ? (
            <div className="relative flex items-center justify-center max-h-[min(70vh,520px)] bg-surface">
              <video
                className="w-full max-h-[min(70vh,520px)] object-contain pointer-events-none"
                preload="metadata"
                playsInline
                muted
                key={current.src}
              >
                <source src={current.src} type="video/mp4" />
              </video>
              <span className="absolute inset-0 flex items-center justify-center bg-background/20 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                  <IoVideocamOutline size={14} />
                  Play preview
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center max-h-[min(70vh,520px)] bg-surface">
              <img
                className="w-full max-h-[min(70vh,520px)] object-contain pointer-events-none"
                src={current.src}
                alt="Post content"
              />
            </div>
          )}
        </button>

        {showNav ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center bg-background/95 border border-border text-foreground"
              aria-label="Previous"
            >
              <IoChevronBackOutline size={18} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center bg-background/95 border border-border text-foreground"
              aria-label="Next"
            >
              <IoChevronForwardOutline size={18} />
            </button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
              {items.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full ${
                    i === index ? "w-4 bg-primary" : "w-1.5 bg-background border border-border"
                  }`}
                />
              ))}
            </div>
            <span className="absolute top-2 right-2 min-h-7 px-2 inline-flex items-center text-xs font-medium bg-background border border-border text-foreground">
              {index + 1}/{items.length}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
