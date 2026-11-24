export const config = { runtime: "edge" };

const API_BASE = (
  process.env.VITE_APP_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://climate-wavers-api.onrender.com"
).replace(/\/+$/, "");

const SITE = (process.env.VITE_SITE_URL || "https://alerts.flowops.africa").replace(/\/+$/, "");
const PREVIEW_BOT = /(whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|embedly|pinterest|quora link preview|googlebot|bingbot|applebot|yandexbot|duckduckbot|bot|crawler|spider)/i;

function isPreviewBot(request) {
  const userAgent = String(request.headers.get("user-agent") || "");
  if (/Mozilla\//i.test(userAgent)) return false;
  return PREVIEW_BOT.test(userAgent);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteMedia(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https:\/\//i.test(url)) return url;
  if (/^http:\/\//i.test(url)) return `https://${url.slice(7)}`;
  if (url.startsWith("//")) return `https:${url}`;
  try {
    const parsed = new URL(url, `${API_BASE}/`);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function firstImage(value) {
  if (Array.isArray(value)) return value[0] || "";
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed[0] || "";
    } catch {
      // Keep older non-JSON image strings as a single URL.
    }
  }
  return raw;
}

function html({ id, title, description, image, video }) {
  const pageUrl = `${SITE}/share/post/${id}`;
  const appUrl = `${SITE}/app/post/${id}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(pageUrl);
  const safeVideo = escapeHtml(video);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title><meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeUrl}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Climate Wavers">
<meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeUrl}">
${safeImage ? `<meta property="og:image" content="${safeImage}"><meta property="og:image:secure_url" content="${safeImage}"><meta property="og:image:alt" content="${safeTitle}">` : ""}
<meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">${safeImage ? `<meta name="twitter:image" content="${safeImage}">` : ""}
${safeVideo ? `<meta property="og:video" content="${safeVideo}"><meta property="og:video:secure_url" content="${safeVideo}">` : ""}
</head><body><main><h1>${safeTitle}</h1><p>${safeDescription}</p><p><a href="${escapeHtml(appUrl)}">Open post on Climate Wavers</a></p></main></body></html>`;
}

export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const id = String(requestUrl.searchParams.get("id") || "").trim();
  if (!/^\d+$/.test(id)) return new Response("Missing post id", { status: 400 });
  if (!isPreviewBot(request)) return Response.redirect(`${SITE}/app/post/${id}`, 302);

  let post = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${API_BASE}/api/v1/post/${id}/`, {
      headers: { Accept: "application/json", "User-Agent": "ClimateWavers-OG/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (response.ok) post = await response.json();
  } catch {
    post = null;
  }

  if (!post || String(post.visibility || "Everyone") !== "Everyone") {
    return new Response("Post not found", { status: 404 });
  }

  const author = [post.user?.first_name, post.user?.last_name].filter(Boolean).join(" ") || post.user?.username || "Climate Wavers member";
  const text = String(post.content || "")
    .replace(/\uFFFD/g, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const title = `${author} on Climate Wavers`;
  const description = (text || "A community update on Climate Wavers.").slice(0, 200);
  const image = absoluteMedia(firstImage(post.image) || post.gif);
  const video = absoluteMedia(post.video);

  return new Response(html({ id, title, description, image, video }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
