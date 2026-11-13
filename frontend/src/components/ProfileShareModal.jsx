import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaCheck,
  FaCopy,
  FaFacebook,
  FaLink,
  FaWhatsapp,
} from "react-icons/fa6";
import { FaTwitter } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import {
  giftTreesPath,
  profileAppUrl,
  profileOgPreviewImage,
  profileOgShareUrl,
} from "../utils/profileCompleteness";
import { secureMediaUrl } from "../utils/factory";

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
];

const ProfileShareModal = ({ user, treesTotal = 0, onClose, onOpenGiftQr }) => {
  const [copied, setCopied] = useState(false);
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.display_name ||
    user?.username ||
    "Climate Wavers member";
  const rawPhoto = secureMediaUrl(
    user?.profile_picture || user?.profile_pic || user?.picture,
    "/avatar.png"
  );
  const previewImage = useMemo(
    () => profileOgPreviewImage(rawPhoto, "/og-image.jpg"),
    [rawPhoto]
  );
  const shareUrl = useMemo(() => profileOgShareUrl(user?.id), [user?.id]);
  const publicUrl = useMemo(() => profileAppUrl(user?.id), [user?.id]);
  const shareText = `${displayName} is taking climate action on Climate Wavers. View their profile and gift them a tree.`;
  const place = [user?.location, user?.country].filter(Boolean)[0] || "";
  const metaBits = [
    place,
    Number(treesTotal) > 0 ? `${treesTotal} trees` : null,
  ].filter(Boolean);

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

  if (typeof document === "undefined") return null;

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
        aria-labelledby="share-profile-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3
              id="share-profile-title"
              className="text-base font-semibold text-foreground truncate"
            >
              Share profile
            </h3>
            <p className="text-xs text-muted">How your link looks when shared</p>
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
          {/* Link card preview */}
          <div className="border-b border-border bg-[var(--cw-background)]">
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "1.91 / 1" }}>
              <img
                src={previewImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  if (e.target.dataset.fallback === "1") return;
                  e.target.dataset.fallback = "1";
                  e.target.src = rawPhoto || "/og-image.jpg";
                }}
              />
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                alerts.flowops.africa
              </p>
              <h4 className="text-sm font-semibold text-foreground leading-snug">
                {displayName}
                {user?.username ? ` (@${user.username})` : ""} on Climate Wavers
              </h4>
              {user?.bio ? (
                <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                  {user.bio}
                </p>
              ) : null}
              {metaBits.length > 0 ? (
                <p className="text-xs text-muted">{metaBits.join(" · ")}</p>
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
                {shareChannels.map(({ key, label, icon: Icon, iconClass, build }) => (
                  <button
                    key={key}
                    type="button"
                    className="h-[4.25rem] border border-border inline-flex flex-col items-center justify-center gap-1.5 text-xs text-foreground hover:bg-[var(--cw-overlay-soft)]"
                    onClick={() => openShare(build(shareText, shareUrl))}
                  >
                    <Icon size={18} className={iconClass || ""} />
                    <span>{label}</span>
                  </button>
                ))}
                <a
                  href={publicUrl}
                  className="h-[4.25rem] border border-border inline-flex flex-col items-center justify-center gap-1.5 text-xs text-foreground hover:bg-[var(--cw-overlay-soft)]"
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaLink size={18} />
                  <span>Open</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <footer
          className="shrink-0 border-t border-border p-4 grid grid-cols-2 gap-2"
          style={{ background: "var(--cw-surface-elevated)" }}
        >
          <a
            href={giftTreesPath(user?.id, displayName)}
            className="h-11 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center hover:opacity-95"
          >
            Gift link
          </a>
          <button
            type="button"
            onClick={() => onOpenGiftQr?.()}
            className="h-11 border border-border text-sm font-medium hover:bg-[var(--cw-overlay-soft)]"
          >
            Tree QR
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default ProfileShareModal;
