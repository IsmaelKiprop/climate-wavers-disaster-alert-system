import { client } from "../api";
import { endpoints } from "./endpoints";
import { SITE } from "../config/site";
import { tokenizeRichText } from "./linkify";
import { normalizeOgPath, resolveOgCatalogPage } from "./ogPagesCatalog";

/** First http(s) URLs found in message text (max 3). */
export function extractUrls(text, limit = 3) {
  const parts = tokenizeRichText(text || "");
  const urls = [];
  for (const part of parts) {
    if (part.type !== "url" || !part.href) continue;
    if (urls.includes(part.href)) continue;
    urls.push(part.href);
    if (urls.length >= limit) break;
  }
  return urls;
}

function siteHost() {
  try {
    return new URL(SITE.url).hostname.toLowerCase();
  } catch {
    return "alerts.flowops.africa";
  }
}

function absoluteSiteAsset(pathOrUrl) {
  const value = String(pathOrUrl || "").trim();
  if (!value) return `${SITE.url}/og-image.jpg`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return `${SITE.url}${value.startsWith("/") ? value : `/${value}`}`;
}

/** Client fallback when the Vercel edge preview API is unavailable (local Vite). */
export async function resolveLocalLinkPreview(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== siteHost()) return null;

  const projectMatch = parsed.pathname.match(/^\/p\/(\d+)/);
  if (projectMatch) {
    try {
      const project = await client.run(
        "get",
        `${endpoints.tree_projects}${projectMatch[1]}/`,
        {},
        false,
        false,
        false,
        false
      );
      return {
        url: `${SITE.url}/p/${projectMatch[1]}`,
        title: `${project?.name || "Tree project"} · Climate Wavers`,
        description: String(
          project?.short_description ||
            project?.description ||
            "Tree planting on Climate Wavers."
        ).slice(0, 180),
        image:
          project?.cover_image_url ||
          project?.cover_image ||
          project?.image_url ||
          `${SITE.url}/og-image.jpg`,
        siteName: "Climate Wavers",
      };
    } catch {
      return null;
    }
  }

  const profileMatch = parsed.pathname.match(/^\/u\/(\d+)/);
  if (profileMatch) {
    try {
      const profile = await client.run(
        "get",
        `${endpoints.users}${profileMatch[1]}/public/`,
        {},
        false,
        false,
        false,
        false
      );
      const name =
        profile?.display_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.username ||
        "Member";
      return {
        url: `${SITE.url}/u/${profileMatch[1]}`,
        title: `${name} · Climate Wavers`,
        description: String(
          profile?.bio || "Climate Wavers community member."
        ).slice(0, 180),
        image: profile?.photo || profile?.avatar || `${SITE.url}/og-image.jpg`,
        siteName: "Climate Wavers",
      };
    } catch {
      return null;
    }
  }

  const path = normalizeOgPath(parsed.pathname || "/");
  const known = resolveOgCatalogPage(path);
  return {
    url: `${SITE.url}${known.path === "/" ? "" : known.path}`,
    title: known.title,
    description: known.description,
    image: absoluteSiteAsset(known.image),
    siteName: "Climate Wavers",
  };
}
