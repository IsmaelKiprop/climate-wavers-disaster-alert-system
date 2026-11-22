import Cookies from "js-cookie";

/** Nairobi HQ fallback when the browser has no usable fix. */
export const DEFAULT_LOCATION = {
  latitude: -1.286389,
  longitude: 36.817223,
  label: "Nairobi, Kenya",
  source: "default",
};

/** Common East Africa cities for weather when browser IP geolocation is wrong. */
export const QUICK_WEATHER_CITIES = [
  { label: "Nairobi, Kenya", latitude: -1.286389, longitude: 36.817223 },
  { label: "Eldoret, Kenya", latitude: 0.5143, longitude: 35.2698 },
  { label: "Mombasa, Kenya", latitude: -4.0435, longitude: 39.6682 },
  { label: "Kisumu, Kenya", latitude: -0.0917, longitude: 34.768 },
  { label: "Nakuru, Kenya", latitude: -0.3031, longitude: 36.08 },
  { label: "Kampala, Uganda", latitude: 0.3476, longitude: 32.5825 },
];

const LOCATION_COOKIE = "location";
/** Desktop Chrome IP guesses are often 20–500+ km off (e.g. Kenya → Mumbai). */
const MAX_ACCURACY_METERS = 50000;

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/**
 * Reject IP-geolocation blunders: e.g. Africa/Nairobi timezone but coords in India.
 */
export function locationLooksPlausible(latitude, longitude, label = "") {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

  const tz = browserTimeZone();
  const text = String(label || "").toLowerCase();

  // Browser says Africa, but pin is in South Asia — classic bad IP geo.
  if (/^Africa\//i.test(tz)) {
    if (lat > 5 && lng > 60 && lng < 100) return false;
    if (/(india|mumbai|maharashtra|delhi|bangalore|chennai)/i.test(text)) {
      return false;
    }
  }

  // Browser says Asia/Kolkata but user is on Climate Wavers Kenya product — still allow
  // if they truly are there; only block when TZ is Africa.
  return true;
}

function readUserProfileHint() {
  try {
    const raw = Cookies.get("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    const city = String(user?.state || user?.location || user?.city || "").trim();
    const country = String(user?.country || "").trim();
    if (!city && !country) return null;
    return { city, country };
  } catch {
    return null;
  }
}

async function geocodePlaceName(query, { countryCode = "KE" } = {}) {
  const name = String(query || "").trim();
  if (!name) return null;
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", name);
    url.searchParams.set("count", "5");
    url.searchParams.set("language", "en");
    if (countryCode) url.searchParams.set("countryCode", countryCode);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data?.results) ? data.results[0] : null;
    if (!hit) return null;
    const latitude = Number(hit.latitude);
    const longitude = Number(hit.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const label = [hit.name, hit.admin1, hit.country].filter(Boolean).slice(0, 2).join(", ");
    return { latitude, longitude, label: label || name, source: "geocode" };
  } catch {
    return null;
  }
}

async function resolveProfileOrDefault() {
  const hint = readUserProfileHint();
  if (hint) {
    const q = [hint.city, hint.country].filter(Boolean).join(", ");
    const countryCode =
      /kenya/i.test(hint.country) || /kenya/i.test(hint.city)
        ? "KE"
        : /uganda/i.test(hint.country)
          ? "UG"
          : /tanzania/i.test(hint.country)
            ? "TZ"
            : /^Africa\//i.test(browserTimeZone())
              ? "KE"
              : "";
    const geo = await geocodePlaceName(q || hint.city || hint.country, {
      countryCode: countryCode || undefined,
    });
    if (geo && locationLooksPlausible(geo.latitude, geo.longitude, geo.label)) {
      return persistLocation(geo);
    }
    // Match a known quick city from profile text.
    const blob = `${hint.city} ${hint.country}`.toLowerCase();
    const quick = QUICK_WEATHER_CITIES.find((c) =>
      blob.includes(c.label.split(",")[0].toLowerCase())
    );
    if (quick) {
      return persistLocation({ ...quick, source: "profile" });
    }
  }

  if (/^Africa\//i.test(browserTimeZone())) {
    return persistLocation({ ...DEFAULT_LOCATION });
  }
  return { ...DEFAULT_LOCATION };
}

