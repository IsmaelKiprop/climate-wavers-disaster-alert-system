import { useMemo, useState } from "react";
import {
  FaCheck,
  FaCopy,
  FaFacebook,
  FaLink,
  FaShare,
  FaWhatsapp,
} from "react-icons/fa6";
import { FaTwitter } from "react-icons/fa";
import { giftTreesPath, profileAppUrl, profileOgShareUrl } from "../utils/profileCompleteness";
import { secureMediaUrl } from "../utils/factory";

const ProfileShareModal = ({ user, treesTotal = 0, onClose, onOpenGiftQr }) => {
  const [copied, setCopied] = useState(false);
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.display_name ||
    user?.username ||
    "Climate Wavers member";
  const photo = secureMediaUrl(
    user?.profile_picture || user?.profile_pic || user?.picture,
    "/avatar.png"
  );
  const shareUrl = useMemo(() => profileOgShareUrl(user?.id), [user?.id]);
  const publicUrl = useMemo(() => profileAppUrl(user?.id), [user?.id]);
  const shareText = `${displayName} is taking climate action on Climate Wavers. View their profile and gift them a tree.`;

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
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface border border-border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center">
              <FaShare />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Share profile</h3>
              <p className="text-sm text-muted">Preview how your link looks</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
            Close
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="border border-border overflow-hidden bg-background">
            {/* WhatsApp-style OG preview: photo with Climate Wavers logo blended on */}
            <div className="relative aspect-[1.91/1] bg-slate-900 overflow-hidden">
              <img
                src={photo}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  e.target.src = "/avatar.png";
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-black/45" />
              <span
                className="absolute bottom-3 right-3 inline-flex items-center justify-center bg-white border border-border p-1"
                style={{ borderRadius: 8 }}
              >
                <img
                  src="/logo.jpg"
                  alt="Climate Wavers"
                  className="h-8 w-auto object-contain"
                  style={{ borderRadius: 4 }}
                />
              </span>
            </div>
            <div className="px-4 py-3">
              <h4 className="text-base font-semibold text-foreground leading-snug">
                {displayName} (@{user?.username}) on Climate Wavers
              </h4>
              <p className="mt-1 text-sm text-muted line-clamp-2">
                {user?.bio || shareText}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {(user?.location || user?.country) && (
                  <span>{user.location || user.country}</span>
                )}
                <span>{treesTotal} trees</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 border border-border bg-background px-3 py-2 text-xs text-muted truncate">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={copy}
              className="h-10 px-3 border border-border bg-surface text-sm inline-flex items-center gap-2"
            >
              {copied ? <FaCheck /> : <FaCopy />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2"
              onClick={() =>
                openShare(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`)
              }
            >
              <FaWhatsapp /> WhatsApp
            </button>
            <button
              type="button"
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2"
              onClick={() =>
                openShare(
                  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                )
              }
            >
              <FaFacebook /> Facebook
            </button>
            <button
              type="button"
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2"
              onClick={() =>
                openShare(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
                )
              }
            >
              <FaTwitter /> X
            </button>
            <a
              href={publicUrl}
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2"
              target="_blank"
              rel="noreferrer"
            >
              <FaLink /> Open
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href={giftTreesPath(user?.id, displayName)}
              className="h-11 bg-primary text-primary-foreground text-sm font-medium text-center leading-[2.75rem]"
            >
              Open gift link
            </a>
            <button
              type="button"
              onClick={() => (onOpenGiftQr ? onOpenGiftQr() : null)}
              className="h-11 border border-border text-sm font-medium"
            >
              Buy me a tree QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileShareModal;
