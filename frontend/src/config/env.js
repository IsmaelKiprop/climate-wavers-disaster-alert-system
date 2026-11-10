function trimSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

const isDev = import.meta.env.DEV;
const PRODUCTION_API = "https://climate-wavers-api.onrender.com";
const PRODUCTION_CHATBOT = "https://climate-wavers-response.onrender.com";
const PRODUCTION_MODELS = "https://climate-wavers-models.onrender.com";

const backendUrl = trimSlash(
  import.meta.env.VITE_APP_BACKEND_URL || (isDev ? "" : PRODUCTION_API)
);
const chatbotUrl = trimSlash(
  import.meta.env.VITE_APP_CHATBOT_URL || PRODUCTION_CHATBOT
);

export const env = {
  isDev,
  backendEnabled: import.meta.env.VITE_APP_BACKEND_STATUS !== "false",
  domain:
    import.meta.env.VITE_DOMAIN ||
    (typeof window !== "undefined" ? window.location.hostname : "localhost"),
  backendUrl,
  chatbotUrl,
  modelsUrl: trimSlash(import.meta.env.VITE_APP_MODELS_URL || PRODUCTION_MODELS),
  siteUrl: trimSlash(
    import.meta.env.VITE_SITE_URL ||
      (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? window.location.origin
        : "https://alerts.flowops.africa")
  ),
};

export function apiUrl(path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${env.backendUrl}${normalized}`;
}

export function chatbotApiUrl(path = "") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${env.chatbotUrl}${normalized}`;
}

export function mediaUrl(url) {
  if (!url) return "";
  let value = String(url).trim();
  // Avoid mixed-content warnings for legacy http:// Cloudinary / CDN URLs.
  if (value.startsWith("http://")) {
    value = `https://${value.slice(7)}`;
  }
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) {
    return value;
  }
  if (value.startsWith("/")) {
    return `${env.backendUrl}${value}`;
  }
  return value;
}

export function wsHttpUrl(path = "") {
  const explicit = trimSlash(import.meta.env.VITE_WSS_BACKEND || "");
  const base = explicit || env.backendUrl;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function notificationsSocketUrl(token = "") {
  const path = `/ws/notifications/?token=${encodeURIComponent(token || "")}`;
  const explicit = trimSlash(import.meta.env.VITE_WSS_BACKEND || "");
  const httpBase = explicit || env.backendUrl;
  if (httpBase) {
    return `${httpBase.replace(/^http/i, "ws")}${path}`;
  }
  if (typeof window === "undefined") return `ws://localhost:8000${path}`;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}
