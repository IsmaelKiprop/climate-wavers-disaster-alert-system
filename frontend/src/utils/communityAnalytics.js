const CLIMATE_TYPES = new Set(["wildfire", "drought", "heatwave", "flood", "storm"]);

function normalizeType(event) {
  return String(event?.disasterType || event?.type || "unknown")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim() || "unknown";
}

function normalizeSeverity(event) {
  const raw = String(event?.severity || "").toUpperCase();
  if (["CRITICAL", "HIGH", "MODERATE", "LOW"].includes(raw)) return raw;
  return "UNKNOWN";
}

function eventTime(event) {
  const stamp = event?.lastUpdated || event?.startDate || event?.date || event?.created_at;
  const t = stamp ? new Date(stamp).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function lastNDaysLabels(n = 7) {
  const labels = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  }
  return labels;
}

function dailyCounts(events, n = 7) {
  const buckets = Array.from({ length: n }, () => 0);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (n - 1));

  for (const event of events) {
    const t = eventTime(event);
    if (t == null) continue;
    const day = new Date(t);
    day.setHours(0, 0, 0, 0);
    const idx = Math.round((day.getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < n) buckets[idx] += 1;
  }
  return buckets;
}

function topLocations(events, limit = 6) {
  return countBy(events, (event) => {
    const loc = String(event?.location || event?.country || event?.place || "").trim();
    if (!loc) return "Unspecified region";
    const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[parts.length - 1] || loc;
  }).slice(0, limit);
}

function sourceMix(events) {
  return countBy(events, (event) => {
    const source = String(event?.source || event?.provider || "").toLowerCase();
    if (source.includes("usgs")) return "USGS";
    if (source.includes("nasa") || source.includes("eonet")) return "NASA EONET";
    if (source) return source.toUpperCase();
    return "Other";
  });
}

function buildNarrative({ events, byType, bySeverity, hotspots, hashtags, climateShare }) {
  const total = events.length;
  const topType = byType[0]?.label || "mixed hazards";
  const critical = bySeverity.find((s) => s.label === "CRITICAL")?.value || 0;
  const high = bySeverity.find((s) => s.label === "HIGH")?.value || 0;
  const hotspot = hotspots[0]?.label;
  const tag = hashtags[0] ? `#${String(hashtags[0].hashtags || "").replace(/^#/, "")}` : null;

  const openers = [
    "Community pulse is reading the live hazard stream like a weather vane for local action.",
    "Tonight’s briefing treats every USGS and NASA ping as a chance to organize, not amplify rumor.",
    "The community feed is denser than usual — here’s the pattern worth watching together.",
  ];
  const opener = openers[total % openers.length];

  const pressure =
    critical + high > 0
      ? `${critical + high} high-or-critical signals are active. Prioritize verified alerts before sharing.`
      : "Severity is mostly moderate-to-low right now — good window for preparedness posts and tree gifts.";

  const climateLine =
    climateShare >= 40
      ? `About ${climateShare}% of live events lean climate-linked (${topType} leads). Pair alerts with practical climate action.`
      : `${topType} is the loudest signal in the mix. Climate-linked share sits near ${climateShare}% — keep both disaster response and long-game sustainability in view.`;

  const placeLine = hotspot
    ? `Geographic heat clusters around ${hotspot}. If that is your region, check chat groups and local responders first.`
    : "Locations are scattered — treat this as a wide-area watch rather than a single hotspot story.";

  const socialLine = tag
    ? `Conversation energy on-platform is orbiting ${tag}. Use it when you post updates so neighbors can find each other.`
    : "Hashtag traffic is quiet — start a clear #ClimateAction or local tag when you brief your network.";

  const close =
    "This is an AI-assisted community briefing grounded in live feeds. Verify official sources before any high-impact share.";

  return [opener, pressure, climateLine, placeLine, socialLine, close].join("\n\n");
}

/**
 * Build chart-ready community analytics from live events + trending hashtags.
 */
export function buildCommunityAnalytics(events = [], hashtags = []) {
  const list = Array.isArray(events) ? events : [];
  const tags = Array.isArray(hashtags) ? hashtags : [];

  const byType = countBy(list, normalizeType).slice(0, 8);
  const bySeverity = countBy(list, normalizeSeverity);
  const hotspots = topLocations(list);
  const sources = sourceMix(list);
  const dayLabels = lastNDaysLabels(7);
  const dayValues = dailyCounts(list, 7);

  const climateCount = list.filter((e) =>
    CLIMATE_TYPES.has(String(e?.disasterType || "").toLowerCase())
  ).length;
  const climateShare = list.length ? Math.round((climateCount / list.length) * 100) : 0;
  const highPlus = list.filter((e) =>
    ["HIGH", "CRITICAL"].includes(String(e?.severity || "").toUpperCase())
  ).length;

  const summary = {
    events_live: list.length,
    high_or_critical: highPlus,
    climate_share_pct: climateShare,
    unique_types: byType.length,
    hotspot: hotspots[0]?.label || "—",
    top_hashtag: tags[0] ? `#${String(tags[0].hashtags || "").replace(/^#/, "")}` : "—",
  };

  const narrative = buildNarrative({
    events: list,
    byType,
    bySeverity,
    hotspots,
    hashtags: tags,
    climateShare,
  });

  return {
    generated_at: new Date().toISOString(),
    summary,
    charts: {
      by_type: {
        labels: byType.map((r) => r.label),
        values: byType.map((r) => r.value),
      },
      by_severity: {
        labels: bySeverity.map((r) => r.label),
        values: bySeverity.map((r) => r.value),
      },
      activity_7d: {
        labels: dayLabels,
        values: dayValues,
      },
      by_source: {
        labels: sources.map((r) => r.label),
        values: sources.map((r) => r.value),
      },
      hotspots: {
        labels: hotspots.map((r) => r.label),
        values: hotspots.map((r) => r.value),
      },
    },
    type_table: byType.map((row) => ({
      type: row.label,
      count: row.value,
      share_pct: list.length ? Math.round((row.value / list.length) * 100) : 0,
    })),
    narrative,
    disclaimer:
      "AI-assisted analysis of live USGS/NASA community feeds. Not a government warning. Verify before sharing.",
  };
}

export function analyticsPromptFromReport(report) {
  const s = report?.summary || {};
  return (
    `Write a short, vivid Climate Wavers community briefing (max 120 words) for organizers. ` +
    `Live events: ${s.events_live || 0}. High/critical: ${s.high_or_critical || 0}. ` +
    `Climate-linked share: ${s.climate_share_pct || 0}%. Leading hotspot: ${s.hotspot || "n/a"}. ` +
    `Top hashtag: ${s.top_hashtag || "n/a"}. Tone: calm, verified-first, action-oriented. No fearmongering.`
  );
}
