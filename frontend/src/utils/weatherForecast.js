import { persistLocation } from "./location";

/**
 * WMO weather interpretation codes → product-friendly labels + tone.
 * Tone maps to existing semantic tokens (primary / warning / destructive / muted).
 */
const WMO = {
  0: { label: "Clear sky", tone: "clear", IconHint: "sun" },
  1: { label: "Mostly clear", tone: "clear", IconHint: "sun" },
  2: { label: "Partly cloudy", tone: "cloud", IconHint: "cloud-sun" },
  3: { label: "Overcast", tone: "cloud", IconHint: "cloud" },
  45: { label: "Fog", tone: "fog", IconHint: "fog" },
  48: { label: "Rime fog", tone: "fog", IconHint: "fog" },
  51: { label: "Light drizzle", tone: "rain", IconHint: "drizzle" },
  53: { label: "Drizzle", tone: "rain", IconHint: "drizzle" },
  55: { label: "Heavy drizzle", tone: "rain", IconHint: "drizzle" },
  56: { label: "Freezing drizzle", tone: "rain", IconHint: "drizzle" },
  57: { label: "Heavy freezing drizzle", tone: "rain", IconHint: "drizzle" },
  61: { label: "Light rain", tone: "rain", IconHint: "rain" },
  63: { label: "Rain", tone: "rain", IconHint: "rain" },
  65: { label: "Heavy rain", tone: "storm", IconHint: "rain" },
  66: { label: "Freezing rain", tone: "storm", IconHint: "rain" },
  67: { label: "Heavy freezing rain", tone: "storm", IconHint: "rain" },
  71: { label: "Light snow", tone: "snow", IconHint: "snow" },
  73: { label: "Snow", tone: "snow", IconHint: "snow" },
  75: { label: "Heavy snow", tone: "snow", IconHint: "snow" },
  77: { label: "Snow grains", tone: "snow", IconHint: "snow" },
  80: { label: "Light showers", tone: "rain", IconHint: "rain" },
  81: { label: "Showers", tone: "rain", IconHint: "rain" },
  82: { label: "Violent showers", tone: "storm", IconHint: "rain" },
  85: { label: "Snow showers", tone: "snow", IconHint: "snow" },
  86: { label: "Heavy snow showers", tone: "snow", IconHint: "snow" },
  95: { label: "Thunderstorm", tone: "storm", IconHint: "storm" },
  96: { label: "Thunder + hail", tone: "storm", IconHint: "storm" },
  99: { label: "Severe thunder + hail", tone: "storm", IconHint: "storm" },
};

export function describeWeatherCode(code) {
  return WMO[Number(code)] || { label: "Conditions unknown", tone: "cloud", IconHint: "cloud" };
}

/**
 * Open-Meteo timestamps are local wall times without an offset.
 * Convert using the response utc_offset_seconds so hour slicing matches the forecast zone.
 */
function parseForecastTime(iso, utcOffsetSeconds = 0) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!m) {
    const fallback = new Date(iso);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4] || 0);
  const minute = Number(m[5] || 0);
  const second = Number(m[6] || 0);
  const utcMs = Date.UTC(year, month, day, hour, minute, second);
  return new Date(utcMs - Number(utcOffsetSeconds || 0) * 1000);
}

function formatHourLabel(date, timeZone) {
  if (!date) return "";
  try {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      hour12: true,
      timeZone: timeZone || undefined,
    });
  } catch {
    return date.toLocaleTimeString(undefined, { hour: "numeric", hour12: true });
  }
}

function formatDayLabel(date, index, timeZone) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  if (!date) return `Day ${index + 1}`;
  try {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: timeZone || undefined,
    });
  } catch {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
}

function formatClock(date, timeZone) {
  if (!date) return "—";
  try {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    });
  } catch {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

async function reverseGeocodeLabel(latitude, longitude) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}` +
      `&lon=${longitude}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address || {};
    const city =
      a.city || a.town || a.village || a.municipality || a.suburb || null;
    const region = a.state || a.county || a.region || null;
    const country = a.country || null;
    const parts = [];
    if (city) parts.push(city);
    if (region && region !== city && !String(region).includes(String(city || ""))) {
      parts.push(region);
    } else if (country && country !== city) {
      parts.push(country);
    }
    if (parts.length) return parts.slice(0, 2).join(", ");
    return data?.display_name?.split(",").slice(0, 2).join(",").trim() || null;
  } catch {
    return null;
  }
}

function pickHourlyStartIndex(hourlyTimes, utcOffsetSeconds, nowMs = Date.now()) {
  if (!hourlyTimes.length) return 0;
  let best = 0;
  for (let i = 0; i < hourlyTimes.length; i += 1) {
    const t = parseForecastTime(hourlyTimes[i], utcOffsetSeconds);
    if (!t) continue;
    // Current hour = first slot that has not fully ended yet.
    if (t.getTime() + 60 * 60 * 1000 > nowMs) {
      return i;
    }
    best = i;
  }
  return best;
}

/**
 * Fetch 7-day + hourly forecast from Open-Meteo (no API key).
 */
