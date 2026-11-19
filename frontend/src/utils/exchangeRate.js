import { apiUrl } from "../config/env";
import { endpoints } from "./endpoints";

/** Soft fallback only if every live source fails (market is ~130, not 150). */
const FALLBACK_USD_KES = 130;

const CACHE_TTL_MS = 10 * 60 * 1000;
let memoryCache = { rate: null, source: null, live: false, at: 0 };

function resolveConfiguredUrl() {
  const fromEnv = String(import.meta.env.VITE_EXCHANGE_RATE_API_URL || "").trim();
  if (/^https?:\/\//i.test(fromEnv)) return fromEnv;

  const key = String(import.meta.env.VITE_EXCHANGE_RATE_API_KEY || "").trim();
  if (key) return `https://v6.exchangerate-api.com/v6/${key}/latest/USD`;

  return null;
}

async function readJson(url, { timeoutMs = 8000 } = {}) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const response = await fetch(url, {
      signal: controller?.signal,
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error(`${response.status} ${contentType || "non-json"}`);
    }
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pickKes(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.rate,
    data.conversion_rates?.KES,
    data.rates?.KES,
    data.usd?.kes,
    data.kes,
  ];
  for (const raw of candidates) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 50 && n <= 400) return n;
  }
  return null;
}

async function fromBackend() {
  const url = `${apiUrl(endpoints.fxUsdKes)}?refresh=0`;
  const data = await readJson(url);
  const rate = pickKes(data);
  if (rate == null) throw new Error("backend FX missing KES");
  return {
    rate,
    source: data.source || "backend",
    live: data.live !== false,
  };
}

async function fromConfigured() {
  const apiUrlConfigured = resolveConfiguredUrl();
  if (!apiUrlConfigured) throw new Error("no configured FX url");
  const data = await readJson(apiUrlConfigured);
  const rate = pickKes(data);
  if (rate == null) throw new Error("configured FX missing KES");
  return { rate, source: "configured", live: true };
}

async function fromOpenErApi() {
  const data = await readJson("https://open.er-api.com/v6/latest/USD");
  if (data?.result !== "success") throw new Error("open-er-api failed");
  const rate = pickKes(data);
  if (rate == null) throw new Error("open-er-api missing KES");
  return { rate, source: "open-er-api", live: true };
}

async function fromFrankfurter() {
  const data = await readJson(
    "https://api.frankfurter.app/latest?from=USD&to=KES"
  );
  const rate = pickKes(data);
  if (rate == null) throw new Error("frankfurter missing KES");
  return { rate, source: "frankfurter", live: true };
}

async function fromCurrencyApi() {
  const data = await readJson(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json"
  );
  const rate = pickKes(data);
  if (rate == null) throw new Error("currency-api missing KES");
  return { rate, source: "currency-api", live: true };
}

/**
 * Fetch live USD→KES market rate.
 * Tries Climate Wavers API first, then public market feeds.
 * Returns exact numeric rate from a live source whenever possible.
 */
export async function fetchUsdToKesRateDetailed({ force = false } = {}) {
  const now = Date.now();
  if (
    !force &&
    memoryCache.rate != null &&
    now - memoryCache.at < CACHE_TTL_MS &&
    memoryCache.live
  ) {
    return { ...memoryCache };
  }

  const loaders = [
    fromBackend,
    fromConfigured,
    fromOpenErApi,
    fromFrankfurter,
    fromCurrencyApi,
  ];
  const errors = [];
  for (const load of loaders) {
    try {
      const result = await load();
      if (result?.rate > 0) {
        memoryCache = {
          rate: result.rate,
          source: result.source,
          live: Boolean(result.live),
          at: Date.now(),
        };
        return { ...memoryCache };
      }
    } catch (err) {
      errors.push(String(err?.message || err));
    }
  }

  console.error("All live FX sources failed; using soft fallback", errors);
  memoryCache = {
    rate: FALLBACK_USD_KES,
    source: "fallback",
    live: false,
    at: Date.now(),
  };
  return { ...memoryCache };
}

/**
 * Fetch USD→KES. Prefer live market; soft fallback only if all sources fail.
 */
export async function fetchUsdToKesRate() {
  const { rate } = await fetchUsdToKesRateDetailed();
  return rate;
}

/** KES amount charged at checkout (whole shillings). */
export function usdToKesAmount(usd, rate) {
  const u = Number(usd);
  const r = Number(rate);
  if (!Number.isFinite(u) || !Number.isFinite(r) || r <= 0) return null;
  return Math.round(u * r);
}

export function formatKes(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return `KSh ${Number(amount).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export function formatUsdKesRate(rate) {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  return `1 USD = KSh ${r.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export { FALLBACK_USD_KES };
