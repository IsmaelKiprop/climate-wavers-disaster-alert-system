/**
 * Per-route Open Graph catalog for crawler share HTML and in-app link previews.
 * Prefer a themed image per page — do not fall back everything to /og-image.jpg.
 */

export const SITE = (
  process.env.VITE_SITE_URL || "https://alerts.flowops.africa"
).replace(/\/+$/, "");

/** Normalize pathname: no trailing slash except root. */
export function normalizePath(raw) {
  let path = String(raw || "/").split("?")[0].split("#")[0].trim() || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/**
 * @typedef {{ title: string, description: string, image: string, type?: string }} OgPage
 */

/** @type {Record<string, OgPage>} */
export const OG_PAGES = {
  "/": {
    title: "Climate Wavers: Disaster Alerts & Climate Action",
    description:
      "Real-time USGS and NASA disaster alerts, community response, and climate action. Built in Nairobi to verify hazards instead of amplifying rumors.",
    image: "/og-image.jpg",
    type: "website",
  },
  "/plastic-pulse": {
    title: "Plastic Pulse — Climate Wavers partner onboarding",
    description:
      "Verified plastic recovery for CBOs, youth groups, recyclers, and sponsors. GPS proof, live kg, certificates, and sponsor-a-kilo on Climate Wavers.",
    image: "/docs/plastic-pulse-og.jpg",
    type: "article",
  },
  "/about": {
    title: "About Climate Wavers",
    description:
      "Climate Wavers is the live disaster platform from FlowOps Africa in Nairobi. Official feeds now. Verified alerts as the endgame.",
    image: "/climate-action-network.jpg",
    type: "website",
  },
  "/impact": {
    title: "Impact · Climate Wavers",
    description:
      "Live USGS and NASA events plus tree-planting records currently shown on Climate Wavers.",
    image: "/environment.jpg",
    type: "website",
  },
  "/faq": {
    title: "FAQ · Climate Wavers",
    description:
      "Answers about live USGS and NASA data, FlowOps research, accounts, and tree campaigns.",
    image: "/og-image.jpg",
    type: "website",
  },
  "/contact": {
    title: "Contact Climate Wavers",
    description: "Reach the Climate Wavers team for partnerships, support, and climate action.",
    image: "/community-respond.jpg",
    type: "website",
  },
  "/pricing": {
    title: "Pricing · Climate Wavers",
    description: "Plans and pricing for Climate Wavers disaster alerts, community tools, and climate action.",
    image: "/og-image.jpg",
    type: "website",
  },
  "/consulting": {
    title: "Consulting · Climate Wavers",
    description: "FlowOps Africa consulting for disaster systems, climate data, and community platforms.",
    image: "/ai-disaster.jpg",
    type: "website",
  },
  "/support": {
    title: "Support · Climate Wavers",
    description: "Get help with Climate Wavers accounts, alerts, tree gifts, and Plastic Pulse.",
    image: "/community-respond.jpg",
    type: "website",
  },
  "/disasters": {
    title: "Live disasters · Climate Wavers",
    description: "Verified and official disaster alerts for Africa — USGS, NASA, and community response.",
    image: "/emergency-response.jpg",
    type: "website",
  },
  "/champions": {
    title: "Climate Champions · Climate Wavers",
    description: "Meet Climate Wavers champions leading local climate action and community response.",
    image: "/climate-action-network.jpg",
    type: "website",
  },
  "/app": {
    title: "Climate Wavers app",
    description: "Open your feed, chats, alerts, calendar, and tree projects on Climate Wavers.",
    image: "/og-image.jpg",
    type: "website",
  },
  "/app/calendar": {
    title: "Climate Calendar · Climate Wavers",
    description:
      "Schedule Climate events, invite collaborators as attendees or co-hosts, and RSVP with your network.",
    image: "/environment.jpg",
    type: "website",
  },
};

export function absoluteAsset(pathOrUrl) {
  const value = String(pathOrUrl || "").trim();
  if (!value) return `${SITE}/og-image.jpg`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `${SITE}${value.startsWith("/") ? value : `/${value}`}`;
}

export function resolveOgPage(rawPath) {
  const path = normalizePath(rawPath);
  if (OG_PAGES[path]) {
    return { path, ...OG_PAGES[path] };
  }
  // Prefix matches for nested public routes that share a section preview
  if (path.startsWith("/disasters/")) {
    return { path, ...OG_PAGES["/disasters"] };
  }
  if (path.startsWith("/app/calendar")) {
    return { path, ...OG_PAGES["/app/calendar"] };
  }
  if (path.startsWith("/app")) {
    return { path, ...OG_PAGES["/app"] };
  }
  if (path.startsWith("/champions")) {
    return { path, ...OG_PAGES["/champions"] };
  }
  // Unknown public page: still branded, but use home OG (last resort)
  return { path, ...OG_PAGES["/"] };
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOgHtml({
  title,
  description,
  image,
  url,
  type = "website",
  extraBody = "",
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(absoluteAsset(image));
  const safeUrl = escapeHtml(url);
  const safeType = escapeHtml(type || "website");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta property="og:type" content="${safeType}" />
  <meta property="og:site_name" content="Climate Wavers" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeUrl}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:secure_url" content="${safeImage}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${safeTitle}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
</head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f3f4f4;color:#111;">
  <main style="max-width:640px;margin:40px auto;padding:24px;background:#fff;border:1px solid #111;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Climate Wavers</p>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${safeTitle}</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#374151;">${safeDescription}</p>
    <p style="margin:0 0 16px;"><img src="${safeImage}" alt="${safeTitle}" width="1200" style="display:block;width:100%;height:auto;border:0;" /></p>
    <p style="margin:0;"><a href="${safeUrl}" style="color:#067d83;font-weight:700;">Open Climate Wavers</a></p>
    ${extraBody}
  </main>
</body>
</html>`;
}
