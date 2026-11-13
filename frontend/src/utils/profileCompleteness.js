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
 * Same branded 1200×630 image crawlers use (photo + Climate Wavers logo).
 * Falls back to the raw photo when not on Cloudinary.
 */
export function profileOgPreviewImage(photoUrl, fallback = "/og-image.jpg") {
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

export function giftTreesPath(userId, displayName = "") {
  const params = new URLSearchParams();
  if (displayName) params.set("name", displayName);
  const query = params.toString();
  return `/gift/${userId}${query ? `?${query}` : ""}`;
}

/** Absolute gift link for QR codes and external sharing. */
export function giftTreesUrl(userId, displayName = "") {
  return `${siteOrigin()}${giftTreesPath(userId, displayName)}`;
}
