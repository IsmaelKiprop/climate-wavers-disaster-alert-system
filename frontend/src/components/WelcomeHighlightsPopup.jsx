import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IoChevronBack, IoChevronForward, IoClose } from "react-icons/io5";
import axios from "axios";
import { apiUrl } from "../config/env";
import { endpoints } from "../utils/endpoints";
import {
  disasterTypeFallback,
  fetchDisasters,
  toHttpsUrl,
  unwrapList,
} from "../utils/apiData";

const STORAGE_KEY = "cw_welcome_highlights_v2";
const MAX_SLIDES = 8;

function dismissedRecently() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    // Don’t re-show for 18 hours after dismiss
    return Date.now() - ts < 18 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function projectSlide(project) {
  const cover =
    toHttpsUrl(project.cover_image_url || project.cover_image) ||
    (Array.isArray(project.gallery_urls) && project.gallery_urls[0]
      ? toHttpsUrl(project.gallery_urls[0])
      : "") ||
    "/environment.jpg";
  const location = [project.city, project.country].filter(Boolean).join(", ");
  return {
    id: `project-${project.id}`,
    kind: "project",
    image: cover,
    eyebrow: "Active planting",
    title: project.name || "Tree project",
    body:
      project.short_description ||
      (project.description || "").slice(0, 140) ||
      "Support verified Climate Wavers tree planting across Africa.",
    meta: location
      ? `${location}${
          project.trees_planted != null
            ? ` · ${Number(project.trees_planted).toLocaleString()} trees`
            : ""
        }`
      : null,
    primary: {
      label: "Plant trees",
      to: `/p/${project.id}`,
    },
    secondary: {
      label: "Explore projects",
      to: "/app/plant-tree",
    },
  };
}

function disasterSlide(disaster) {
  const type = disaster.disasterType || disaster.type || "other";
  const image =
    toHttpsUrl(disaster.image || disaster.cover_image) ||
    disasterTypeFallback(type);
  const title = disaster.title || disaster.name || "Live disaster alert";
  const body =
    (disaster.description || disaster.details || "").slice(0, 140) ||
    "Verified from USGS / NASA feeds for community awareness.";
  return {
    id: `disaster-${disaster.id}`,
    kind: "disaster",
    image,
    eyebrow: "Live alert",
    title,
    body,
    meta:
      disaster.location ||
      [disaster.region, disaster.country].filter(Boolean).join(", "),
    primary: {
      label: "View alert",
      to: `/disasters/${encodeURIComponent(String(disaster.id))}`,
    },
    secondary: {
      label: "Open live map",
      href: "#impact",
    },
  };
}

const FALLBACK_SLIDES = [
  {
    id: "fallback-alerts",
    kind: "brand",
    image: "/ai-disaster-sm.jpg",
    eyebrow: "Climate Wavers",
    title: "Disaster alerts verified from Nairobi",
    body: "Live USGS and NASA events — built to verify information, not shout louder.",
    meta: null,
    primary: { label: "Create an account", to: "/signup" },
    secondary: { label: "Sign in", to: "/login" },
  },
  {
    id: "fallback-trees",
    kind: "brand",
    image: "/environment-sm.jpg",
    eyebrow: "Plant with purpose",
    title: "Grow verified tree campaigns",
    body: "Support African canopy projects with species inventory you can trust.",
    meta: null,
    primary: { label: "Browse projects", to: "/app/plant-tree" },
    secondary: { label: "Learn more", href: "#impact" },
  },
];

/**
 * First-visit pop-out for the public site: active projects + live alerts.
 * One slide = focused panel; many = carousel.
 */
