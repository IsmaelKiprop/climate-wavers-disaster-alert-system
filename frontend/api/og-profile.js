/**
 * Fallback OG HTML if /api/og-profile is hit directly.
 * Preferred path: /share/profile/:id (proxied to Django in vercel.json).
 */
const API =
  process.env.VITE_APP_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://climate-wavers-api.onrender.com";
const SITE = (process.env.VITE_SITE_URL || "https://alerts.flowops.africa").replace(
  /\/+$/,
  ""
);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  try {
    const userId = req.query.id || req.query.userId;
    if (!userId) {
      res.statusCode = 400;
      res.end("Missing profile id");
      return;
    }

    // Prefer the proven Django share HTML.
    const upstream = await fetch(
      `${API.replace(/\/+$/, "")}/share/profile/${userId}/`,
      {
        headers: {
          "User-Agent": req.headers["user-agent"] || "ClimateWavers-OG/1.0",
        },
      }
    );
    const html = await upstream.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.statusCode = upstream.status;
    res.end(html);
  } catch (error) {
    const message = escapeHtml(error?.message || "OG preview failed");
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!DOCTYPE html><html><head><title>Climate Wavers</title>
<meta property="og:title" content="Climate Wavers" />
<meta property="og:description" content="Disaster alerts and climate action." />
<meta property="og:image" content="${SITE}/og-image.jpg" />
</head><body><p>${message}</p></body></html>`
    );
  }
};
