import Cookies from "js-cookie";

/** Nairobi HQ fallback when the browser has no usable fix. */
export const DEFAULT_LOCATION = {
  latitude: -1.286389,
  longitude: 36.817223,
  label: "Nairobi, Kenya",
  source: "default",
};

const LOCATION_COOKIE = "location";

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
    };
  } catch {
    return null;
  }
}

export function persistLocation({ latitude, longitude, label = null, source = "device" }) {
  const payload = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    label: label || null,
    source,
  };
  Cookies.set(LOCATION_COOKIE, JSON.stringify(payload), { path: "/" });
  return payload;
}

/**
 * Best-effort geolocation write used by Mainfeed idle bootstrap.
 * Does not return a value; prefer resolveUserLocation for UI.
 */
export const getLocation = () => {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      persistLocation({ latitude, longitude, source: "device" });
    },
    () => {
      // Permission denied or unavailable — stay silent on the dashboard.
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
};

/**
 * Resolve coordinates for weather: stored cookie → live GPS → Nairobi default.
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
        const next = persistLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: stored?.label || null,
          source: "device",
        });
        resolve(next);
      },
      () => {
        resolve(stored || { ...DEFAULT_LOCATION });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: forceRefresh ? 0 : 300000 }
    );
  });
}
