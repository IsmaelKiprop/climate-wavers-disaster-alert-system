function trimSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

const isDev = import.meta.env.DEV;

const backendUrl = trimSlash(import.meta.env.VITE_APP_BACKEND_URL || "");
const chatbotUrl = trimSlash(import.meta.env.VITE_APP_CHATBOT_URL || "");

if (!isDev && !backendUrl) {
  console.warn(
    "VITE_APP_BACKEND_URL is empty. The UI will call this origin instead of the Django API."
  );
}

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
      (typeof window !== "undefined" ? window.location.origin : "")
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
