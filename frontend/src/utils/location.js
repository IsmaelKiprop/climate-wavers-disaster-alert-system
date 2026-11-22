import Cookies from "js-cookie";

/** Nairobi HQ fallback when the browser has no usable fix. */
export const DEFAULT_LOCATION = {
  latitude: -1.286389,
  longitude: 36.817223,
  label: "Nairobi, Kenya",
  source: "default",
};

const LOCATION_COOKIE = "location";

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

export function readStoredLocation() {
  try {
    const raw = Cookies.get(LOCATION_COOKIE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const latitude = Number(parsed?.latitude);
    const longitude = Number(parsed?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      label: parsed?.label || null,
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

/**
 * Best-effort geolocation write used by Mainfeed idle bootstrap.
 * Does not return a value; prefer resolveUserLocation for UI.
 */
export const getLocation = () => {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const stored = readStoredLocation();
      const movedFar =
        !stored ||
        haversineKm(stored.latitude, stored.longitude, latitude, longitude) > 25;
      persistLocation({
        latitude,
        longitude,
        // Drop stale place names when the device has clearly moved.
        label: movedFar ? null : stored?.label || null,
        source: "device",
        accuracy,
      });
    },
    () => {
      // Permission denied or unavailable — stay silent on the dashboard.
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
  );
};

/**
 * Resolve coordinates for weather: live GPS (when forced) → stored cookie → Nairobi default.
 */
export function resolveUserLocation({ forceRefresh = false } = {}) {
  return new Promise((resolve) => {
    const stored = readStoredLocation();
    if (stored && !forceRefresh) {
      resolve(stored);
      return;
    }

    if (!("geolocation" in navigator)) {
      resolve(stored || { ...DEFAULT_LOCATION });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const movedFar =
          !stored ||
          haversineKm(stored.latitude, stored.longitude, latitude, longitude) > 25;
        // Never keep an old city/country label across a real GPS refresh.
        const next = persistLocation({
          latitude,
          longitude,
          label: forceRefresh || movedFar ? null : stored?.label || null,
          source: "device",
          accuracy,
        });
        resolve(next);
      },
      () => {
        // GPS failed — if forcing refresh, prefer Nairobi over a clearly stale cookie.
        if (forceRefresh && stored) {
          // Keep stored coords for weather, but mark that GPS failed so UI can re-geocode.
          resolve({ ...stored, source: stored.source || "stored", gpsFailed: true });
          return;
        }
        resolve(stored || { ...DEFAULT_LOCATION });
      },
      {
        enableHighAccuracy: true,
        timeout: forceRefresh ? 20000 : 12000,
        maximumAge: forceRefresh ? 0 : 120000,
      }
    );
  });
}
