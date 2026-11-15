import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaCheck,
  FaCopy,
  FaFacebook,
  FaLink,
  FaLinkedin,
  FaWhatsapp,
} from "react-icons/fa6";
import { FaTwitter } from "react-icons/fa";
import { IoClose, IoMailOutline, IoQrCodeOutline } from "react-icons/io5";
import {
  brandedOgPreviewImage,
  projectAppUrl,
  projectOgShareUrl,
} from "../utils/profileCompleteness";
import { mediaUrl } from "../config/env";
import ProjectQrModal from "./ProjectQrModal";

const shareChannels = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: FaWhatsapp,
    iconClass: "text-[#25D366]",
    build: (text, url) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: FaFacebook,
    build: (_text, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "x",
    label: "X",
    icon: FaTwitter,
    build: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: FaLinkedin,
    build: (_text, url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
];

function resolveCover(project) {
  const raw =
    project?.cover_image_url ||
    project?.cover_image ||
    project?.image_url ||
    "";
  if (!raw) return "";
  if (String(raw).startsWith("http") || String(raw).startsWith("//")) {
    return String(raw);
  }
  try {
    return mediaUrl(raw) || String(raw);
  } catch {
    return String(raw);
  }
}

const SocialShare = ({ project, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const coverSrc = useMemo(() => resolveCover(project), [project]);
  const previewImage = useMemo(
    () => brandedOgPreviewImage(coverSrc, "/og-image.jpg"),
    [coverSrc]
  );
  const shareUrl = useMemo(
    () => projectOgShareUrl(project?.id),
    [project?.id]
  );
  const publicUrl = useMemo(() => projectAppUrl(project?.id), [project?.id]);

  const place = [project?.city, project?.region, project?.country]
    .filter(Boolean)
    .join(", ");
  const shareText = `Plant trees with Climate Wavers — “${project?.name || "this project"}”${
    project?.country ? ` in ${project.country}` : ""
  }.`;
  const shareTitle = `${project?.name || "Tree project"} · Climate Wavers`;
  const blurb = (
    project?.short_description ||
    project?.description ||
    ""
  ).trim();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && !showQr) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, showQr]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const area = document.createElement("textarea");
      area.value = shareUrl;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openShare = (url) => {
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=520");
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (typeof document === "undefined" || !project) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0, 0, 0, 0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-[420px] border border-border shadow-2xl max-h-[88dvh] flex flex-col overflow-hidden"
        style={{
          background: "var(--cw-surface-elevated)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-project-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3
              id="share-project-title"
              className="text-base font-semibold text-foreground truncate"
            >
              Share project
            </h3>
            <p className="text-xs text-muted">
              Cover + Climate Wavers logo when shared
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-[var(--cw-overlay-soft)]"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </header>

        <div className="overflow-y-auto min-h-0 flex-1">
          <div className="border-b border-border bg-[var(--cw-background)]">
            <div
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: "1.91 / 1" }}
            >
              <img
                src={previewImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  if (e.target.dataset.fallback === "1") return;
                  e.target.dataset.fallback = "1";
                  e.target.src = coverSrc || "/og-image.jpg";
                }}
              />
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                alerts.flowops.africa
              </p>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                {shareTitle}
              </h4>
              {blurb ? (
                <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                  {blurb}
                </p>
              ) : null}
              {place ? (
                <p className="text-xs text-muted">{place}</p>
              ) : null}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted mb-2">Share link</p>
              <div className="flex gap-2">
                <div
                  className="flex-1 min-w-0 border border-border px-3 py-2.5 text-xs text-muted truncate"
                  style={{ background: "var(--cw-background)" }}
                >
                  {shareUrl}
                </div>
                <button
                  type="button"
                  onClick={copy}
                  className="h-10 px-3.5 border border-border text-sm text-foreground inline-flex items-center gap-2 shrink-0 hover:bg-[var(--cw-overlay-soft)]"
                >
                  {copied ? <FaCheck className="text-primary" /> : <FaCopy />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted mb-2">Share to</p>
              <div className="grid grid-cols-4 gap-2">
                {shareChannels.map(
                  ({ key, label, icon: Icon, iconClass, build }) => (
                    <button
                      key={key}
                      type="button"
                      className="h-[4.25rem] border border-border inline-flex flex-col items-center justify-center gap-1.5 text-xs text-foreground hover:bg-[var(--cw-overlay-soft)]"
                      onClick={() => openShare(build(shareText, shareUrl))}
                    >
                      <Icon size={18} className={iconClass || ""} />
                      <span>{label}</span>
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={shareViaEmail}
                className="mt-2 w-full h-11 border border-border text-sm text-foreground inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
              >
                <IoMailOutline size={18} />
                Email
              </button>
            </div>
          </div>
        </div>

        <footer
          className="shrink-0 border-t border-border p-4 grid grid-cols-2 gap-2"
          style={{ background: "var(--cw-surface-elevated)" }}
        >
          <a
            href={publicUrl}
            className="h-11 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-95"
            target="_blank"
            rel="noreferrer"
          >
            <FaLink size={14} />
            Open page
          </a>
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="h-11 border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
          >
            <IoQrCodeOutline size={18} />
            Project QR
          </button>
        </footer>
      </div>

      {showQr ? (
        <ProjectQrModal project={project} onClose={() => setShowQr(false)} />
      ) : null}
    </div>,
    document.body
  );
};

export default SocialShare;
