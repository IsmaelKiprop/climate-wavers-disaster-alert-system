/** Build a short place label from Nominatim reverse-geocode JSON. */
export function formatNominatimPlace(data, latitude, longitude) {
  const address = data?.address || {};
  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.suburb ||
    address.county ||
    address.hamlet ||
    "";
  const region = address.state || address.region || "";
  const country = address.country || "";
  const parts = [locality, region, country].filter(Boolean);
  if (parts.length) return [...new Set(parts)].join(", ");
  if (data?.display_name) {
    const chunks = String(data.display_name)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chunks.length >= 2) {
      return `${chunks[chunks.length - 3] || chunks[0]}, ${chunks[chunks.length - 1]}`;
    }
    return data.display_name;
  }
  if (latitude != null && longitude != null) {
    return `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
  }
  return "";
}

export async function reverseGeocode(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
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
