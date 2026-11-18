export const config = {
  runtime: "edge",
};

const SITE = (
  process.env.VITE_SITE_URL || "https://alerts.flowops.africa"
).replace(/\/+$/, "");

const API_BASE = (
  process.env.VITE_APP_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://climate-wavers-api.onrender.com"
).replace(/\/+$/, "");

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function metaContent(html, property) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function titleTag(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || "";
}

function absoluteUrl(maybeRelative, base) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return "";
  }
}

function isBlockedHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1)/.test(host)) return true;
  return false;
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ClimateWavers-LinkPreview/1.0",
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

async function previewClimateWavers(urlObj) {
  const path = urlObj.pathname || "";

  const projectMatch = path.match(/^\/p\/(\d+)/);
  if (projectMatch) {
    const project = await fetchJson(`/api/v1/tree-projects/${projectMatch[1]}/`);
    if (!project) return null;
    const image =
      project.cover_image_url || project.cover_image || project.image_url || `${SITE}/og-image.jpg`;
    return {
      url: `${SITE}/p/${projectMatch[1]}`,
      title: `${project.name || "Tree project"} · Climate Wavers`,
      description: String(
        project.short_description || project.description || "Tree planting on Climate Wavers."
      ).slice(0, 180),
      image: absoluteUrl(image, SITE),
      siteName: "Climate Wavers",
    };
  }

  const profileMatch = path.match(/^\/u\/(\d+)/);
  if (profileMatch) {
    const profile = await fetchJson(`/api/v1/users/${profileMatch[1]}/public/`);
    if (!profile) return null;
    const name =
      profile.display_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      profile.username ||
      "Member";
    const image = profile.photo || profile.avatar || `${SITE}/og-image.jpg`;
    return {
      url: `${SITE}/u/${profileMatch[1]}`,
      title: `${name} · Climate Wavers`,
      description: String(profile.bio || "Climate Wavers community member.").slice(0, 180),
      image: absoluteUrl(image, SITE),
      siteName: "Climate Wavers",
    };
  }

  const giftMatch = path.match(/^\/gift\/(\d+)/);
  if (giftMatch) {
    const profile = await fetchJson(`/api/v1/users/${giftMatch[1]}/public/`);
    const name =
      profile?.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      profile?.username ||
      "a Climate Wavers member";
    return {
      url: `${SITE}/gift/${giftMatch[1]}`,
      title: `Gift trees to ${name}`,
      description: "Plant a tree for someone on Climate Wavers.",
      image: absoluteUrl(profile?.photo || profile?.avatar || `${SITE}/og-image.jpg`, SITE),
      siteName: "Climate Wavers",
    };
  }

  return null;
}

async function previewExternal(targetUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ClimateWavers-LinkPreview/1.0",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        url: targetUrl,
        title: new URL(targetUrl).hostname,
        description: "",
        image: "",
        siteName: new URL(targetUrl).hostname,
      };
    }
    const html = (await response.text()).slice(0, 250_000);
    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      titleTag(html) ||
      new URL(targetUrl).hostname;
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description") ||
      metaContent(html, "description") ||
      "";
    const image = absoluteUrl(
      metaContent(html, "og:image") || metaContent(html, "twitter:image") || "",
      targetUrl
    );
    const siteName =
      metaContent(html, "og:site_name") || new URL(targetUrl).hostname;
    return {
      url: targetUrl,
      title: title.slice(0, 120),
      description: description.slice(0, 180),
      image,
      siteName: siteName.slice(0, 80),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const requestUrl = new URL(request.url);
    const raw = String(requestUrl.searchParams.get("url") || "").trim();
    if (!raw) return json({ error: "Missing url" }, 400);

    let target;
    try {
      target = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    } catch {
      return json({ error: "Invalid url" }, 400);
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return json({ error: "Unsupported protocol" }, 400);
    }
    if (isBlockedHost(target.hostname)) {
      return json({ error: "Host not allowed" }, 400);
    }

    const siteHost = new URL(SITE).hostname.toLowerCase();
    if (target.hostname.toLowerCase() === siteHost) {
      const local = await previewClimateWavers(target);
      if (local) return json(local);
    }

    const external = await previewExternal(target.toString());
    if (!external) {
      return json({
        url: target.toString(),
        title: target.hostname,
        description: "",
        image: "",
        siteName: target.hostname,
      });
    }
    return json(external);
  } catch {
    return json({ error: "Preview failed" }, 500);
  }
}
