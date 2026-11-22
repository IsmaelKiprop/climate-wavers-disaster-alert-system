import Cookies from "js-cookie";

/** Nairobi HQ fallback only when GPS cannot run at all. */
export const DEFAULT_LOCATION = {
  latitude: -1.286389,
  longitude: 36.817223,
  label: "Nairobi, Kenya",
  source: "default",
};

/** Optional city picks when the device has no precise GPS (desktop IP guesses). */
export const QUICK_WEATHER_CITIES = [
  { label: "Nairobi, Kenya", latitude: -1.286389, longitude: 36.817223 },
  { label: "Eldoret, Kenya", latitude: 0.5143, longitude: 35.2698 },
  { label: "Mombasa, Kenya", latitude: -4.0435, longitude: 39.6682 },
  { label: "Kisumu, Kenya", latitude: -0.0917, longitude: 34.768 },
  { label: "Nakuru, Kenya", latitude: -0.3031, longitude: 36.08 },
  { label: "Kampala, Uganda", latitude: 0.3476, longitude: 32.5825 },
];

const LOCATION_COOKIE = "location";
/** Prefer readings tighter than this (true GPS / Wi‑Fi). */
const GOOD_ACCURACY_METERS = 1500;
/** Acceptable outdoor / network fix. */
const OK_ACCURACY_METERS = 8000;
/** Hard reject beyond this unless clearly in East Africa. */
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

export function inEastAfricaBounds(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -5.5 &&
    latitude <= 5.5 &&
    longitude >= 29 &&
    longitude <= 42.5
  );
}

function inEastAfrica(lat, lng) {
  return inEastAfricaBounds(lat, lng);
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

  if (/^Africa\//i.test(tz)) {
    // South Asia pin while the OS timezone is Africa → bad IP city (Mumbai, etc.).
    if (lat > 5 && lng > 60 && lng < 100) return false;
    if (/(india|mumbai|maharashtra|delhi|bangalore|chennai)/i.test(text)) {
      return false;
    }
  }
  return true;
}

function isAcceptableFix({ latitude, longitude, accuracy }) {
  if (!locationLooksPlausible(latitude, longitude)) return false;
  const acc = Number(accuracy);
  if (!Number.isFinite(acc) || acc <= 0) {
    // Some browsers omit accuracy — allow only if already in East Africa.
    return inEastAfrica(latitude, longitude);
  }
  if (acc <= OK_ACCURACY_METERS) return true;
  if (acc <= MAX_ACCURACY_METERS && inEastAfrica(latitude, longitude)) return true;
  return false;
}

/**
 * Wait for a real high-accuracy fix via watchPosition (not a single IP guess).
 */
export function readPreciseDevicePosition({
  timeoutMs = 25000,
  goodAccuracyMeters = GOOD_ACCURACY_METERS,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(Object.assign(new Error("Geolocation unavailable"), { code: "UNSUPPORTED" }));
      return;
    }

    let best = null;
    let settled = false;
    const started = Date.now();

    const finish = (value, err) => {
      if (settled) return;
      settled = true;
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch {
        /* ignore */
      }
      window.clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const reading = {
          latitude,
          longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
        };
        if (
          !best ||
          (reading.accuracy != null &&
            (best.accuracy == null || reading.accuracy < best.accuracy))
        ) {
          best = reading;
        }

        // Good enough — use exact GPS now.
        if (
          reading.accuracy != null &&
          reading.accuracy <= goodAccuracyMeters &&
          locationLooksPlausible(latitude, longitude)
        ) {
          finish(reading);
          return;
        }

        // Acceptable after we have waited a bit for GPS to warm up.
        if (
          Date.now() - started > 6000 &&
          isAcceptableFix(reading)
        ) {
          finish(reading);
        }
      },
      (error) => {
        if (best && isAcceptableFix(best)) {
          finish(best);
          return;
        }
        finish(
          null,
          Object.assign(new Error(error?.message || "GPS failed"), {
            code: error?.code,
            gpsFailed: true,
          })
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      }
    );

    const timer = window.setTimeout(() => {
      if (best && isAcceptableFix(best)) {
        finish(best);
        return;
      }
      finish(
        null,
        Object.assign(
          new Error(
            best
              ? `Location too imprecise (±${Math.round((best.accuracy || 0) / 1000)} km)`
              : "Timed out waiting for precise GPS"
          ),
          {
            code: "TIMEOUT",
            gpsFailed: !best,
            lowAccuracy: Boolean(best),
            best,
          }
        )
      );
    }, timeoutMs);
  });
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
    const label = [hit.name, hit.admin1, hit.country]
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
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
    // Manual city picks and precise device fixes are fine to reuse.
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
 * Best-effort background GPS (Mainfeed). Only saves a precise-enough fix.
 */
export const getLocation = () => {
  if (!("geolocation" in navigator)) return;
  readPreciseDevicePosition({ timeoutMs: 15000 })
    .then((pos) => {
      const stored = readStoredLocation();
      const movedFar =
        !stored ||
        haversineKm(stored.latitude, stored.longitude, pos.latitude, pos.longitude) >
          5;
      persistLocation({
        latitude: pos.latitude,
        longitude: pos.longitude,
        label: movedFar ? null : stored?.label || null,
        source: "device",
        accuracy: pos.accuracy,
      });
    })
    .catch(() => {});
};

/**
 * Resolve coordinates for weather.
 * forceRefresh (My location): clear cookie and wait for a precise GPS fix.
 */
export async function resolveUserLocation({ forceRefresh = false } = {}) {
  const stored = readStoredLocation();

  // Reuse a recent precise device fix without re-querying.
  if (
    stored &&
    !forceRefresh &&
    stored.source === "device" &&
    (stored.accuracy == null || stored.accuracy <= OK_ACCURACY_METERS)
  ) {
    return stored;
  }
  if (stored && !forceRefresh && stored.source === "manual") {
    return stored;
  }

  if (forceRefresh) {
    clearStoredLocation();
  }

  if ("geolocation" in navigator) {
    try {
      const pos = await readPreciseDevicePosition({
        timeoutMs: forceRefresh ? 28000 : 18000,
      });
      return persistLocation({
        latitude: pos.latitude,
        longitude: pos.longitude,
        label: null,
        source: "device",
        accuracy: pos.accuracy,
      });
    } catch (err) {
      // My location: do NOT silently jump to Nairobi — report GPS failure.
      if (forceRefresh) {
        if (stored && locationLooksPlausible(stored.latitude, stored.longitude, stored.label)) {
          return {
            ...stored,
            gpsFailed: Boolean(err?.gpsFailed),
            lowAccuracy: Boolean(err?.lowAccuracy),
          };
        }
        return {
          ...(await resolveProfileOrDefault()),
          gpsFailed: Boolean(err?.gpsFailed),
          lowAccuracy: Boolean(err?.lowAccuracy),
          needPrecise: true,
        };
      }

      if (stored) {
        return { ...stored, lowAccuracy: Boolean(err?.lowAccuracy) };
      }
      return {
        ...(await resolveProfileOrDefault()),
        lowAccuracy: Boolean(err?.lowAccuracy),
        gpsFailed: Boolean(err?.gpsFailed),
      };
    }
  }

  if (stored) return stored;
  return resolveProfileOrDefault();
}