export function readStoredLocation() {
  try {
    const raw = Cookies.get(LOCATION_COOKIE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const latitude = Number(parsed?.latitude);
    const longitude = Number(parsed?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const label = parsed?.label || null;
    if (!locationLooksPlausible(latitude, longitude, label)) {
      Cookies.remove(LOCATION_COOKIE, { path: "/" });
      return null;
    }
    return {
      latitude,
      longitude,
      label,
      source: parsed?.source || "stored",
      accuracy: Number.isFinite(Number(parsed?.accuracy))
        ? Number(parsed.accuracy)
        : null,
      updatedAt: parsed?.updatedAt || null,
    };
  } catch {
    return null;
  }
}

export function persistLocation({
  latitude,
  longitude,
  label = null,
  source = "device",
  accuracy = null,
}) {
  const payload = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    label: label || null,
    source,
    accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
    updatedAt: new Date().toISOString(),
  };
  Cookies.set(LOCATION_COOKIE, JSON.stringify(payload), { path: "/", expires: 30 });
  return payload;
}

export function clearStoredLocation() {
  Cookies.remove(LOCATION_COOKIE, { path: "/" });
}

export function setManualWeatherLocation({ latitude, longitude, label }) {
  clearStoredLocation();
  return persistLocation({
    latitude,
    longitude,
    label,
    source: "manual",
    accuracy: 0,
  });
}

/**
 * Best-effort geolocation write used by Mainfeed idle bootstrap.
 */
export const getLocation = () => {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      if (
        typeof accuracy === "number" &&
        accuracy > MAX_ACCURACY_METERS
      ) {
        return;
      }
      if (!locationLooksPlausible(latitude, longitude)) return;
      const stored = readStoredLocation();
      const movedFar =
        !stored ||
        haversineKm(stored.latitude, stored.longitude, latitude, longitude) > 25;
      persistLocation({
        latitude,
        longitude,
        label: movedFar ? null : stored?.label || null,
        source: "device",
        accuracy,
      });
    },
    () => {},
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
  );
};

/**
 * Resolve coordinates for weather.
 * Order: precise GPS → stored (if plausible) → profile geocode → Nairobi.
 */
export async function resolveUserLocation({ forceRefresh = false } = {}) {
  const stored = readStoredLocation();
  if (stored && !forceRefresh) {
    return stored;
  }

  if ("geolocation" in navigator) {
    const gps = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const coarse =
            typeof accuracy === "number" && accuracy > MAX_ACCURACY_METERS;
          if (coarse || !locationLooksPlausible(latitude, longitude)) {
            resolve({ rejected: true, accuracy, latitude, longitude });
            return;
          }
          const next = persistLocation({
            latitude,
            longitude,
            label: null,
            source: "device",
            accuracy,
          });
          resolve(next);
        },
        () => resolve({ rejected: true, gpsFailed: true }),
        {
          enableHighAccuracy: true,
          timeout: forceRefresh ? 20000 : 12000,
          maximumAge: forceRefresh ? 0 : 60000,
        }
      );
    });

    if (gps && !gps.rejected) {
      return gps;
    }

    // Coarse/wrong IP geo (Mumbai etc.) — do not keep poisoning the cookie.
    if (gps?.rejected) {
      clearStoredLocation();
      const fallback = await resolveProfileOrDefault();
      return {
        ...fallback,
        gpsFailed: Boolean(gps.gpsFailed),
        lowAccuracy: !gps.gpsFailed,
      };
    }
  }

  if (stored) return { ...stored, gpsFailed: true };
  return resolveProfileOrDefault();
}
