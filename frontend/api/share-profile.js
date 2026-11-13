export const config = {
  runtime: "edge",
};

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

function buildHtml({ userId, title, description, image }) {
  const url = `${SITE}/u/${userId}`;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Climate Wavers" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${safeUrl}">Open profile</a></p>
  </main>
</body>
</html>`;
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}

export default async function handler(request) {
  try {
    const requestUrl = new URL(request.url);
    const userId = String(
      requestUrl.searchParams.get("id") ||
        requestUrl.searchParams.get("userId") ||
        ""
    ).trim();

    if (!/^\d+$/.test(userId)) {
      return new Response("Missing profile id", { status: 400 });
    }

    let profile = null;
    try {
      const response = await fetch(`${API_BASE}/api/v1/users/${userId}/public/`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ClimateWavers-OG/1.0",
        },
      });
      if (response.ok) {
        profile = await response.json();
      }
    } catch {
      profile = null;
    }

    const title = profile
      ? `${profile.display_name || profile.username || "Member"} (@${
          profile.username || "user"
        }) on Climate Wavers`
      : "Climate Wavers profile";
    const description =
      (profile && profile.bio) ||
      "Climate action profile on Climate Wavers. Gift a tree to support their impact.";
    const image =
      (profile && (profile.og_image || profile.profile_picture)) ||
      `${API_BASE}/api/v1/users/${userId}/og-image/`;

    return htmlResponse(
      buildHtml({ userId, title, description, image }),
      profile ? 200 : 404
    );
  } catch {
    return htmlResponse(
      buildHtml({
        userId: "0",
        title: "Climate Wavers",
        description: "Disaster alerts and climate action.",
        image: `${SITE}/og-image.jpg`,
      }),
      500
    );
  }
}
