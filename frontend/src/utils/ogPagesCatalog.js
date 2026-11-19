/**
 * Client-side mirror of frontend/api/og-pages.js page catalog.
 * Keep titles/descriptions/images aligned when updating either file.
 */

export const OG_PAGES_CATALOG = {
  "/": {
    title: "Climate Wavers: Disaster Alerts & Climate Action",
    description:
      "Real-time USGS and NASA disaster alerts, community response, and climate action. Built in Nairobi to verify hazards instead of amplifying rumors.",
    image: "/og-image.jpg",
  },
  "/plastic-pulse": {
    title: "Plastic Pulse — Climate Wavers partner onboarding",
    description:
      "Verified plastic recovery for CBOs, youth groups, recyclers, and sponsors. GPS proof, live kg, certificates, and sponsor-a-kilo on Climate Wavers.",
    image: "/docs/plastic-pulse-og.jpg",
  },
  "/about": {
    title: "About Climate Wavers",
    description:
      "Climate Wavers is the live disaster platform from FlowOps Africa in Nairobi. Official feeds now. Verified alerts as the endgame.",
    image: "/climate-action-network.jpg",
  },
  "/impact": {
    title: "Impact · Climate Wavers",
    description:
      "Live USGS and NASA events plus tree-planting records currently shown on Climate Wavers.",
    image: "/environment.jpg",
  },
  "/faq": {
    title: "FAQ · Climate Wavers",
    description:
      "Answers about live USGS and NASA data, FlowOps research, accounts, and tree campaigns.",
    image: "/og-image.jpg",
  },
  "/contact": {
    title: "Contact Climate Wavers",
    description: "Reach the Climate Wavers team for partnerships, support, and climate action.",
    image: "/community-respond.jpg",
  },
  "/pricing": {
    title: "Pricing · Climate Wavers",
    description:
      "Plans and pricing for Climate Wavers disaster alerts, community tools, and climate action.",
    image: "/og-image.jpg",
  },
  "/consulting": {
    title: "Consulting · Climate Wavers",
    description:
      "FlowOps Africa consulting for disaster systems, climate data, and community platforms.",
    image: "/ai-disaster.jpg",
  },
  "/support": {
    title: "Support · Climate Wavers",
    description: "Get help with Climate Wavers accounts, alerts, tree gifts, and Plastic Pulse.",
    image: "/community-respond.jpg",
  },
  "/disasters": {
    title: "Live disasters · Climate Wavers",
    description:
      "Verified and official disaster alerts for Africa — USGS, NASA, and community response.",
    image: "/emergency-response.jpg",
  },
  "/champions": {
    title: "Climate Champions · Climate Wavers",
    description:
      "Meet Climate Wavers champions leading local climate action and community response.",
    image: "/climate-action-network.jpg",
  },
  "/app": {
    title: "Climate Wavers app",
    description: "Open your feed, chats, alerts, calendar, and tree projects on Climate Wavers.",
    image: "/og-image.jpg",
  },
  "/app/calendar": {
    title: "Climate Calendar · Climate Wavers",
    description:
      "Schedule Climate events, invite collaborators as attendees or co-hosts, and RSVP with your network.",
    image: "/environment.jpg",
  },
};

export function normalizeOgPath(raw) {
  let path = String(raw || "/").split("?")[0].split("#")[0].trim() || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

export function resolveOgCatalogPage(rawPath) {
  const path = normalizeOgPath(rawPath);
  if (OG_PAGES_CATALOG[path]) return { path, ...OG_PAGES_CATALOG[path] };
  if (path.startsWith("/disasters/")) return { path, ...OG_PAGES_CATALOG["/disasters"] };
  if (path.startsWith("/app/calendar")) return { path, ...OG_PAGES_CATALOG["/app/calendar"] };
  if (path.startsWith("/app")) return { path, ...OG_PAGES_CATALOG["/app"] };
  if (path.startsWith("/champions")) return { path, ...OG_PAGES_CATALOG["/champions"] };
  return { path, ...OG_PAGES_CATALOG["/"] };
}