export async function fetchWeatherForecast({
  latitude,
  longitude,
  label = null,
  refreshPlaceLabel = false,
} = {}) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid coordinates for weather forecast.");
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "is_day",
      "cloud_cover",
    ].join(",")
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "relative_humidity_2m",
    ].join(",")
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
      "uv_index_max",
      "wind_speed_10m_max",
    ].join(",")
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error("Weather service is unavailable right now.");
  }
  const data = await res.json();

  const utcOffsetSeconds = Number(data.utc_offset_seconds || 0);
  const timeZone = data.timezone || undefined;

  let placeLabel = refreshPlaceLabel ? null : label;
  if (!placeLabel) {
    placeLabel = await reverseGeocodeLabel(lat, lon);
  }
  if (placeLabel) {
    persistLocation({
      latitude: lat,
      longitude: lon,
      label: placeLabel,
      source: "device",
    });
  }

  const currentMeta = describeWeatherCode(data.current?.weather_code);
  const hourlyTimes = data.hourly?.time || [];
  const startIdx = pickHourlyStartIndex(hourlyTimes, utcOffsetSeconds);

  const hourlySlice = hourlyTimes.slice(startIdx, startIdx + 24).map((time, i) => {
    const idx = startIdx + i;
    const code = data.hourly.weather_code?.[idx];
    const meta = describeWeatherCode(code);
    const parsed = parseForecastTime(time, utcOffsetSeconds);
    return {
      time,
      label: formatHourLabel(parsed, timeZone),
      temp: Math.round(Number(data.hourly.temperature_2m?.[idx] ?? 0)),
      precipProb: Number(data.hourly.precipitation_probability?.[idx] ?? 0),
      precip: Number(data.hourly.precipitation?.[idx] ?? 0),
      humidity: data.hourly.relative_humidity_2m?.[idx] ?? null,
      weatherCode: code,
      condition: meta.label,
      tone: meta.tone,
      IconHint: meta.IconHint,
    };
  });

  const daily = (data.daily?.time || []).map((time, i) => {
    const code = data.daily.weather_code?.[i];
    const meta = describeWeatherCode(code);
    const parsed = parseForecastTime(time, utcOffsetSeconds);
    const sunrise = parseForecastTime(data.daily.sunrise?.[i], utcOffsetSeconds);
    const sunset = parseForecastTime(data.daily.sunset?.[i], utcOffsetSeconds);
    return {
      time,
      label: formatDayLabel(parsed, i, timeZone),
      high: Math.round(Number(data.daily.temperature_2m_max?.[i] ?? 0)),
      low: Math.round(Number(data.daily.temperature_2m_min?.[i] ?? 0)),
      precipSum: Number(data.daily.precipitation_sum?.[i] ?? 0),
      precipProb: Number(data.daily.precipitation_probability_max?.[i] ?? 0),
      uv: data.daily.uv_index_max?.[i] ?? null,
      windMax: data.daily.wind_speed_10m_max?.[i] ?? null,
      sunrise: data.daily.sunrise?.[i] || null,
      sunset: data.daily.sunset?.[i] || null,
      sunriseLabel: formatClock(sunrise, timeZone),
      sunsetLabel: formatClock(sunset, timeZone),
      weatherCode: code,
      condition: meta.label,
      tone: meta.tone,
      IconHint: meta.IconHint,
    };
  });

  const today = daily[0] || null;
  const temps = hourlySlice.map((h) => h.temp);
  const tempMin = temps.length ? Math.min(...temps) : 0;
  const tempMax = temps.length ? Math.max(...temps) : 0;

  return {
    location: {
      latitude: Number(data.latitude ?? lat),
      longitude: Number(data.longitude ?? lon),
      label: placeLabel || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
      timezone: timeZone || "local",
      utcOffsetSeconds,
      elevation: data.elevation ?? null,
    },
    current: {
      temp: Math.round(Number(data.current?.temperature_2m ?? 0)),
      feelsLike: Math.round(Number(data.current?.apparent_temperature ?? 0)),
      humidity: data.current?.relative_humidity_2m ?? null,
      precip: Number(data.current?.precipitation ?? 0),
      wind: Math.round(Number(data.current?.wind_speed_10m ?? 0)),
      windDir: data.current?.wind_direction_10m ?? null,
      cloudCover: data.current?.cloud_cover ?? null,
      isDay: Boolean(data.current?.is_day),
      weatherCode: data.current?.weather_code,
      label: currentMeta.label,
      tone: currentMeta.tone,
      IconHint: currentMeta.IconHint,
      observedAt: data.current?.time || null,
    },
    today,
    hourly: hourlySlice,
    daily,
    chart: {
      labels: hourlySlice.map((h) => h.label),
      temps,
      precipProb: hourlySlice.map((h) => h.precipProb),
      tempMin,
      tempMax,
    },
    units: {
      temp: data.current_units?.temperature_2m || "°C",
      wind: data.current_units?.wind_speed_10m || "km/h",
      precip: data.daily_units?.precipitation_sum || "mm",
    },
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo",
  };
}
