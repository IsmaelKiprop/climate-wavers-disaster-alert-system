import { useMemo, useState } from "react";
import { FaCheck, FaCopy, FaDownload, FaTree, FaWhatsapp } from "react-icons/fa";
import { giftTreesUrl } from "../utils/profileCompleteness";
import { secureMediaUrl } from "../utils/factory";

function qrImageUrl(text, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(
    text
  )}`;
}

const BuyMeATreeQrModal = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.display_name ||
    user?.username ||
    "Climate Wavers member";
  const giftUrl = useMemo(
    () => giftTreesUrl(user?.id, displayName),
    [user?.id, displayName]
  );
  const qrUrl = useMemo(() => qrImageUrl(giftUrl), [giftUrl]);
  const photo = secureMediaUrl(
    user?.profile_picture || user?.profile_pic || user?.picture,
    "/avatar.png"
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(giftUrl);
    } catch {
      const area = document.createElement("textarea");
      area.value = giftUrl;
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
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `buy-me-a-tree-${user?.username || user?.id || "qr"}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center">
              <FaTree />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Buy me a tree</h3>
              <p className="text-sm text-muted">QR code for your gift link</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={photo}
              alt=""
              className="h-12 w-12 object-cover bg-background"
              style={{ borderRadius: "50%" }}
              onError={(e) => {
                e.target.src = "/avatar.png";
              }}
            />
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-sm text-muted truncate">
                Scan to plant a tree for {displayName.split(" ")[0]}
              </p>
            </div>
          </div>

          <div className="border border-border bg-background p-4 flex flex-col items-center">
            <img
              src={qrUrl}
              alt={`QR code to buy a tree for ${displayName}`}
              className="w-56 h-56 object-contain bg-white"
            />
            <p className="mt-3 text-xs text-muted text-center break-all px-2">
              {giftUrl}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2"
            >
              {copied ? <FaCheck /> : <FaCopy />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={downloadQr}
              disabled={saving}
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FaDownload /> {saving ? "Saving…" : "Save QR"}
            </button>
            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(
                    `Buy ${displayName} a tree on Climate Wavers: ${giftUrl}`
                  )}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="h-10 border border-border text-sm inline-flex items-center justify-center gap-2"
            >
              <FaWhatsapp /> WhatsApp
            </button>
          </div>

          <p className="text-xs text-muted">
            Anyone who scans this opens your gift page and can buy trees for you —
            no app sign-in required to pay.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BuyMeATreeQrModal;
