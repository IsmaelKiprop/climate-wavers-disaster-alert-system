function trimSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

const isDev = import.meta.env.DEV;
const PRODUCTION_API = "https://climate-wavers-api.onrender.com";
const PRODUCTION_CHATBOT = "https://climate-wavers-response.onrender.com";

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
  siteUrl: trimSlash(
    import.meta.env.VITE_SITE_URL ||
      (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? window.location.origin
        : "https://climatewavers.org")
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
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${env.backendUrl}${url}`;
  }
  return url;
}

export function wsHttpUrl(path = "") {
  const explicit = trimSlash(import.meta.env.VITE_WSS_BACKEND || "");
  const base = explicit || env.backendUrl;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
