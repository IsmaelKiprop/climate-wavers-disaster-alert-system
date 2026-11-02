import axios from "axios";
import { apiUrl, chatbotApiUrl, env } from "../config/env";
import { client } from "../api";
import { endpoints } from "./endpoints";
import { getAuthToken } from "./factory";

export function unwrapList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export function mapProjectToCampaign(project) {
  return {
    id: project.id,
    title: project.name || project.title || "Tree project",
    details: project.short_description || project.description || "",
    amount: project.funding_goal || project.total_budget || 0,
    raised: project.funds_raised || 0,
    image: project.cover_image_url || project.cover_image || project.image_url || "/logo.jpg",
    country: project.country || "",
    city: project.city || "",
    trees_planted: project.trees_planted || 0,
    raw: project,
  };
}

const DISASTER_COVERS = {
  earthquake: "/ai-disaster.jpg",
  wildfire: "/community-respond.jpg",
  flood: "/emergency-response.jpg",
  storm: "/ai-disaster.jpg",
  hurricane: "/ai-disaster.jpg",
  typhoon: "/ai-disaster.jpg",
  volcanic_eruption: "/ai-disaster.jpg",
  volcanoes: "/ai-disaster.jpg",
  drought: "/environment.jpg",
  heatwave: "/environment.jpg",
  landslide: "/emergency-response.jpg",
  blizzard: "/environment.jpg",
  other: "/disaster.png",
};

export function disasterCoverImage(type) {
  const key = String(type || "other").toLowerCase().replace(/\s+/g, "_");
  return DISASTER_COVERS[key] || DISASTER_COVERS.other;
}

export function mapDisaster(disaster) {
  const lat = Number(disaster.latitude ?? disaster.coordinates?.lat);
  const lng = Number(disaster.longitude ?? disaster.coordinates?.lng);
  const severityRaw = String(disaster.severity || "").toUpperCase();
  const severityMap = {
    CATASTROPHIC: "CRITICAL",
    EXTREME: "CRITICAL",
    SEVERE: "HIGH",
    HIGH: "HIGH",
    MODERATE: "MEDIUM",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
    CRITICAL: "CRITICAL",
  };
  const disasterType = disaster.disasterType || disaster.disaster_type || disaster.type || "other";
  const suppliedImages = []
    .concat(disaster.images || disaster.gallery || [])
    .concat(disaster.cover_image ? [disaster.cover_image] : [])
    .filter(Boolean);
  const cover = suppliedImages[0] || disasterCoverImage(disasterType);

  return {
    id: disaster.id,
    title: disaster.title || `${disaster.region || disaster.city || ""}, ${disaster.country || ""}`.trim(),
    region: disaster.region || disaster.city || "",
    country: disaster.country || "",
    disasterType,
    status: disaster.status || "monitoring",
    startDate: disaster.startDate || disaster.start_date,
    details: disaster.details || disaster.description || "",
    images: suppliedImages.length ? suppliedImages : [cover],
    image: cover,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    severity: severityMap[severityRaw] || (disaster.is_urgent ? "HIGH" : "MEDIUM"),
    name: disaster.title || disaster.name || disaster.disasterType || "Disaster",
    type: disasterType,
    description: disaster.description || disaster.details || "",
    location: [disaster.city, disaster.region, disaster.country].filter(Boolean).join(", "),
    lastUpdated: disaster.updated_at || disaster.last_updated || disaster.start_date || disaster.startDate,
    source: disaster.source || disaster.official_source || "",
    sourceUrl: disaster.sourceUrl || disaster.source_url || disaster.url || disaster.link || "",
    coordinates:
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : null,
  };
}

export function mapDisasterForMap(disaster) {
  const mapped = mapDisaster(disaster);
  if (!mapped.coordinates) return null;
  return mapped;
}

export async function fetchTreeProjects() {
  const token = getAuthToken();
  try {
    const data = await client.run("get", endpoints.tree_projects, {}, Boolean(token));
    return unwrapList(data).map(mapProjectToCampaign);
  } catch (error) {
    const response = await axios.get(apiUrl(endpoints.tree_projects_african));
    return unwrapList(response.data).map(mapProjectToCampaign);
  }
}

export async function fetchTreeStats() {
  try {
    const response = await axios.get(apiUrl(endpoints.tree_projects_stats));
    if (response.data) return response.data;
  } catch (error) {
    // Stats may require auth on older API deploys. Derive from public African projects.
  }
  try {
    const response = await axios.get(apiUrl(endpoints.tree_projects_african));
    const list = unwrapList(response.data);
    return {
      total_projects: list.length,
      active_projects: list.length,
      verified_projects: list.length,
      total_trees_planted: list.reduce((sum, project) => sum + (Number(project.trees_planted) || 0), 0),
      total_funds_raised: list.reduce((sum, project) => sum + (Number(project.funds_raised) || 0), 0),
    };
  } catch (error) {
    return {};
  }
}

