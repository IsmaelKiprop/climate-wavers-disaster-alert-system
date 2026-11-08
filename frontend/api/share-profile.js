/**
 * Serves user-specific Open Graph HTML for WhatsApp/Facebook.
 * Fetches Django share page with the API Host header (Vercel external
 * rewrites forward alerts.flowops.africa and Django returns 400).
 */
const API_BASE = (
  process.env.VITE_APP_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://climate-wavers-api.onrender.com"
).replace(/\/+$/, "");

const SITE = (
  process.env.VITE_SITE_URL || "https://alerts.flowops.africa"
).replace(/\/+$/, "");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fallbackHtml(userId, title, description, image) {
  const url = `${SITE}/u/${userId}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Climate Wavers" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body><p><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></p></body>
</html>`;
}

module.exports = async function handler(req, res) {
  const userId = String(req.query.id || req.query.userId || "").trim();
  if (!/^\d+$/.test(userId)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing profile id");
    return;
  }

  const crawlerUa = req.headers["user-agent"] || "WhatsApp/2.0";

  try {
    const upstream = await fetch(`${API_BASE}/share/profile/${userId}/`, {
      headers: {
        Accept: "text/html",
        "User-Agent": crawlerUa,
      },
      redirect: "follow",
    });

    if (upstream.ok) {
      let html = await upstream.text();
      // Prefer /u/:id as the public share URL in previews.
      const profileUrl = `${SITE}/u/${userId}`;
      html = html
        .split(`${SITE}/share/profile/${userId}`)
        .join(profileUrl)
        .split(`https://climate-wavers-api.onrender.com/share/profile/${userId}/`)
        .join(profileUrl);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=120, stale-while-revalidate=600"
      );
      res.end(html);
      return;
    }
  } catch {
    // Fall through to JSON public profile.
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/users/${userId}/public/`, {
      headers: { Accept: "application/json", "User-Agent": "ClimateWavers-OG/1.0" },
    });
    const profile = response.ok ? await response.json() : null;
    const title = profile
      ? `${profile.display_name || profile.username} (@${profile.username}) on Climate Wavers`
      : "Climate Wavers profile";
    const description =
      profile?.bio ||
      "Climate action profile on Climate Wavers. Gift a tree to support their impact.";
    const image =
      profile?.profile_picture || `${SITE}/og-image.jpg`;

    res.statusCode = profile ? 200 : 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=120, stale-while-revalidate=600"
    );
    res.end(fallbackHtml(userId, title, description, image));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      fallbackHtml(
        userId,
        "Climate Wavers",
        "Disaster alerts and climate action.",
        `${SITE}/og-image.jpg`
      )
    );
  }
};
