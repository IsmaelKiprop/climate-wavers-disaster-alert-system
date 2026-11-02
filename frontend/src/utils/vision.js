import { env } from "../config/env";

const LABEL_TO_TYPE = [
  { match: /water|flood|sea/i, type: "Floods" },
  { match: /wild\s*fire|urban fire|fire/i, type: "Wildfire" },
  { match: /earthquake/i, type: "Earthquake" },
  { match: /drought/i, type: "Drought" },
  { match: /land\s*slide/i, type: "Landslide" },
  { match: /storm|hurricane|typhoon/i, type: "Storm" },
];

export function typeFromVision(label = "") {
  const found = LABEL_TO_TYPE.find((row) => row.match.test(label));
  return found ? found.type : "";
}

export async function recognizeReportImage(file) {
  const form = new FormData();
  form.append("image", file);
  const response = await fetch(`${env.modelsUrl}/api/v1/recognition/inference`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Computer vision could not read this photo.");
  }
  const label = payload.label || String(payload.inference || "").replace(/^AI detected\s+/i, "");
  return {
    inference: payload.inference || (label ? `AI detected ${label}` : ""),
    label,
    suggestedType: typeFromVision(label),
  };
}
