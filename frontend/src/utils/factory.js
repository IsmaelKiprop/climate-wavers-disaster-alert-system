import Cookies from "js-cookie";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import { client } from "../api";
import { endpoints } from "./endpoints";
import axios from 'axios';
import { ipinfoKey, ipinfoUrl } from "../config/ipinfo.config";
import { mediaUrl } from "../config/env";

// Global flag to track if locale has been added
if (!window.timeAgoLocaleAdded) {
  TimeAgo.addDefaultLocale(en);
  window.timeAgoLocaleAdded = true;
}

// Create TimeAgo instance after locale is registered
const timeAgo = new TimeAgo("en-US");

export const normalizeUser = (user) => {
  if (!user || typeof user !== "object") return null;
  const source =
    user.user && typeof user.user === "object" && (user.user.id || user.user.pk || user.user.user_id)
      ? { ...user, ...user.user }
      : user;
  const id = source.id ?? source.pk ?? source.user_id;
  if (id == null || id === "") return source;
  return { ...source, id };
};

const PROFILE_MEDIA_KEY = "cw_profile_media_v1";

const pickMedia = (user = {}) => ({
  profile_picture:
    user.profile_picture || user.profile_pic || user.picture || "",
  cover: user.cover || user.cover_image || "",
});

/** Persist avatar/cover outside the cookie (cookies truncate large payloads). */
export const cacheProfileMedia = (user) => {
  const normalized = normalizeUser(user);
  if (!normalized?.id || typeof window === "undefined") return;
  const media = pickMedia(normalized);
  if (!media.profile_picture && !media.cover) return;
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_MEDIA_KEY) || "{}");
    const prev = all[String(normalized.id)] || {};
    all[String(normalized.id)] = {
      profile_picture: media.profile_picture || prev.profile_picture || "",
      cover: media.cover || prev.cover || "",
      ts: Date.now(),
    };
    localStorage.setItem(PROFILE_MEDIA_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / private mode
  }
};

export const readCachedProfileMedia = (userId) => {
  if (!userId || typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_MEDIA_KEY) || "{}");
    return all[String(userId)] || null;
  } catch {
    return null;
  }
};

/** Prefer non-empty media from next, then prev, then localStorage cache. */
export const mergeUserMedia = (prev = {}, next = {}) => {
  const cached = readCachedProfileMedia(next?.id || prev?.id);
  const picture =
    next.profile_picture ||
    next.profile_pic ||
    next.picture ||
    prev.profile_picture ||
    prev.profile_pic ||
    prev.picture ||
    cached?.profile_picture ||
    "";
  const cover =
    next.cover ||
    next.cover_image ||
    prev.cover ||
    prev.cover_image ||
    cached?.cover ||
    "";
  return {
    ...prev,
    ...next,
    profile_picture: picture,
    profile_pic: picture,
    picture: picture || next.picture || prev.picture,
    cover,
    cover_image: cover,
  };
};

export const withCachedMedia = (user) => {
  const normalized = normalizeUser(user);
  if (!normalized?.id) return normalized;
  return mergeUserMedia(normalized, normalized);
};

export const setUser = (user) => {
  const normalized = normalizeUser(user);
  if (!normalized) return user;
  const {
    access_token: _access,
    refresh_token: _refresh,
    password: _password,
    ...safeUser
  } = mergeUserMedia(getUser() || {}, normalized);
  cacheProfileMedia(safeUser);
  try {
    Cookies.set("user", JSON.stringify(safeUser), { path: "/" });
  } catch {
    // Cookie may overflow; media is already in localStorage.
    const slim = { ...safeUser };
    delete slim.cover;
    delete slim.cover_image;
    try {
      Cookies.set("user", JSON.stringify(slim), { path: "/" });
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("userUpdated"));
  }
  return safeUser;
};

export const safeRedirectPath = (value, fallback = "/app") => {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
};

export const completeAuthSession = async (authPayload = {}) => {
  const token =
    authPayload.access_token ||
    authPayload.access ||
    Cookies.get("accessToken") ||
    "";
  if (token) {
    Cookies.set("accessToken", token, { path: "/" });
  }

  const seed = normalizeUser(authPayload.user || authPayload) || {};
  if (seed.id || seed.email) {
    setUser(seed);
  }

  try {
    const remote = await client.run("get", endpoints.user, {}, true);
    if (remote) {
      return setUser(mergeUserMedia(seed, remote));
    }
  } catch (error) {
    console.error("Failed to hydrate signed-in profile:", error);
  }
  return getUser();
};

export const getUser = () => {
  const raw = Cookies.get("user");
  const token = Cookies.get("accessToken");

  if (raw) {
    try {
      const userData = withCachedMedia(normalizeUser(JSON.parse(raw)));
      return userData || false;
    } catch (error) {
      console.error("Failed to parse user data from cookies:", error);
      Cookies.remove("user");
    }
  }

  if (token && !raw) {
    try {
      const fetchUser = async () => {
        const user = await client.run("get", endpoints?.user, {}, true);
        if (user) setUser(user);
      };
      fetchUser();
    } catch (error) {
      console.error("Failed to fetch user data from API:", error);
    }
  }

  return false;
};

