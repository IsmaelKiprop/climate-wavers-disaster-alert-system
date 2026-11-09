import { useMemo, useRef, useState } from "react";
import { FaCheck, FaCopy, FaDownload, FaTree, FaWhatsapp } from "react-icons/fa";
import { giftTreesUrl } from "../utils/profileCompleteness";
import { secureMediaUrl } from "../utils/factory";

function qrImageUrl(text, size = 640) {
  // High error correction so a center tree mark still scans.
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=16&ecc=H&data=${encodeURIComponent(
    text
  )}`;
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

const BuyMeATreeQrModal = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const qrFrameRef = useRef(null);
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
      const x = (size - mark) / 2;
      const y = (size - mark) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, mark / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d1fae5";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Simple tree mark baked into the saved PNG.
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
      anchor.download = `buy-me-a-tree-${user?.username || user?.id || "qr"}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
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
        .cw-qr-tree-halo {
          fill: #ecfdf5;
        }
        .cw-qr-tree-trunk {
          fill: #8b5a2b;
        }
        .cw-qr-tree-canopy {
          fill: #059669;
          transform-origin: 32px 36px;
          animation: cw-tree-breathe 2.4s ease-in-out infinite;
        }
        .cw-qr-tree-canopy-a {
          fill: #10b981;
        }
        .cw-qr-tree-leaf {
          fill: #34d399;
          transform-origin: center;
        }
        .cw-qr-tree-leaf-l {
          animation: cw-leaf-sway-l 2.2s ease-in-out infinite;
        }
        .cw-qr-tree-leaf-r {
          animation: cw-leaf-sway-r 2.2s ease-in-out infinite;
        }
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
            <div className="cw-qr-frame" ref={qrFrameRef}>
              <img
                src={qrUrl}
                alt={`QR code to buy a tree for ${displayName}`}
              />
              <TreeMark />
            </div>
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
