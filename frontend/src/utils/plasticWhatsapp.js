/**
 * Guest / collector WhatsApp helpers — opens wa.me (user still taps Send).
 */

export function normalizeWaPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 9) {
    digits = `254${digits.replace(/^0+/, "")}`;
  } else if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) {
    digits = `254${digits}`;
  }
  return digits;
}

export function buildPlasticWhatsappUrl({ phone, text }) {
  const digits = normalizeWaPhone(phone);
  const encoded = encodeURIComponent(String(text || "").trim());
  if (digits) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

export function bagSubmittedWhatsappText({
  name,
  bagId,
  kg,
  polymerType,
  projectName,
  projectUrl,
}) {
  const who = name ? `${name}, ` : "";
  return (
    `${who}your Climate Wavers Plastic Pulse bag was submitted.\n\n` +
    `Bag: ${bagId || "—"}\n` +
    `Weight: ${kg != null ? `${kg} kg` : "—"}${polymerType ? ` · ${polymerType}` : ""}\n` +
    `Project: ${projectName || "Plastic Pulse"}\n` +
    (projectUrl ? `\nTrack / share: ${projectUrl}\n` : "\n") +
    `Next: CBO verifies → recycler scans the bag QR → certificate.`
  );
}

export function certificateWhatsappText({
  name,
  bagId,
  kg,
  certificateCode,
  verifyUrl,
  projectName,
}) {
  const who = name ? `${name}, ` : "";
  const absVerify =
    verifyUrl && verifyUrl.startsWith("http")
      ? verifyUrl
      : verifyUrl
        ? `${typeof window !== "undefined" ? window.location.origin : ""}${verifyUrl}`
        : "";
  return (
    `${who}your Climate Wavers Plastic Pulse certificate is ready.\n\n` +
    `Certificate: ${certificateCode || "—"}\n` +
    `Bag: ${bagId || "—"}\n` +
    `Verified: ${kg != null ? `${kg} kg` : "—"}\n` +
    `Project: ${projectName || "Plastic Pulse"}\n` +
    (absVerify ? `\nView / share: ${absVerify}` : "")
  );
}

/**
 * Open WhatsApp with prefilled text. Returns the URL (for fallback button if popup blocked).
 */
export function openPlasticWhatsapp({ phone, text }) {
  const url = buildPlasticWhatsappUrl({ phone, text });
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      // Popup blocked — navigate same tab as last resort for mobile.
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
  return url;
}
