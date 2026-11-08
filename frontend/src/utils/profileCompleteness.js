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

export function profileAppUrl(userId) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : env.siteUrl;
  return `${origin}/u/${userId}`;
}

/** Prefer API OG URL for WhatsApp/Facebook crawlers; humans redirect to /u/:id */
export function profileOgShareUrl(userId) {
  const backend = (env.backendUrl || "https://climate-wavers-api.onrender.com").replace(
    /\/+$/,
    ""
  );
  return `${backend}/share/profile/${userId}/`;
}

export function giftTreesPath(userId, displayName = "") {
  const params = new URLSearchParams();
  if (displayName) params.set("name", displayName);
  const query = params.toString();
  return `/gift/${userId}${query ? `?${query}` : ""}`;
}
