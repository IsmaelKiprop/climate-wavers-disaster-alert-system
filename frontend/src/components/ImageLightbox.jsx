import { useEffect, useCallback, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { IoCloseSharp, IoAdd, IoRemove } from "react-icons/io5";

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const STEP = 0.5;

const ImageLightbox = ({ src, alt = "", onClose }) => {
  const [scale, setScale] = useState(1);

  const close = useCallback(() => {
    setScale(1);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "+" || event.key === "=") {
        setScale((s) => Math.min(MAX_SCALE, Number((s + STEP).toFixed(1))));
      }
      if (event.key === "-") {
        setScale((s) => Math.max(MIN_SCALE, Number((s - STEP).toFixed(1))));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  if (!src) return null;

  const zoomIn = () =>
    setScale((s) => Math.min(MAX_SCALE, Number((s + STEP).toFixed(1))));
  const zoomOut = () =>
    setScale((s) => Math.max(MIN_SCALE, Number((s - STEP).toFixed(1))));

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      onClick={close}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white/80 truncate">{alt || "Preview"}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-2 text-white/90 hover:bg-white/10 disabled:opacity-40"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <IoRemove size={22} />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-white/70 tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="p-2 text-white/90 hover:bg-white/10 disabled:opacity-40"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <IoAdd size={22} />
          </button>
          <button
            type="button"
            className="p-2 text-white/90 hover:bg-white/10"
            onClick={close}
            aria-label="Close"
          >
            <IoCloseSharp size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4">
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[calc(100dvh-5.5rem)] object-contain select-none transition-transform duration-200 origin-center cursor-zoom-in"
          style={{
            transform: `scale(${scale})`,
            cursor: scale > 1 ? "zoom-out" : "zoom-in",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setScale((s) => (s > 1 ? 1 : 2));
          }}
          draggable={false}
        />
      </div>
    </div>,
    document.body
  );
};

ImageLightbox.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  onClose: PropTypes.func,
};

export default ImageLightbox;
