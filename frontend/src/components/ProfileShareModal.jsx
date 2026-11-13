import { useMemo, useState } from "react";
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
  const place = user?.location || user?.country || "";

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

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-md bg-surface border border-border shadow-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-profile-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h3 id="share-profile-title" className="font-semibold text-foreground">
              Share profile
            </h3>
            <p className="text-xs text-muted mt-0.5">Link preview for WhatsApp &amp; Facebook</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-background"
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Exact OG card: branded Cloudinary image already includes the logo */}
          <div className="border border-border overflow-hidden bg-background">
            <div className="relative aspect-[1.91/1] bg-background overflow-hidden">
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
            <div className="px-3.5 py-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                alerts.flowops.africa
              </p>
              <h4 className="text-[15px] font-semibold text-foreground leading-snug">
                {displayName}
                {user?.username ? (
                  <span className="font-medium text-muted"> (@{user.username})</span>
                ) : null}{" "}
                on Climate Wavers
              </h4>
              {(user?.bio || shareText) && (
                <p className="text-sm text-muted line-clamp-2 leading-snug">
                  {user?.bio || shareText}
                </p>
              )}
              {(place || treesTotal > 0) && (
                <p className="text-xs text-muted pt-0.5">
                  {[place, treesTotal > 0 ? `${treesTotal} trees` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 border border-border bg-background px-3 py-2.5 text-xs text-muted truncate">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={copy}
              className="h-10 px-3.5 border border-border bg-surface text-sm text-foreground inline-flex items-center gap-2 shrink-0 hover:bg-background"
            >
              {copied ? <FaCheck className="text-primary" /> : <FaCopy />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              className="h-11 border border-border text-xs sm:text-sm inline-flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-background"
              onClick={() =>
                openShare(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`)
              }
            >
              <FaWhatsapp className="text-[#25D366]" size={16} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              className="h-11 border border-border text-xs sm:text-sm inline-flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-background"
              onClick={() =>
                openShare(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                )
              }
            >
              <FaFacebook size={16} />
              <span>Facebook</span>
            </button>
            <button
              type="button"
              className="h-11 border border-border text-xs sm:text-sm inline-flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-background"
              onClick={() =>
                openShare(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
                )
              }
            >
              <FaTwitter size={16} />
              <span>X</span>
            </button>
            <a
              href={publicUrl}
              className="h-11 border border-border text-xs sm:text-sm inline-flex flex-col sm:flex-row items-center justify-center gap-1 hover:bg-background"
              target="_blank"
              rel="noreferrer"
            >
              <FaLink size={16} />
              <span>Open</span>
            </a>
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-surface">
          <a
            href={giftTreesPath(user?.id, displayName)}
            className="h-11 bg-primary text-primary-foreground text-sm font-medium text-center leading-[2.75rem] hover:opacity-95"
          >
            Open gift link
          </a>
          <button
            type="button"
            onClick={() => (onOpenGiftQr ? onOpenGiftQr() : null)}
            className="h-11 border border-border text-sm font-medium hover:bg-background"
          >
            Buy me a tree QR
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileShareModal;
