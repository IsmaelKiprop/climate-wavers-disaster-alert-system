/**
 * Client-side historical outlook when API is slow/unavailable.
 * Mirrors backend disaster_forecast logic enough for charts + narrative.
 */

const TYPE_ALIASES = [
  ["earthquake", ["quake", "seismic", "eq"]],
  ["wildfire", ["wildfire", "fire"]],
  ["flood", ["flood"]],
  ["storm", ["storm", "cyclone", "hurricane", "typhoon"]],
  ["volcano", ["volcano", "volcanic"]],
  ["drought", ["drought"]],
  ["landslide", ["landslide"]],
];

function normType(value = "") {
  const raw = String(value).toLowerCase();
  for (const [label, keys] of TYPE_ALIASES) {
    if (keys.some((k) => raw.includes(k))) return label;
  }
  const first = raw.replace(/_/g, " ").trim().split(/\s+/)[0];
  return first || "unknown";
}

function dayKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export function buildClientForecast(events = [], days = 90) {
  const now = Date.now();
  const cutoff = now - days * 86400000;
  const filtered = (Array.isArray(events) ? events : []).filter((ev) => {
    const t = new Date(ev.date || ev.created_at || ev.time || ev.updated || now).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });

  const typeCounts = {};
  const countryCounts = {};
  const dayCounts = {};
  let recent7 = 0;
  let recent30 = 0;
  const mags = [];

  filtered.forEach((ev) => {
    const dtype = normType(ev.disasterType || ev.disaster_type || ev.type || ev.title || ev.name);
    const country = String(ev.country || ev.region || "Unknown").slice(0, 48);
    typeCounts[dtype] = (typeCounts[dtype] || 0) + 1;
    countryCounts[country] = (countryCounts[country] || 0) + 1;
    const t = new Date(ev.date || ev.created_at || ev.time || now).getTime();
    const age = now - t;
    if (age <= 7 * 86400000) recent7 += 1;
    if (age <= 30 * 86400000) recent30 += 1;
    const dk = dayKey(t);
    if (dk) dayCounts[dk] = (dayCounts[dk] || 0) + 1;
    const mag = Number(ev.magnitude);
    if (!Number.isNaN(mag) && mag > 0) mags.push(mag);
  });

  const seriesLabels = [];
  const seriesValues = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    seriesLabels.push(key.slice(5));
    seriesValues.push(dayCounts[key] || 0);
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const dailyAvg7 = avg(seriesValues.slice(-7));
  const dailyAvg14 = avg(seriesValues);
  const projected7 = Math.round(Math.max(0, dailyAvg7) * 7 * 10) / 10;
  const projected14 =
    Math.round(Math.max(0, dailyAvg7 * 0.7 + dailyAvg14 * 0.3) * 14 * 10) / 10;

  const total = filtered.length || 1;
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const last7 = seriesValues.slice(-7).reduce((a, b) => a + b, 0);
  const prev7 = seriesValues.slice(0, 7).reduce((a, b) => a + b, 0);

  const typeOutlook = typeEntries.map(([type, count]) => {
    const share = count / total;
    let trend = "stable";
    if (prev7 > 0 && last7 > prev7 * 1.15) trend = "rising";
    else if (prev7 > 0 && last7 < prev7 * 0.85) trend = "easing";
    const risk =
      trend === "rising" && share >= 0.15
        ? "elevated"
        : share >= 0.2 || trend === "rising"
          ? "watch"
          : "baseline";
    return {
      type,
      historical_count: count,
      share_pct: Math.round(share * 1000) / 10,
      projected_next_7_days: Math.round(projected7 * share * 10) / 10,
      trend,
      risk_band: risk,
    };
  });

  const hotspots = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({
      country,
      count,
      share_pct: Math.round((count / total) * 1000) / 10,
    }));

  const top = typeOutlook[0];
  const hot = hotspots[0];
  const magAvg = mags.length ? Math.round(avg(mags) * 10) / 10 : null;

  const narrative = [
    `Climate Wavers analyzed ${filtered.length} historical and live disaster signals.`,
    `Activity in the last 7 days: ${recent7} events (30-day window: ${recent30}).`,
    `Short-horizon outlook suggests about ${projected7} events over the next week if recent pacing continues.`,
    top
      ? `Dominant pattern: ${top.type} (${top.share_pct}% of observed events), trend ${top.trend}, risk band ${top.risk_band}.`
      : "",
    hot
      ? `Geographic concentration is highest around ${hot.country} (${hot.count} events in the analysis window).`
      : "",
    magAvg != null ? `Average reported earthquake magnitude in sample: M${magAvg}.` : "",
    typeOutlook.some((t) => t.trend === "rising")
      ? `Rising signals to watch: ${typeOutlook
          .filter((t) => t.trend === "rising")
          .slice(0, 3)
          .map((t) => t.type)
          .join(", ")}.`
      : "No sharp acceleration across major types — maintain routine vigilance.",
    "Use this as context for preparedness and community awareness, not as an official evacuation or warning order.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    generated_at: new Date().toISOString(),
    window_days: days,
    disclaimer:
      "Statistical outlook from historical and live feed patterns. Not a government emergency warning. Always follow local authorities.",
    summary: {
      events_analyzed: filtered.length,
      last_7_days: recent7,
      last_30_days: recent30,
      projected_next_7_days: projected7,
      projected_next_14_days: projected14,
      avg_magnitude: magAvg,
    },
    charts: {
      daily_activity: { labels: seriesLabels, values: seriesValues },
      by_type: {
        labels: typeEntries.map(([t]) => t),
        values: typeEntries.map(([, n]) => n),
      },
      by_country: {
        labels: hotspots.slice(0, 8).map((h) => h.country),
        values: hotspots.slice(0, 8).map((h) => h.count),
      },
      outlook_by_type: {
        labels: typeOutlook.map((t) => t.type),
        values: typeOutlook.map((t) => t.projected_next_7_days),
      },
    },
    type_outlook: typeOutlook,
    hotspots,
    narrative,
  };
}