const USGS_WEEK_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson";
const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80";

const EONET_TYPE_MAP = {
  wildfires: "wildfire",
  severeStorms: "storm",
  volcanoes: "volcanic_eruption",
  floods: "flood",
  drought: "drought",
  earthquakes: "earthquake",
  landslides: "landslide",
  tempExtremes: "heatwave",
  seaLakeIce: "other",
  dustHaze: "other",
  snow: "blizzard",
  waterColor: "other",
  manmade: "other",
};

function severityFromMagnitude(mag) {
  if (mag >= 7) return "CRITICAL";
  if (mag >= 6) return "HIGH";
  if (mag >= 4.5) return "MEDIUM";
  return "LOW";
}

function eonetPoint(event) {
  const geos = event.geometry || [];
  const geo = geos[geos.length - 1] || geos[0];
  if (!geo) return { lat: null, lng: null, date: event.closed || null };
  const coords = geo.coordinates;
  if (geo.type === "Point" && Array.isArray(coords)) {
    return { lng: Number(coords[0]), lat: Number(coords[1]), date: geo.date };
  }
  const first = Array.isArray(coords?.[0]?.[0]) ? coords[0][0] : coords?.[0];
  if (Array.isArray(first)) {
    return { lng: Number(first[0]), lat: Number(first[1]), date: geo.date };
  }
  return { lat: null, lng: null, date: geo.date };
}

function mapUsgsFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry?.coordinates || [];
  const mag = Number(props.mag);
  return mapDisaster({
    id: feature.id || props.code,
    title: props.title || `M${mag} earthquake`,
    name: props.title,
    disaster_type: "earthquake",
    severity: severityFromMagnitude(mag),
    status: "ongoing",
    country: (props.place || "").split(",").slice(-1)[0]?.trim() || "",
    region: props.place || "",
    city: "",
    latitude: coords[1],
    longitude: coords[0],
    description: `Magnitude ${Number.isFinite(mag) ? mag.toFixed(1) : "unknown"} earthquake. Source: USGS.`,
    start_date: props.time ? new Date(props.time).toISOString() : null,
    updated_at: props.updated ? new Date(props.updated).toISOString() : null,
    source: "USGS",
    url: props.url || (feature.id ? `https://earthquake.usgs.gov/earthquakes/eventpage/${feature.id}` : ""),
  });
}

function mapEonetEvent(event) {
  const category = event.categories?.[0]?.id || "other";
  const point = eonetPoint(event);
  const type = EONET_TYPE_MAP[category] || category || "other";
  const severity =
    type === "volcanic_eruption" || type === "wildfire" || type === "storm"
      ? "HIGH"
      : "MEDIUM";
  return mapDisaster({
    id: event.id,
    title: event.title,
    name: event.title,
    disaster_type: type,
    severity,
    status: event.closed ? "resolved" : "ongoing",
    country: "",
    region: event.title,
    latitude: point.lat,
    longitude: point.lng,
    description: event.description || `${event.title}. Source: NASA EONET.`,
    start_date: point.date || event.geometry?.[0]?.date,
    source: "NASA EONET",
    url:
      event.sources?.find((item) => item.url)?.url ||
      event.link ||
      (event.id ? `https://eonet.gsfc.nasa.gov/api/v3/events/${event.id}` : ""),
  });
}

async function fetchPublicLiveDisasters() {
  const [usgsResult, eonetResult] = await Promise.allSettled([
    axios.get(USGS_WEEK_URL),
    axios.get(EONET_URL),
  ]);
  const usgs =
    usgsResult.status === "fulfilled"
      ? (usgsResult.value.data?.features || []).map(mapUsgsFeature)
      : [];
  const eonet =
    eonetResult.status === "fulfilled"
      ? (eonetResult.value.data?.events || []).map(mapEonetEvent)
      : [];
  return [...usgs, ...eonet].filter((item) => item.id);
}

export async function fetchDisasters() {
  const urls = [];
  if (env.backendUrl) {
    urls.push(apiUrl("/api/v1/disasters/live/"));
    urls.push(apiUrl("/api/v1/disasters/"));
  }
  if (env.chatbotUrl) {
    urls.push(chatbotApiUrl("/api/v1/disasters"));
  }

  const publicPromise = fetchPublicLiveDisasters();
  const apiPromise = (async () => {
    for (const url of urls) {
      try {
        const response = await axios.get(url, { timeout: 4000 });
        const list = unwrapList(response.data).map(mapDisaster);
        if (list.length) return list;
      } catch {
        // Try the next source, then fall back to public feeds.
      }
    }
    return [];
  })();

  const [fromApi, fromPublic] = await Promise.all([apiPromise, publicPromise]);
  const list = fromApi.length ? fromApi : fromPublic;
  cacheDisasters(list);
  return list;
}

