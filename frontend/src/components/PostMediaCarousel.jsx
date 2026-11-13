import { useEffect, useRef, useState } from "react";
import {
  IoAddOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoCloseOutline,
  IoImagesOutline,
  IoVideocamOutline,
} from "react-icons/io5";

const MAX_DEFAULT = 10;

/**
 * Facebook-style media carousel for the create-post composer:
 * swipe/arrow between previews, remove current, add more photos/videos.
 */
export default function PostMediaCarousel({
  items = [],
  onAddFiles,
  onRemoveAt,
  onClear,
  maxItems = MAX_DEFAULT,
  className = "",
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);
  const addInputRef = useRef(null);

  useEffect(() => {
    if (items.length === 0) {
      setIndex(0);
      return;
    }
    if (index > items.length - 1) {
      setIndex(items.length - 1);
    }
  }, [items.length, index]);

  if (!items.length) return null;

  const current = items[index] || items[0];
  const canAdd = items.length < maxItems;
  const showNav = items.length > 1;

  const go = (dir) => {
    if (!items.length) return;
    setIndex((prev) => (prev + dir + items.length) % items.length);
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

  return (
    <div className={`mx-4 mb-3 border border-border bg-background overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <IoImagesOutline className="text-primary shrink-0" size={18} />
          <p className="text-sm font-medium text-foreground truncate">
            {items.length} {items.length === 1 ? "media" : "media"} selected
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canAdd ? (
            <button
              type="button"
              onClick={() => addInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 min-h-8 px-2.5 text-xs font-medium border border-border text-foreground hover:bg-surface"
            >
              <IoAddOutline size={14} />
              Add
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center min-h-8 px-2.5 text-xs font-medium border border-border text-muted hover:text-foreground hover:bg-surface"
            >
              Remove all
            </button>
          ) : null}
        </div>
      </div>

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
              className="w-full h-full object-contain bg-background"
            />
          ) : (
            <img
              key={current.id}
              src={current.previewUrl}
              alt={current?.name || "Media preview"}
              className="w-full h-full object-contain bg-background"
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemoveAt?.(index)}
          className="absolute top-2 right-2 h-9 w-9 inline-flex items-center justify-center bg-background border border-border text-foreground shadow-sm"
          aria-label="Remove this media"
        >
          <IoCloseOutline size={18} />
        </button>

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

      {showNav || canAdd ? (
        <div className="px-3 py-2.5 border-t border-border">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {items.map((item, i) => (
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
                onClick={() => addInputRef.current?.click()}
                className="shrink-0 h-14 w-14 border border-dashed border-border text-muted hover:text-primary hover:border-primary inline-flex flex-col items-center justify-center gap-0.5"
                aria-label="Add more photos or videos"
              >
                <IoAddOutline size={20} />
                <span className="text-[10px] font-medium leading-none">Add</span>
              </button>
            ) : null}
          </div>

          {showNav ? (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              {items.map((item, i) => (
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
            {index + 1} of {items.length}
            {canAdd ? ` · up to ${maxItems}` : ""}
          </p>
        </div>
      ) : null}

      <input
        ref={addInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleAddChange}
      />
    </div>
  );
}
