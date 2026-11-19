import { useState } from "react";
import { FaCopy, FaCheck, FaPrint } from "react-icons/fa";
import { plasticBagQrImageUrl, plasticIntakeUrl } from "../utils/plasticBagQr";

/**
 * Printable bag QR label for field → recycler chain of custody.
 */
const PlasticBagQrCard = ({
  bagId,
  kg,
  polymerType,
  status,
  compact = false,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const bag = String(bagId || "").trim();
  if (!bag) return null;

  const intakeUrl = plasticIntakeUrl(bag);
  const qrUrl = plasticBagQrImageUrl(bag, compact ? 160 : 260);

  const copyBag = async () => {
    try {
      await navigator.clipboard.writeText(bag);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const printLabel = () => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${bag}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#0f172a}
        h1{font-size:22px;margin:0 0 8px;letter-spacing:.04em}
        p{margin:4px 0;font-size:14px;color:#475569}
        img{width:240px;height:240px;margin:16px auto;display:block}
        .url{font-size:11px;word-break:break-all;color:#64748b;margin-top:12px}
      </style></head><body>
      <h1>${bag}</h1>
      <p>Climate Wavers · Plastic Pulse</p>
      ${kg ? `<p>${kg} kg${polymerType ? ` · ${polymerType}` : ""}</p>` : ""}
      <img src="${qrUrl}" alt="Bag QR ${bag}" />
      <p>Recycler: scan to confirm intake</p>
      <p class="url">${intakeUrl}</p>
      <script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div
      className={`border border-border bg-background ${
        compact ? "p-3" : "p-4"
      } space-y-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`font-semibold tracking-wide ${compact ? "text-sm" : "text-base"}`}>
            {bag}
          </div>
          <p className="text-xs text-muted mt-0.5">
            Stick on bag · recycler scans to confirm intake
            {kg ? ` · ${kg} kg` : ""}
            {polymerType ? ` · ${polymerType}` : ""}
            {status ? ` · ${status}` : ""}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted underline shrink-0"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className={`flex ${compact ? "flex-row items-center gap-3" : "flex-col items-center gap-2"}`}>
        <img
          src={qrUrl}
          alt={`QR for ${bag}`}
          className={`${compact ? "w-28 h-28" : "w-52 h-52"} bg-white`}
          loading="lazy"
        />
        {!compact ? (
          <p className="text-[11px] text-muted text-center break-all max-w-sm px-2">
            {intakeUrl}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyBag}
          className="h-9 px-3 border border-border text-sm inline-flex items-center gap-2"
        >
          {copied ? <FaCheck size={12} /> : <FaCopy size={12} />}
          {copied ? "Copied" : "Copy Bag ID"}
        </button>
        <button
          type="button"
          onClick={printLabel}
          className="h-9 px-3 border border-border text-sm inline-flex items-center gap-2"
        >
          <FaPrint size={12} />
          Print label
        </button>
        <a
          href={intakeUrl}
          className="h-9 px-3 bg-primary text-white text-sm inline-flex items-center"
        >
          Open intake
        </a>
      </div>
    </div>
  );
};

export default PlasticBagQrCard;
