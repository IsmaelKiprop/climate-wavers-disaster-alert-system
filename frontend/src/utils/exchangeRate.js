const FALLBACK_USD_KES = 150;

function resolveExchangeRateUrl() {
  const fromEnv = String(import.meta.env.VITE_EXCHANGE_RATE_API_URL || "").trim();
  if (/^https?:\/\//i.test(fromEnv)) return fromEnv;

  const key = String(import.meta.env.VITE_EXCHANGE_RATE_API_KEY || "").trim();
  if (key) return `https://v6.exchangerate-api.com/v6/${key}/latest/USD`;

  return null;
}

/**
 * Fetch USD→KES. Never parses HTML SPA fallbacks as JSON.
 * Returns a numeric rate (API or approximate fallback).
 */
export async function fetchUsdToKesRate() {
  const apiUrl = resolveExchangeRateUrl();
  if (!apiUrl) return FALLBACK_USD_KES;

  try {
    const response = await fetch(apiUrl);
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error(
        `Exchange rate API returned ${response.status} (${contentType || "unknown type"})`
      );
    }

    const data = await response.json();
    const rate = data?.conversion_rates?.KES;
    if (data?.result === "success" && typeof rate === "number" && rate > 0) {
      return rate;
    }
    throw new Error("Invalid exchange rate payload");
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
    return FALLBACK_USD_KES;
  }
}

export { FALLBACK_USD_KES };
