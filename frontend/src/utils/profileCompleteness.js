import { env } from "../config/env";

const hasText = (value) => Boolean(String(value || "").trim());

const isRealPhoto = (user) => {
  const raw =
    user?.profile_picture || user?.profile_pic || user?.picture || "";
  if (!hasText(raw)) return false;
  const value = String(raw).toLowerCase();
  if (value.includes("avatar.png")) return false;
  if (value.includes("default") && value.includes("avatar")) return false;
  return true;
};

export function getProfileCompleteness(user) {
  const checks = [
    { key: "name", label: "Full name", done: hasText(user?.first_name) && hasText(user?.last_name) },
    { key: "username", label: "Username", done: hasText(user?.username) },
    { key: "photo", label: "Profile photo", done: isRealPhoto(user) },
    { key: "bio", label: "Bio", done: hasText(user?.bio) },
    {
      key: "place",
      label: "Location",
      done: hasText(user?.country) || hasText(user?.location) || hasText(user?.state),
    },
  ];
  const completed = checks.filter((item) => item.done).length;
  const isComplete = checks.every((item) => item.done);
  return {
    checks,
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
    isComplete,
  };
}

function siteOrigin() {
  const configured = String(env.siteUrl || "").replace(/\/+$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://alerts.flowops.africa";
}

export function profileAppUrl(userId) {
  return `${siteOrigin()}/u/${userId}`;
}

/**
 * WhatsApp/Facebook share link.
 * /u/:id for people; crawlers are rewritten on Vercel to /api/share-profile
 * which returns that user's OG title, bio, and photo.
 */
export function profileOgShareUrl(userId) {
  // Cache-buster so WhatsApp re-scrapes after OG / logo-blend updates.
  return `${siteOrigin()}/u/${userId}?v=og4`;
}

/** Cloudinary overlay public_id (slashes → colons). */
const CLOUDINARY_LOGO_LAYER = "disax:climate-wavers:brand-logo";

/**
 * Same branded 1200×630 image crawlers use (photo/cover + Climate Wavers logo).
 * Falls back to the raw URL when not on Cloudinary.
 */
export function brandedOgPreviewImage(photoUrl, fallback = "/og-image.jpg") {
  if (!photoUrl) return fallback;
  let url = String(photoUrl).trim();
  if (url.startsWith("http://")) url = `https://${url.slice(7)}`;
  const match = url.match(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/i
  );
  if (!match) return url || fallback;
  const version = match[2].match(/(v\d+\/.+)$/);
  if (!version) return url || fallback;
  const transforms = [
    "w_1200,h_630,c_fill,g_auto,q_auto,f_jpg",
    `l_${CLOUDINARY_LOGO_LAYER}/c_scale,w_140,o_92`,
    "fl_layer_apply,g_south_east,x_36,y_32",
  ].join("/");
  return `${match[1]}/${transforms}/${version[1]}`;
}

/** @deprecated prefer brandedOgPreviewImage */
export function profileOgPreviewImage(photoUrl, fallback = "/og-image.jpg") {
  return brandedOgPreviewImage(photoUrl, fallback);
}

/** Human-facing project page. */
export function projectAppUrl(projectId) {
  return `${siteOrigin()}/p/${projectId}`;
}

/**
 * WhatsApp/Facebook share link for a tree project.
 * Bots are rewritten on Vercel to /api/share-project (cover + logo OG).
 */
export function projectOgShareUrl(projectId) {
  return `${siteOrigin()}/p/${projectId}?v=og1`;
}

/**
 * @param {string|number} userId
 * @param {string} [displayName]
 * @param {{ projectId?: string|number, species?: string }} [opts]
 */
function giftQuery(displayName = "", opts = {}) {
  const params = new URLSearchParams();
  if (displayName) params.set("name", displayName);
  if (opts?.projectId) params.set("project", String(opts.projectId));
  if (opts?.species) params.set("species", String(opts.species));
  return params;
}

/** In-app gift page path (SPA). */
export function giftTreesPath(userId, displayName = "", opts = {}) {
  const params = giftQuery(displayName, opts);
  const query = params.toString();
  return `/gift/${userId}${query ? `?${query}` : ""}`;
}

/**
 * External / WhatsApp share URL.
 * Uses /share/gift so crawlers get project cover + Climate Wavers logo OG.
 */
export function giftOgSharePath(userId, displayName = "", opts = {}) {
  const params = giftQuery(displayName, opts);
  // Cache-buster so WhatsApp re-scrapes after OG / copy updates.
  params.set("v", "gift2");
  const query = params.toString();
  return `/share/gift/${userId}${query ? `?${query}` : ""}`;
}

/** Absolute gift link for QR codes and external sharing (OG-ready). */
export function giftTreesUrl(userId, displayName = "", opts = {}) {
  return `${siteOrigin()}${giftOgSharePath(userId, displayName, opts)}`;
}

/** "Mangrove Tree" → "mangrove" */
export function speciesShareLabel(species) {
  const raw = String(species || "")
    .trim()
    .replace(/\s*trees?\s*$/i, "")
    .trim();
  return raw || "tree";
}

function indefiniteArticle(word) {
  return /^[aeiou]/i.test(String(word || "").trim()) ? "an" : "a";
}

/**
 * Own ask (first person): "Buy me a Bruguiera tree on Climate Wavers!"
 * Someone else (third person): "Buy a Bruguiera tree for Ismael Kiprop on Climate Wavers!"
 * Never mixes "Buy me … for Name".
 */
export function buyMeTreeShareText(species, displayName = "", { firstPerson = false } = {}) {
  const name = String(displayName || "").trim();
  const useFirstPerson = firstPerson || !name;
  const raw = speciesShareLabel(species);
  const label = raw
    ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    : "";
  const isGeneric = !species || label.toLowerCase() === "tree";
  if (useFirstPerson) {
    const phrase = isGeneric
      ? "Buy me a tree"
      : `Buy me ${indefiniteArticle(label)} ${label} tree`;
    return `${phrase} on Climate Wavers! 🌱`;
  }
  const phrase = isGeneric
    ? "Buy a tree"
    : `Buy ${indefiniteArticle(label)} ${label} tree`;
  return `${phrase} for ${name} on Climate Wavers! 🌱`;
}

/**
 * Species options grouped by project (for Buy me a tree picker).
 * @returns {{
 *   projectId: number,
 *   projectName: string,
 *   cover?: string,
 *   country?: string,
 *   species: { key: string, species: string, label: string, projectId: number, projectName: string, cover?: string, country?: string, projectOnly?: boolean }[]
 * }[]}
 */
export function collectSpeciesByProject(projects = []) {
  const groups = [];
  for (const project of projects || []) {
    if (!project?.id) continue;
    const list = Array.isArray(project?.tree_species)
      ? project.tree_species
      : [];
    const cover =
      project?.cover_image_url || project?.cover_image || project?.image_url || "";
    const projectName = project.name || "";
    const country = project.country || "";
    const species = [];
    const seen = new Set();

    for (const raw of list) {
      const name =
        typeof raw === "string"
          ? String(raw || "").trim()
          : String(raw?.name || raw?.species || raw?.label || "").trim();
      if (!name) continue;
      const speciesKey = name.toLowerCase();
      if (seen.has(speciesKey)) continue;
      seen.add(speciesKey);
      species.push({
        key: `p${project.id}-${speciesKey}`,
        species: name,
        label: name,
        projectId: project.id,
        projectName,
        cover,
        country,
      });
    }

    if (!species.length) {
      species.push({
        key: `project-${project.id}`,
        species: "",
        label: projectName || "Tree project",
        projectId: project.id,
        projectName,
        cover,
        country,
        projectOnly: true,
      });
    }

    groups.push({
      projectId: project.id,
      projectName,
      cover,
      country,
      species,
    });
  }

  return groups.sort((a, b) =>
    String(a.projectName).localeCompare(String(b.projectName))
  );
}

/**
 * Flat unique species options (project-scoped keys). Prefer collectSpeciesByProject for UI.
 */
export function collectSpeciesOptions(projects = []) {
  return collectSpeciesByProject(projects).flatMap((g) => g.species);
}

export const CHAT_SHARE_DRAFT_KEY = "cw_chat_share_draft";

export function stashChatShareDraft(message) {
  try {
    sessionStorage.setItem(CHAT_SHARE_DRAFT_KEY, String(message || ""));
  } catch {
    /* ignore */
  }
}
