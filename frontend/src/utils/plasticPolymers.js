/** SPI resin ID codes 1–7 plus mixed/other for Plastic Pulse pickers. */
export const PLASTIC_POLYMERS = [
  "PET",
  "HDPE",
  "PVC",
  "LDPE",
  "PP",
  "PS",
  "PC",
  "mixed",
  "other",
];

/** Polymers typically bought by recyclers (excludes mixed/other). */
export const RECYCLER_MATERIALS = [
  "PET",
  "HDPE",
  "PVC",
  "LDPE",
  "PP",
  "PS",
  "PC",
];

/** SPI recycling triangle code + short label for certificates. */
export function polymerResinCode(polymer) {
  const key = String(polymer || "").toUpperCase();
  if (key.includes("PET")) return { code: "1", label: "PET" };
  if (key.includes("HDPE")) return { code: "2", label: "HDPE" };
  if (key.includes("PVC")) return { code: "3", label: "PVC" };
  if (key.includes("LDPE")) return { code: "4", label: "LDPE" };
  if (key === "PP" || key.includes("PP")) return { code: "5", label: "PP" };
  if (key.includes("PS")) return { code: "6", label: "PS" };
  if (key === "PC" || key.includes("POLYCARBONATE")) {
    return { code: "7", label: "PC" };
  }
  if (key.includes("MIX")) return { code: "7", label: "OTHER" };
  return { code: "7", label: key || "OTHER" };
}
