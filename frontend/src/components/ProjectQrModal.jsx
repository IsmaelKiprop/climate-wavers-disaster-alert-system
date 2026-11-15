import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaCheck, FaCopy, FaDownload, FaTree, FaWhatsapp } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { projectAppUrl, projectOgShareUrl } from "../utils/profileCompleteness";
import { mediaUrl } from "../config/env";

function qrImageUrl(text, size = 640) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=16&ecc=H&data=${encodeURIComponent(
    text
  )}`;
}

function resolveCover(project) {
  const raw =
    project?.cover_image_url ||
    project?.cover_image ||
    project?.image_url ||
    "";
  if (!raw) return "/og-image.jpg";
  if (String(raw).startsWith("http") || String(raw).startsWith("//")) {
    return String(raw);
  }
  try {
    return mediaUrl(raw) || String(raw);
  } catch {
    return String(raw);
  }
}

const TreeMark = () => (
  <div className="cw-qr-tree-mark" aria-hidden="true">
    <svg viewBox="0 0 64 64" className="cw-qr-tree-svg" role="img">
      <circle cx="32" cy="32" r="30" className="cw-qr-tree-halo" />
      <rect x="29" y="40" width="6" height="14" rx="1.5" className="cw-qr-tree-trunk" />
      <path
        className="cw-qr-tree-canopy cw-qr-tree-canopy-a"
        d="M32 8c-9 0-16 7-16 14 0 1.2.2 2.3.5 3.4C13 27 11 31 11 35c0 7 6 12 14 12h14c8 0 14-5 14-12 0-4-2-8-5.5-9.6.3-1.1.5-2.2.5-3.4C48 15 41 8 32 8z"
      />
      <path
        className="cw-qr-tree-leaf cw-qr-tree-leaf-l"
        d="M22 28c-4 1-7 4-8 8 4-1 8-2 10-5 1-1.2.5-3.2-2-3z"
      />
      <path
        className="cw-qr-tree-leaf cw-qr-tree-leaf-r"
        d="M42 26c4 1 7 4 8 8-4-1-8-2-10-5-1-1.2-.5-3.2 2-3z"
      />
    </svg>
  </div>
);

const ProjectQrModal = ({ project, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const shareUrl = useMemo(
    () => projectOgShareUrl(project?.id),
    [project?.id]
  );
  const publicUrl = useMemo(() => projectAppUrl(project?.id), [project?.id]);
  const qrUrl = useMemo(() => qrImageUrl(shareUrl), [shareUrl]);
  const cover = useMemo(() => resolveCover(project), [project]);
  const place = [project?.city, project?.country].filter(Boolean).join(", ");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const copyLink = async () => {
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

  const downloadQr = async () => {
    setSaving(true);
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const size = 640;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(bitmap, 0, 0, size, size);

      const mark = 112;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, mark / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d1fae5";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "#8B5A2B";
      ctx.fillRect(size / 2 - 6, size / 2 + 10, 12, 28);
      ctx.fillStyle = "#059669";
      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2 - 34);
      ctx.lineTo(size / 2 + 34, size / 2 + 8);
      ctx.lineTo(size / 2 - 34, size / 2 + 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2 - 22);
      ctx.lineTo(size / 2 + 28, size / 2 + 14);
      ctx.lineTo(size / 2 - 28, size / 2 + 14);
      ctx.closePath();
      ctx.fillStyle = "#10b981";
      ctx.fill();

      const objectUrl = canvas.toDataURL("image/png");
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      const slug = String(project?.name || project?.id || "project")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
      anchor.download = `climate-wavers-project-${slug || "qr"}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === "undefined" || !project) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0, 0, 0, 0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <style>{`
        .cw-qr-frame {
          position: relative;
          width: 14rem;
          height: 14rem;
          background: #fff;
        }
        .cw-qr-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        .cw-qr-tree-mark {
          position: absolute;
          inset: 50% auto auto 50%;
          width: 3.5rem;
          height: 3.5rem;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          background: #fff;
          box-shadow: 0 0 0 3px #ecfdf5;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .cw-qr-tree-svg {
          width: 2.6rem;
          height: 2.6rem;
        }
        .cw-qr-tree-halo { fill: #ecfdf5; }
        .cw-qr-tree-trunk { fill: #8b5a2b; }
        .cw-qr-tree-canopy {
          fill: #059669;
          transform-origin: 32px 36px;
          animation: cw-tree-breathe 2.4s ease-in-out infinite;
        }
        .cw-qr-tree-canopy-a { fill: #10b981; }
        .cw-qr-tree-leaf { fill: #34d399; transform-origin: center; }
        .cw-qr-tree-leaf-l { animation: cw-leaf-sway-l 2.2s ease-in-out infinite; }
        .cw-qr-tree-leaf-r { animation: cw-leaf-sway-r 2.2s ease-in-out infinite; }
        @keyframes cw-tree-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes cw-leaf-sway-l {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          50% { transform: rotate(-8deg) translateX(-1px); }
        }
        @keyframes cw-leaf-sway-r {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          50% { transform: rotate(8deg) translateX(1px); }
        }
      `}</style>

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
        aria-labelledby="project-qr-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary inline-flex items-center justify-center">
              <FaTree />
            </div>
            <div className="min-w-0">
              <h3
                id="project-qr-title"
                className="text-base font-semibold text-foreground truncate"
              >
                Project QR
              </h3>
              <p className="text-xs text-muted truncate">
                Scan to open this planting project
              </p>
            </div>
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

        <div className="overflow-y-auto min-h-0 flex-1 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={cover}
              alt=""
              className="h-12 w-12 object-cover bg-background border border-border shrink-0"
              onError={(e) => {
                e.target.src = "/og-image.jpg";
              }}
            />
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">
                {project.name}
              </p>
              <p className="text-sm text-muted truncate">
                {place || "Climate Wavers"}
              </p>
            </div>
          </div>

          <div className="border border-border bg-[var(--cw-background)] p-4 flex flex-col items-center">
            <div className="cw-qr-frame">
              <img
                src={qrUrl}
                alt={`QR code for ${project.name}`}
              />
              <TreeMark />
            </div>
            <p className="mt-3 text-xs text-muted text-center break-all px-2">
              {publicUrl}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="h-10 border border-border text-sm text-foreground inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
            >
              {copied ? <FaCheck className="text-primary" /> : <FaCopy />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={downloadQr}
              disabled={saving}
              className="h-10 border border-border text-sm text-foreground inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)] disabled:opacity-50"
            >
              <FaDownload /> {saving ? "Saving…" : "Save QR"}
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(
                    `Plant trees with Climate Wavers — “${project.name}”: ${shareUrl}`
                  )}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="h-10 border border-border text-sm text-foreground inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)]"
            >
              <FaWhatsapp className="text-[#25D366]" /> WhatsApp
            </button>
          </div>

          <p className="text-xs text-muted">
            Anyone who scans opens the public project page — plant trees, share,
            or learn more. No sign-in required to view.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProjectQrModal;
