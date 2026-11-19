import { env } from "../config/env";

/** Absolute intake deep-link encoded in bag QR stickers. */
export function plasticIntakeUrl(bagId) {
  const bag = String(bagId || "").trim();
  const base = env.siteUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const url = new URL(`${String(base).replace(/\/+$/, "")}/plastic/intake`);
  if (bag) url.searchParams.set("bag", bag);
  return url.toString();
}

export function plasticBagQrImageUrl(bagId, size = 280) {
  const data = plasticIntakeUrl(bagId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&ecc=M&data=${encodeURIComponent(
    data
  )}`;
}

/** Extract bag id from a scanned QR payload (URL, path, or raw BAG-…). */
export function parseBagIdFromScan(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  try {
    const u = new URL(text, typeof window !== "undefined" ? window.location.origin : "https://alerts.flowops.africa");
    const fromQuery = u.searchParams.get("bag") || u.searchParams.get("bag_id");
    if (fromQuery) return String(fromQuery).trim().toUpperCase();
    const pathMatch = u.pathname.match(/\/(?:plastic\/intake|bags?)\/([^/?#]+)/i);
    if (pathMatch?.[1] && pathMatch[1].toLowerCase() !== "intake") {
      return decodeURIComponent(pathMatch[1]).trim().toUpperCase();
    }
  } catch {
    /* not a URL */
  }

  const bagMatch = text.match(/BAG-[A-Z0-9]+/i);
  if (bagMatch) return bagMatch[0].toUpperCase();

  if (/^[A-Z0-9_-]{4,64}$/i.test(text)) return text.toUpperCase();
  return "";
}
