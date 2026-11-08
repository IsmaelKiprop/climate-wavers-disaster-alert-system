const WARD_RE = /\b(ward|r\/n|sector|block|phase|colony|layout)\b/i;

function pickLocality(address = {}) {
  const candidates = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.city_district,
    address.state_district,
    address.county,
    address.suburb,
    address.neighbourhood,
    address.hamlet,
  ].filter(Boolean);

  // Prefer a real place name over "R/N Ward" / sector labels.
  const preferred = candidates.find((name) => !WARD_RE.test(String(name)));
  return preferred || candidates[0] || "";
}

/** Build a short place label from Nominatim reverse-geocode JSON. */
export function formatNominatimPlace(data, latitude, longitude) {
  const address = data?.address || {};
  const locality = pickLocality(address);
  const region = address.state || address.region || address.state_district || "";
  const country = address.country || "";
  const parts = [locality, region, country].filter(Boolean);
  const unique = [...new Set(parts)];
  if (unique.length) return unique.join(", ");

  if (data?.display_name) {
    const chunks = String(data.display_name)
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part && !WARD_RE.test(part));
    if (chunks.length >= 2) {
      // city-ish, country
      const countryPart = chunks[chunks.length - 1];
      const cityPart = chunks.find((c) => c !== countryPart) || chunks[0];
      return `${cityPart}, ${countryPart}`;
    }
    if (chunks.length) return chunks.join(", ");
  }

  if (latitude != null && longitude != null) {
    return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
  }
  return "";
}

export async function reverseGeocode(latitude, longitude) {
  // zoom=12 → city/region, not street/ward noise
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Geocode failed (${response.status})`);
  }
  const data = await response.json();
  return formatNominatimPlace(data, latitude, longitude);
}

export function locationFieldValue(selectedLocation, fallback = "") {
  if (!selectedLocation) return fallback || "";
  if (typeof selectedLocation === "string") return selectedLocation;
  return (
    selectedLocation.name ||
    selectedLocation.address ||
    fallback ||
    ""
  );
}

/**
 * Read GPS with a hard refresh (no cache). Rejects very coarse IP/Wi‑Fi guesses.
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number }>}
 */
export function readDevicePosition({ maxAccuracyMeters = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          typeof accuracy === "number" &&
          accuracy > maxAccuracyMeters
        ) {
          reject(
            Object.assign(
              new Error(
                `Location is too imprecise (±${Math.round(accuracy / 1000)} km). Turn on precise location or pick a city.`
              ),
              { code: "LOW_ACCURACY", latitude, longitude, accuracy }
            )
          );
          return;
        }
        resolve({ latitude, longitude, accuracy: accuracy || 0 });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  });
}

export const QUICK_CITIES = [
  { name: "Nairobi, Kenya" },
  { name: "Mombasa, Kenya" },
  { name: "Kisumu, Kenya" },
  { name: "Nakuru, Kenya" },
  { name: "Eldoret, Kenya" },
  { name: "Kampala, Uganda" },
  { name: "Dar es Salaam, Tanzania" },
  { name: "Lagos, Nigeria" },
];
