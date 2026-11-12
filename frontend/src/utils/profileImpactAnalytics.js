const CLIMATE_TYPES = new Set(["wildfire", "drought", "heatwave", "flood", "storm"]);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normPlace(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventMatchesPlace(event, places) {
  if (!places.length) return false;
  const hay = normPlace(
    [event?.location, event?.country, event?.place, event?.title, event?.name]
      .filter(Boolean)
      .join(" ")
  );
  return places.some((p) => p && hay.includes(p));
}

function countByType(events) {
  const map = new Map();
  for (const event of events) {
    const key =
      String(event?.disasterType || event?.type || "other")
        .toLowerCase()
        .replace(/_/g, " ")
        .trim() || "other";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function buildNarrative({
  name,
  placeLabel,
  treesTotal,
  posts,
  nearby,
  climateShare,
  resilience,
  topHazard,
}) {
  const who = name || "This Climate Waver";
  const openers = [
    `${who}'s impact constellation reads canopy against live hazard signals.`,
    `Where alerts spike, ${who}'s grove and voice are the counterweight.`,
    `A personal resilience lens: disasters on the wire, action in the ledger.`,
  ];
  const opener = openers[(posts + treesTotal + nearby) % openers.length];

  const placeLine = placeLabel
    ? `Watch window keyed to ${placeLabel}: ${nearby} live signal${nearby === 1 ? "" : "s"} currently overlap that geography.`
    : `No pinned home region yet — using global climate-linked pressure as the backdrop (${climateShare}% of the live feed).`;

  const hazardLine = topHazard
    ? `${topHazard} leads the nearby mix. Pair verification-first sharing with practical next steps, not rumor.`
    : `Hazard mix is quiet or scattered — a good window to post preparedness and plant.`;

  const actionLine =
    treesTotal > 0
      ? `${treesTotal} tree${treesTotal === 1 ? "" : "s"} on their ledger. Canopy is the long game against heat, flood, and dust.`
      : `No trees logged yet — one verified gift turns this profile from observer to grower.`;

  const voiceLine =
    posts > 0
      ? `${posts} post${posts === 1 ? "" : "s"} keep neighbors in the loop. Resilience Index sits at ${resilience}/100.`
      : `Voice is quiet so far. A short verified update lifts the Resilience Index from silence.`;

  const close =
    "AI-assisted profile lens using live USGS/NASA feeds plus this member’s trees and activity. Not a government warning.";

  return [opener, placeLine, hazardLine, actionLine, voiceLine, close].join("\n\n");
}

/**
 * Unique profile lens: user impact × live disaster field.
 */
export function buildProfileImpactAnalytics({
  profile = {},
  feed = {},
  disasters = [],
  trees = {},
} = {}) {
  const posts = Array.isArray(feed.post) ? feed.post : [];
  const comments = Array.isArray(feed.comments) ? feed.comments : [];
  const likes = Array.isArray(feed.likes) ? feed.likes : [];
  const reposts = Array.isArray(feed.reposts) ? feed.reposts : [];
  const bookmarks = Array.isArray(feed.bookmarks) ? feed.bookmarks : [];
  const events = Array.isArray(disasters) ? disasters : [];

  const treesBought = num(trees.trees_bought ?? profile?.trees?.trees_bought);
  const treesGifted = num(
    trees.trees_gifted_to_them ?? profile?.trees?.trees_gifted_to_them
  );
  const treesTotal =
    num(trees.trees_total ?? profile?.trees?.trees_total) ||
    treesBought + treesGifted;

  const places = [
    normPlace(profile.country),
    normPlace(profile.state),
    normPlace(profile.location),
  ].filter((p) => p.length > 2);

  const placeLabel = [profile.location, profile.state, profile.country]
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  const nearbyEvents = places.length
    ? events.filter((e) => eventMatchesPlace(e, places))
    : events.filter((e) =>
        CLIMATE_TYPES.has(String(e?.disasterType || "").toLowerCase())
      );

  const nearby = nearbyEvents.length;
  const highNearby = nearbyEvents.filter((e) =>
    ["HIGH", "CRITICAL"].includes(String(e?.severity || "").toUpperCase())
  ).length;
  const climateLinked = events.filter((e) =>
    CLIMATE_TYPES.has(String(e?.disasterType || "").toLowerCase())
  ).length;
  const climateShare = events.length
    ? Math.round((climateLinked / events.length) * 100)
    : 0;

  const byType = countByType(nearbyEvents.length ? nearbyEvents : events).slice(0, 6);
  const topHazard = byType[0]?.label || "";

  // Radar dimensions 0–100
  const canopy = clamp(treesTotal * 12, 0, 100);
  const voice = clamp(posts.length * 14, 0, 100);
  const echo = clamp(comments.length * 10 + likes.length * 4 + reposts.length * 6, 0, 100);
  const vigilance = clamp(100 - highNearby * 12, 12, 100);
  const continuity = clamp(
    bookmarks.length * 8 + (profile?.is_verified ? 20 : 0) + (places.length ? 15 : 0),
    0,
    100
  );

  const resilience = Math.round(
    canopy * 0.28 + voice * 0.18 + echo * 0.14 + vigilance * 0.25 + continuity * 0.15
  );

  const name =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.display_name ||
    profile.username ||
    "Climate Waver";

  const narrative = buildNarrative({
    name,
    placeLabel,
    treesTotal,
    posts: posts.length,
    nearby,
    climateShare,
    resilience,
    topHazard,
  });

  return {
    generated_at: new Date().toISOString(),
    summary: {
      name,
      place: placeLabel || "Global watch",
      trees_total: treesTotal,
      trees_bought: treesBought,
      trees_gifted: treesGifted,
      posts: posts.length,
      comments: comments.length,
      likes: likes.length,
      nearby_signals: nearby,
      high_nearby: highNearby,
      climate_share_pct: climateShare,
      resilience_index: resilience,
      top_hazard: topHazard || "—",
    },
    radar: {
      labels: ["Canopy", "Voice", "Echo", "Vigilance", "Continuity"],
      values: [canopy, voice, echo, vigilance, continuity],
    },
    balance: {
      labels: ["Hazard pressure", "Canopy response"],
      values: [
        clamp(nearby * 8 + highNearby * 10, 0, 100),
        clamp(treesTotal * 14 + posts.length * 5, 0, 100),
      ],
    },
    hazard_mix: {
      labels: byType.map((r) => r.label),
      values: byType.map((r) => r.value),
    },
    narrative,
    disclaimer:
      "Creative AI profile lens from live feeds + this member’s trees and activity. Verify official sources before acting.",
  };
}

export function profileImpactPrompt(report) {
  const s = report?.summary || {};
  return (
    `Write a short vivid Climate Wavers profile impact briefing (max 110 words) for ${s.name || "this member"}. ` +
    `Resilience Index ${s.resilience_index || 0}/100. Trees ${s.trees_total || 0}. Posts ${s.posts || 0}. ` +
    `Nearby/live signals ${s.nearby_signals || 0} (high/critical ${s.high_or_critical || s.high_nearby || 0}). ` +
    `Place: ${s.place || "n/a"}. Leading hazard: ${s.top_hazard || "n/a"}. ` +
    `Tone: hopeful, concrete, verified-first. No greenwashing.`
  );
}
