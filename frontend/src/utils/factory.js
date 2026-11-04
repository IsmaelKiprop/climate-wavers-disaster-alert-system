import Cookies from "js-cookie";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import { client } from "../api";
import { endpoints } from "./endpoints";
import axios from 'axios';
import { ipinfoKey, ipinfoUrl } from "../config/ipinfo.config";

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

export const setUser = (user) => {
  const normalized = normalizeUser(user);
  if (!normalized) return user;
  Cookies.set("user", JSON.stringify(normalized), { path: "/" });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("userUpdated"));
  }
  return normalized;
};

export const getUser = () => {
  const raw = Cookies.get("user");
  const token = Cookies.get("accessToken");

  if (raw) {
    try {
      const userData = normalizeUser(JSON.parse(raw));
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

export const avatarUrl = (user) =>
  user?.profile_picture || user?.profile_pic || user?.picture || "/avatar.png";

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

// Check if user is admin or staff
export const isAdmin = () => {
  const user = getUser();
  if (!user) return false;
  if (user.is_staff || user.is_superuser || user.is_admin) return true;
  const email = String(user.email || "").trim().toLowerCase();
  return TREE_ADMIN_EMAILS.has(email);
};

