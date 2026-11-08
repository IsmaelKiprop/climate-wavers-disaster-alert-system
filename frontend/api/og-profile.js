/**
 * Crawler-only OG HTML for /u/:id so WhatsApp/Facebook previews show
 * alerts.flowops.africa (not the Render API host).
 */
const API =
  process.env.VITE_APP_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://climate-wavers-api.onrender.com";
const SITE = process.env.VITE_SITE_URL || "https://alerts.flowops.africa";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  const userId = req.query.id || req.query.userId;
  if (!userId) {
    res.statusCode = 400;
    res.end("Missing profile id");
    return;
  }

  let profile = null;
  try {
    const response = await fetch(`${API.replace(/\/+$/, "")}/api/v1/users/${userId}/public/`);
    if (response.ok) profile = await response.json();
  } catch {
    profile = null;
  }

  const displayName = escapeHtml(
    profile?.display_name || profile?.username || "Climate Wavers member"
  );
  const username = escapeHtml(profile?.username || "member");
  const description = escapeHtml(
    profile?.bio ||
      "Climate action profile on Climate Wavers. Gift a tree to support their impact."
  );
  const image = escapeHtml(
    profile?.profile_picture || `${SITE}/og-image.jpg`
  );
  const canonical = escapeHtml(`${SITE.replace(/\/+$/, "")}/u/${userId}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${displayName} (@${username}) on Climate Wavers</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Climate Wavers" />
  <meta property="og:title" content="${displayName} (@${username}) on Climate Wavers" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${displayName} (@${username}) on Climate Wavers" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${canonical}" />
</head>
<body>
  <p>Open <a href="${canonical}">${displayName}</a> on Climate Wavers.</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.statusCode = profile ? 200 : 404;
  res.end(html);
};