const WelcomeHighlightsPopup = ({ enabled = true }) => {
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const [entered, setEntered] = useState(false);
  const touchX = useRef(null);
  const autoRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    if (dismissedRecently()) return undefined;

    let alive = true;
    const boot = async () => {
      let projectSlides = [];
      let disasterSlides = [];
      try {
        const res = await axios.get(apiUrl(endpoints.tree_projects_african), {
          timeout: 12000,
        });
        projectSlides = unwrapList(res.data)
          .filter(Boolean)
          .slice(0, 5)
          .map(projectSlide);
      } catch {
        projectSlides = [];
      }
      try {
        const disasters = await fetchDisasters();
        disasterSlides = (Array.isArray(disasters) ? disasters : [])
          .slice(0, 3)
          .map(disasterSlide);
      } catch {
        disasterSlides = [];
      }

      if (!alive) return;
      // Interleave: lead with projects (visual), then alerts
      const merged = [];
      const p = [...projectSlides];
      const d = [...disasterSlides];
      while (p.length || d.length) {
        if (p.length) merged.push(p.shift());
        if (d.length) merged.push(d.shift());
      }
      const next = (merged.length ? merged : FALLBACK_SLIDES).slice(0, MAX_SLIDES);
      setSlides(next);
      // Slight delay so the hero paints first
      window.setTimeout(() => {
        if (!alive) return;
        setOpen(true);
        requestAnimationFrame(() => setEntered(true));
      }, 700);
    };

    const t = window.setTimeout(boot, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [enabled]);

  const count = slides.length;
  const current = slides[index] || null;
  const multi = count > 1;

  const go = useCallback(
    (delta) => {
      if (count < 2) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (!open || !multi) return undefined;
    autoRef.current = window.setInterval(() => go(1), 5500);
    return () => {
      if (autoRef.current) window.clearInterval(autoRef.current);
    };
  }, [open, multi, go, index]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, go]);

  const close = () => {
    setEntered(false);
    markDismissed();
    window.setTimeout(() => setOpen(false), 180);
  };

  const onTouchStart = (e) => {
    touchX.current = e.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const x = e.changedTouches?.[0]?.clientX;
    if (x == null) return;
    const dx = x - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 48) return;
    go(dx < 0 ? 1 : -1);
  };

  if (!open || !current || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      style={{ background: "rgba(8, 12, 12, 0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-highlight-title"
      onClick={close}
    >
      <div
        className={`relative w-full sm:max-w-lg md:max-w-xl bg-surface border border-border overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out rounded-t-[14px] sm:rounded-[14px] ${
          entered ? "translate-y-0 sm:scale-100" : "translate-y-6 sm:scale-[0.98]"
        }`}
        style={{ maxHeight: "92dvh" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 z-20 h-10 w-10 inline-flex items-center justify-center bg-black/45 text-white hover:bg-black/60"
          aria-label="Close"
        >
          <IoClose size={22} />
        </button>

        {/* Full-bleed visual */}
        <div className="relative h-[42vh] min-h-[220px] max-h-[360px] sm:h-[300px] bg-background overflow-hidden">
          {slides.map((slide, i) => (
            <img
              key={slide.id}
              src={slide.image}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-black/50" />

          <div className="absolute left-4 right-14 bottom-4 z-10 text-white">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/80 mb-1">
              {current.eyebrow}
            </p>
            <p className="text-xl sm:text-2xl font-semibold leading-snug line-clamp-2">
              {current.title}
            </p>
          </div>

          {multi ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 hidden sm:inline-flex items-center justify-center bg-black/40 text-white hover:bg-black/55"
                aria-label="Previous"
              >
                <IoChevronBack size={20} />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 hidden sm:inline-flex items-center justify-center bg-black/40 text-white hover:bg-black/55"
                aria-label="Next"
              >
                <IoChevronForward size={20} />
              </button>
            </>
          ) : null}
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div>
            <h2 id="welcome-highlight-title" className="sr-only">
              {current.title}
            </h2>
            {current.meta ? (
              <p className="text-xs text-muted mb-2">{current.meta}</p>
            ) : null}
            <p className="text-sm text-foreground-soft leading-relaxed">
              {current.body}
            </p>
          </div>

          {multi ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5" role="tablist" aria-label="Highlights">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 transition-all ${
                      i === index
                        ? "w-6 bg-primary"
                        : "w-1.5 bg-border hover:bg-muted"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted tabular-nums">
                {index + 1} / {count}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {current.primary?.to ? (
              <Link
                to={current.primary.to}
                onClick={close}
                className="h-11 inline-flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold"
              >
                {current.primary.label}
              </Link>
            ) : null}
            {current.secondary?.to ? (
              <Link
                to={current.secondary.to}
                onClick={close}
                className="h-11 inline-flex items-center justify-center border border-border text-foreground text-sm font-medium hover:bg-[var(--cw-overlay-soft)]"
              >
                {current.secondary.label}
              </Link>
            ) : current.secondary?.href ? (
              <a
                href={current.secondary.href}
                onClick={close}
                className="h-11 inline-flex items-center justify-center border border-border text-foreground text-sm font-medium hover:bg-[var(--cw-overlay-soft)]"
              >
                {current.secondary.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={close}
                className="h-11 border border-border text-foreground text-sm font-medium hover:bg-[var(--cw-overlay-soft)]"
              >
                Continue exploring
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full text-center text-xs text-muted hover:text-foreground py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WelcomeHighlightsPopup;