export const secureMediaUrl = (url, fallback = "") => {
  if (!url) return fallback;
  const resolved = mediaUrl(url);
  return resolved || fallback;
};

export const avatarUrl = (user) =>
  secureMediaUrl(
    user?.profile_picture || user?.profile_pic || user?.picture,
    "/avatar.png"
  );

/** True when the user has a real uploaded photo (not empty / default). */
export const hasCustomAvatar = (user) => {
  const raw = user?.profile_picture || user?.profile_pic || user?.picture || "";
  if (!raw) return false;
  const value = String(raw).toLowerCase();
  if (value.includes("avatar.png") || value.includes("og-image") || value.includes("girl-avatar") || value.includes("boy-avatar")) {
    return false;
  }
  return Boolean(secureMediaUrl(raw));
};

/** Prefer first name for initials — never gender M/F. */
export const avatarInitial = (user) => {
  const first = String(user?.first_name || "").trim();
  if (first) return first.charAt(0).toUpperCase();
  const full = String(user?.full_name || "").trim();
  if (full) return full.charAt(0).toUpperCase();
  const username = String(user?.username || "").trim().replace(/^@/, "");
  if (username) return username.charAt(0).toUpperCase();
  const email = String(user?.email || "").trim();
  if (email) return email.charAt(0).toUpperCase();
  return "?";
};

export const avatarFirstName = (user) => {
  const first = String(user?.first_name || "").trim();
  if (first) return first;
  const full = String(user?.full_name || "").trim();
  if (full) return full.split(/\s+/)[0] || full;
  const username = String(user?.username || "").trim().replace(/^@/, "");
  return username || "";
};

export const getAuthToken = () => {
  const token = Cookies.get("accessToken");
  return token;
};

export const logout = () => {
  // Clear all authentication data
  Cookies.remove("accessToken");
  Cookies.remove("user");
  Cookies.remove("email");
  Cookies.remove("csrftoken");
  
  // Clear localStorage data
  localStorage.removeItem("user_info");
  localStorage.removeItem("user");
  localStorage.removeItem("authUser");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("token");
  localStorage.removeItem("posts");
  
  // Redirect to login page
  window.location.href = "/login";
};

export const authRequest = (fn) => {
  try {
    return fn();
  } catch (err) {
    if (err.status == 401) {
      Cookies.delete("user");
      Cookies.delete("accessToken");
      window.location.reload();
    }
  }
};

export const getTimeAgo = (timeRef) => {
  const curr = Date.now();
  const ref = new Date(timeRef);
  return timeAgo.format(curr - ref);
};

export const stripLastS = (string) => {
  return string.endsWith("s") ? string.slice(0, -1) : string;
};


export const getLocation  = async function(){
  const ip = await getIPFromAmazon()
  if(!ipinfoKey && ipinfoUrl)return
  try{
      const response = await axios.get(`${ipinfoUrl}/${ip}/?token=${ipinfoKey}`)
          return response.data 
  }catch(err){
      return undefined
  }
}

function getIPFromAmazon() {
  return fetch("https://checkip.amazonaws.com/").then(res => res.text()).then(ip=>ip.trim())
}






export function formatRecommendation(text) {
  // Split the text into lines, trimming and filtering out empty lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  // Extract the title and severity from the first line
  // const titleLine = lines.shift();

  // Begin constructing the HTML string with inline styling
  let htmlString = `
    <div style="max-width: 600px;  max-height: 70%; margin: 20px auto; padding: 20px; background-color: #fff; font-family: Arial, sans-serif;">
      <div style="font-size: 24px; color: #067d83; font-weight: bold; margin-bottom: 16px; text-align: center;">Safety Recommendations</div>
      <ul style="list-style-type: disc; padding-left: 20px;">`;

  // Add each recommendation as a list item
  lines.forEach(line => {
    htmlString += `<li style="margin-bottom: 8px;">${line.replace('-', '').trim()}</li>`;
  });

  // Close the HTML structure
  htmlString += `
      </ul>
    </div>`;

  return htmlString;
}

const TREE_ADMIN_EMAILS = new Set([
  "hello@flowops.africa",
  "flowopsafrica@gmail.com",
]);

const TREE_ADMIN_ACCESS_KEY = "treeAdminAccess";

export const setTreeAdminAccess = (enabled) => {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (enabled) sessionStorage.setItem(TREE_ADMIN_ACCESS_KEY, "1");
    else sessionStorage.removeItem(TREE_ADMIN_ACCESS_KEY);
  } catch {
    /* ignore */
  }
};

export const hasTreeAdminAccessCache = () => {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(TREE_ADMIN_ACCESS_KEY) === "1";
  } catch {
    return false;
  }
};

// Check if user is admin or staff (includes approved Tree Admins after /tree-admin/me/)
export const isAdmin = () => {
  const user = getUser();
  if (!user) return false;
  if (user.is_staff || user.is_superuser || user.is_admin) return true;
  if (hasTreeAdminAccessCache()) return true;
  const email = String(user.email || "").trim().toLowerCase();
  return TREE_ADMIN_EMAILS.has(email);
};