const DISASTER_CACHE_KEY = "cw_live_disasters";

function cacheDisasters(list) {
  try {
    sessionStorage.setItem(DISASTER_CACHE_KEY, JSON.stringify(list.slice(0, 300)));
  } catch {
    // Ignore quota errors.
  }
}

export function getCachedDisaster(disasterId) {
  try {
    const id = decodeURIComponent(String(disasterId || ""));
    const list = JSON.parse(sessionStorage.getItem(DISASTER_CACHE_KEY) || "[]");
    return list.find((item) => String(item.id) === String(id)) || null;
  } catch {
    return null;
  }
}

export function formatTimeAgo(value) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function summarizeLiveFeed(disasters) {
  const typeCounts = {};
  const regionCounts = {};
  const sourceCounts = {};
  (disasters || []).forEach((event) => {
    const type = String(event.disasterType || event.type || "other").replace(/_/g, " ");
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    const region = continentFromCoords(event.latitude, event.longitude);
    regionCounts[region] = (regionCounts[region] || 0) + 1;
    const source = event.source || "Unknown";
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  const newest = [...(disasters || [])]
    .filter((item) => item.startDate || item.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated || b.startDate) - new Date(a.lastUpdated || a.startDate));
  return {
    total: disasters?.length || 0,
    typeCounts,
    regionCounts,
    sourceCounts,
    newest,
  };
}

export function continentFromCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Unspecified";
  if (lat >= 15 && lng >= -170 && lng <= -50) return "North America";
  if (lat < 15 && lat >= -60 && lng >= -90 && lng <= -30) return "South America";
  if (lat >= 35 && lng >= -25 && lng <= 40) return "Europe";
  if (lat < 38 && lat >= -35 && lng >= -20 && lng <= 55) return "Africa";
  if (lng >= 110 || lng <= -130) return "Oceania";
  if (lng >= 25) return "Asia";
  return "Other";
}

const CHART_COLORS = ["#067d83", "#055a5f", "#2F4F4F", "#0a9ca3", "#b45309", "#b42318", "#6b7280"];

export function buildLiveCharts(disasters) {
  const typeCounts = {};
  const regionCounts = {};
  const dayCounts = {};
  const dayLabels = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    dayLabels.push(key);
    dayCounts[key] = 0;
  }

  disasters.forEach((event) => {
    const type = String(event.disasterType || "other").replace(/_/g, " ");
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    const region = continentFromCoords(event.latitude, event.longitude);
    regionCounts[region] = (regionCounts[region] || 0) + 1;
    const dayKey = event.startDate ? new Date(event.startDate).toISOString().slice(0, 10) : null;
    if (dayKey && dayCounts[dayKey] != null) dayCounts[dayKey] += 1;
  });

  const typeLabels = Object.keys(typeCounts);
  const regionLabels = Object.keys(regionCounts);

  return {
    typeChart: {
      labels: typeLabels,
      datasets: [{
        label: "Active events",
        data: typeLabels.map((label) => typeCounts[label]),
        backgroundColor: typeLabels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
        borderWidth: 0,
        borderRadius: 5,
      }],
    },
    regionChart: {
      labels: regionLabels,
      datasets: [{
        data: regionLabels.map((label) => regionCounts[label]),
        backgroundColor: regionLabels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
      }],
    },
    dailyChart: {
      labels: dayLabels.map((key) =>
        new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      ),
      datasets: [{
        label: "Events reported",
        data: dayLabels.map((key) => dayCounts[key]),
        backgroundColor: "#067d83",
        borderColor: "#055a5f",
        borderWidth: 2,
        borderRadius: 5,
      }],
    },
  };
}

export async function fetchDisaster(disasterId) {
  const id = decodeURIComponent(String(disasterId || ""));
  const cached = getCachedDisaster(id);
  if (cached) return cached;

  try {
    const live = await fetchDisasters();
    const match = live.find((item) => String(item.id) === String(id));
    if (match) return match;
  } catch {
    // Fall through to API lookup.
  }

  const urls = [];
  if (env.chatbotUrl) {
    urls.push(chatbotApiUrl(`/api/v1/disasters/${encodeURIComponent(id)}`));
  }
  urls.push(apiUrl(`/api/v1/disasters/${encodeURIComponent(id)}/`));

  let lastError = null;
  for (const url of urls) {
    try {
      const response = await axios.get(url, { timeout: 4000 });
      const payload = response.data?.data || response.data;
      return mapDisaster(payload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Could not load this disaster");
}
