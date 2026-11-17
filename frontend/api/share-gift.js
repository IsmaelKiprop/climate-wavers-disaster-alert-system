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

const CLOUDINARY_LOGO_LAYER = "disax:climate-wavers:brand-logo";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cloudinaryBrandedOg(photoUrl) {
  if (!photoUrl) return null;
  let url = String(photoUrl).trim();
  if (url.startsWith("http://")) url = `https://${url.slice(7)}`;
  const match = url.match(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/i
  );
  if (!match) return null;
  const version = match[2].match(/(v\d+\/.+)$/);
  if (!version) return null;
  const transforms = [
    "w_1200,h_630,c_fill,g_auto,q_auto,f_jpg",
    `l_${CLOUDINARY_LOGO_LAYER}/c_scale,w_140,o_92`,
    "fl_layer_apply,g_south_east,x_36,y_32",
  ].join("/");
  return `${match[1]}/${transforms}/${version[1]}`;
}

function absoluteMedia(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${SITE}${value}`;
  return value;
}

function speciesLabel(species) {
  return String(species || "")
    .trim()
    .replace(/\s*trees?\s*$/i, "")
    .trim();
}

function speciesDisplay(species) {
  const label = speciesLabel(species);
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function articleFor(word) {
  return /^[aeiou]/i.test(String(word || "").trim()) ? "an" : "a";
}

function giftTitle({ species, displayName }) {
  const label = speciesDisplay(species);
  // Named recipient → "Buy a … tree for Name" (not "Buy me … for Name").
  if (displayName) {
    const phrase = label
      ? `Buy ${articleFor(label)} ${label} tree`
      : "Buy a tree";
    return `${phrase} for ${displayName} · Climate Wavers`;
  }
  const phrase = label
    ? `Buy me ${articleFor(label)} ${label} tree`
    : "Buy me a tree";
  return `${phrase} · Climate Wavers`;
}

function resolveOgImage(project, profile) {
  const cover =
    project?.cover_image_url ||
    project?.cover_image ||
    project?.image_url ||
    null;
  const photo =
    profile?.profile_picture ||
    profile?.profile_pic ||
    profile?.picture ||
    null;
  const absoluteCover = absoluteMedia(cover);
  const absolutePhoto = absoluteMedia(photo);
  return (
    cloudinaryBrandedOg(absoluteCover) ||
    absoluteCover ||
    cloudinaryBrandedOg(absolutePhoto) ||
    (profile?.og_image && !String(profile.og_image).includes("/og-image/")
      ? profile.og_image
      : null) ||
    absolutePhoto ||
    `${SITE}/og-image.jpg`
  );
}

function buildHtml({ userId, title, description, image, appUrl }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(appUrl);
  const safeApp = escapeHtml(appUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeUrl}" />
  <meta property="og:type" content="website" />
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
  <meta http-equiv="refresh" content="0;url=${safeApp}" />
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <p><a href="${safeApp}">Open gift page</a></p>
  </main>
  <script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ClimateWavers-OG/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(request) {
  try {
    const requestUrl = new URL(request.url);
    const userId = String(
      requestUrl.searchParams.get("id") ||
        requestUrl.searchParams.get("userId") ||
        ""
    ).trim();
    const projectId = String(
      requestUrl.searchParams.get("project") ||
        requestUrl.searchParams.get("projectId") ||
        ""
    ).trim();
    const species = String(requestUrl.searchParams.get("species") || "").trim();
    const nameParam = String(requestUrl.searchParams.get("name") || "").trim();

    if (!/^\d+$/.test(userId)) {
      return new Response("Missing gift user id", { status: 400 });
    }

    const [profile, project] = await Promise.all([
      fetchJson(`/api/v1/users/${userId}/public/`),
      /^\d+$/.test(projectId)
        ? fetchJson(`/api/v1/tree-projects/${projectId}/`)
        : Promise.resolve(null),
    ]);

    const displayName =
      nameParam ||
      profile?.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      profile?.username ||
      "a Climate Wavers member";

    const title = giftTitle({ species, displayName });
    const projectBit = project?.name ? ` via ${project.name}` : "";
    const speciesName = speciesDisplay(species);
    const description = (
      speciesName
        ? `Gift ${articleFor(speciesName)} ${speciesName} tree to ${displayName} on Climate Wavers${projectBit}.`
        : `Gift a tree to ${displayName} on Climate Wavers${projectBit}. Plant verified trees across Africa.`
    ).slice(0, 200);

    const image = resolveOgImage(project, profile);

    const appParams = new URLSearchParams();
    if (nameParam || displayName) appParams.set("name", nameParam || displayName);
    if (projectId) appParams.set("project", projectId);
    if (species) appParams.set("species", species);
    const appUrl = `${SITE}/gift/${userId}${
      appParams.toString() ? `?${appParams}` : ""
    }`;

    return htmlResponse(
      buildHtml({ userId, title, description, image, appUrl }),
      profile || project ? 200 : 404
    );
  } catch {
    return htmlResponse(
      buildHtml({
        userId: "0",
        title: "Buy me a tree · Climate Wavers",
        description: "Gift a verified tree on Climate Wavers.",
        image: `${SITE}/og-image.jpg`,
        appUrl: `${SITE}/app/plant-tree`,
      }),
      500
    );
  }
}
