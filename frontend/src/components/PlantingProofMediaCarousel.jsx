import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoAddOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoCloseOutline,
  IoImagesOutline,
  IoVideocamOutline,
} from "react-icons/io5";
import { mediaUrl } from "../config/env";

const MAX_DEFAULT = 12;

function resolveSrc(url) {
  return mediaUrl(url) || url;
}

/**
 * Carousel for planting proof photos + videos.
 * editable: add more / remove / clear. read-only: swipe/arrows only.
 */
export default function PlantingProofMediaCarousel({
  items = [],
  onAddFiles,
  onRemoveAt,
  onClear,
  editable = false,
  maxItems = MAX_DEFAULT,
  uploading = false,
  className = "",
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const addInputRef = useRef(null);

  const slides = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .map((item, i) => {
          const url = String(item?.url || item?.previewUrl || "").trim();
          if (!url) return null;
          const kind =
            item?.kind === "video" ||
            String(item?.type || "").startsWith("video/") ||
            /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
              ? "video"
              : "image";
          return {
            id: item?.id || `${kind}-${i}-${url}`,
            kind,
            url,
            previewUrl: resolveSrc(url),
            name: item?.name || "",
          };
        })
        .filter(Boolean),
    [items]
  );

  useEffect(() => {
    if (slides.length === 0) {
      setIndex(0);
      return;
    }
    if (index > slides.length - 1) setIndex(slides.length - 1);
  }, [slides.length, index]);

  const empty = slides.length === 0;
  const current = slides[index] || slides[0];
  const canAdd = editable && slides.length < maxItems;
  const showNav = slides.length > 1;

  const go = (dir) => {
    if (!slides.length) return;
    setIndex((prev) => (prev + dir + slides.length) % slides.length);
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches?.[0]?.clientX ?? null;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current == null || !showNav) return;
    const endX = e.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    go(delta < 0 ? 1 : -1);
  };

  const handleAddChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddFiles?.(files);
    e.target.value = "";
  };

  if (empty && !editable) return null;

  return (
    <div className={`border border-border bg-background overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <IoImagesOutline className="text-primary shrink-0" size={18} />
          <p className="text-sm font-medium text-foreground truncate">
            {empty
              ? "No media yet"
              : `${slides.length} ${slides.length === 1 ? "file" : "files"} · photos & videos`}
          </p>
        </div>
        {editable ? (
          <div className="flex items-center gap-1 shrink-0">
            {canAdd ? (
              <button
                type="button"
                disabled={uploading}
                onClick={() => addInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 min-h-8 px-2.5 text-xs font-medium border border-border text-foreground hover:bg-surface disabled:opacity-60"
              >
                <IoAddOutline size={14} />
                {uploading ? "Uploading…" : "Add"}
              </button>
            ) : null}
            {onClear && slides.length ? (
              <button
                type="button"
                disabled={uploading}
                onClick={onClear}
                className="inline-flex items-center min-h-8 px-2.5 text-xs font-medium border border-border text-muted hover:text-foreground hover:bg-surface disabled:opacity-60"
              >
                Remove all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {empty ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => addInputRef.current?.click()}
          className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 text-muted hover:text-primary hover:bg-surface/60 disabled:opacity-60"
        >
          <IoAddOutline size={28} />
          <span className="text-sm font-medium">Add photos or videos</span>
          <span className="text-xs">Select several at once · up to {maxItems}</span>
        </button>
      ) : (
        <>
          <div
            className="relative bg-surface select-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center overflow-hidden">
              {current?.kind === "video" ? (
                <video
                  key={current.id}
                  src={current.previewUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain bg-background"
                />
              ) : (
                <img
                  key={current.id}
                  src={current.previewUrl}
                  alt={current?.name || "Planting proof"}
                  className="w-full h-full object-contain bg-background"
                />
              )}
            </div>

            {editable ? (
              <button
                type="button"
                onClick={() => onRemoveAt?.(index)}
                className="absolute top-2 right-2 h-9 w-9 inline-flex items-center justify-center bg-background border border-border text-foreground shadow-sm"
                aria-label="Remove this media"
              >
                <IoCloseOutline size={18} />
              </button>
            ) : null}

            {current?.kind === "video" ? (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 min-h-7 px-2 text-xs font-medium bg-background border border-border text-foreground">
                <IoVideocamOutline size={14} />
                Video
              </span>
            ) : null}

            {showNav ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center bg-background/95 border border-border text-foreground shadow-sm"
                  aria-label="Previous media"
                >
                  <IoChevronBackOutline size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center bg-background/95 border border-border text-foreground shadow-sm"
                  aria-label="Next media"
                >
                  <IoChevronForwardOutline size={20} />
                </button>
              </>
            ) : null}
          </div>

          <div className="px-3 py-2.5 border-t border-border">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {slides.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`relative shrink-0 h-14 w-14 overflow-hidden border ${
                    i === index ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                  aria-label={`Show media ${i + 1}`}
                  aria-current={i === index}
                >
                  {item.kind === "video" ? (
                    <>
                      <video
                        src={item.previewUrl}
                        muted
                        playsInline
                        className="h-full w-full object-cover pointer-events-none"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-background/40">
                        <IoVideocamOutline size={16} className="text-foreground" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}

              {canAdd ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => addInputRef.current?.click()}
                  className="shrink-0 h-14 w-14 border border-dashed border-border text-muted hover:text-primary hover:border-primary inline-flex flex-col items-center justify-center gap-0.5 disabled:opacity-60"
                  aria-label="Add more photos or videos"
                >
                  <IoAddOutline size={20} />
                  <span className="text-[10px] font-medium leading-none">Add</span>
                </button>
              ) : null}
            </div>

            {showNav ? (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {slides.map((item, i) => (
                  <button
                    key={`dot-${item.id}`}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-4 bg-primary" : "w-1.5 bg-border"
                    }`}
                    aria-label={`Go to media ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}

            <p className="mt-2 text-center text-xs text-muted">
              {index + 1} of {slides.length}
              {editable && canAdd ? ` · up to ${maxItems}` : ""}
            </p>
          </div>
        </>
      )}

      {editable ? (
        <input
          ref={addInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={handleAddChange}
        />
      ) : null}
    </div>
  );
}

/** Build carousel items from stored planting_proof images/videos arrays. */
export function proofMediaFromArrays(images = [], videos = []) {
  const imgs = (Array.isArray(images) ? images : [])
    .map((url, i) => {
      const u = String(url || "").trim();
      return u ? { id: `img-${i}-${u}`, kind: "image", url: u } : null;
    })
    .filter(Boolean);
  const vids = (Array.isArray(videos) ? videos : [])
    .map((url, i) => {
      const u = String(url || "").trim();
      return u ? { id: `vid-${i}-${u}`, kind: "video", url: u } : null;
    })
    .filter(Boolean);
  return [...imgs, ...vids];
}

export function splitProofMedia(items = []) {
  const images = [];
  const videos = [];
  for (const item of items) {
    const url = String(item?.url || "").trim();
    if (!url) continue;
    if (item?.kind === "video") videos.push(url);
    else images.push(url);
  }
  return { images, videos };
}
