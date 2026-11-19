import { absoluteAsset, buildOgHtml, escapeHtml } from "./og-pages.js";

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

function resolveOgImage(project) {
  const cover =
    project?.cover_image_url ||
    project?.cover_image ||
    project?.organization_logo_url ||
    null;
  const absolute = absoluteMedia(cover);
  return (
    cloudinaryBrandedOg(absolute) ||
    absolute ||
    absoluteAsset("/docs/plastic-pulse-og.jpg")
  );
}

function looksLikeEmail(value) {
  return String(value || "").includes("@");
}

function orgName(project) {
  const display = (project?.organization_display_name || "").trim();
  if (display && !looksLikeEmail(display)) return display;
  const name = (project?.organization_name || "").trim();
  if (name && !looksLikeEmail(name)) return name;
  return "Climate Wavers partner";
}

export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const projectId = String(
    requestUrl.searchParams.get("id") ||
      requestUrl.searchParams.get("project") ||
      requestUrl.searchParams.get("projectId") ||
      ""
  ).trim();

  if (!/^\d+$/.test(projectId)) {
    return new Response("Missing plastic project id", { status: 400 });
  }

  const pageUrl = `${SITE}/plastic/${projectId}`;
  let project = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(
      `${API_BASE}/api/v1/plastic/projects/${projectId}/`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ClimateWavers-OG/1.0",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (response.ok) {
      project = await response.json();
    }
  } catch {
    project = null;
  }

  const org = orgName(project);
  const place = [project?.city, project?.country].filter(Boolean).join(", ") || "Africa";
  const recovered = Number(project?.recovered_kg || project?.impact?.recovered_kg || 0);
  const goal = Number(project?.goal_kg || project?.impact?.goal_kg || 0);

  const title = project?.name
    ? `${project.name} · Plastic Pulse`
    : "Plastic Pulse · Climate Wavers";

  const descParts = [
    project?.short_description || project?.description || "",
    org ? `Led by ${org}` : "",
    place ? `in ${place}` : "",
    goal > 0
      ? `${recovered.toLocaleString()} / ${goal.toLocaleString()} kg recovered`
      : recovered > 0
        ? `${recovered.toLocaleString()} kg recovered`
        : "Sponsor verified plastic recovery on Climate Wavers.",
  ].filter(Boolean);

  const description = descParts.join(" · ").replace(/\s+/g, " ").trim().slice(0, 200);
  const image = resolveOgImage(project);

  const extraBody = `
    <p style="margin:16px 0 0;font-size:14px;color:#374151;">
      ${escapeHtml(org)}${place ? ` · ${escapeHtml(place)}` : ""}
      ${goal > 0 ? ` · ${escapeHtml(String(recovered))} / ${escapeHtml(String(goal))} kg` : ""}
    </p>
  `;

  const html = buildOgHtml({
    title,
    description:
      description ||
      "Verified plastic recovery, sponsorship, and certificates on Climate Wavers Plastic Pulse.",
    image,
    url: pageUrl,
    type: "article",
    extraBody,
  });

  return new Response(html, {
    status: project ? 200 : 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300",
    },
  });
}
