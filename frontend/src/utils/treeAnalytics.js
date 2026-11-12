function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function countBy(items, keyFn, valueFn = () => 1) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "Unknown";
    map.set(key, (map.get(key) || 0) + valueFn(item));
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

function dailyUserTrees(userTrees, n = 7) {
  const buckets = Array.from({ length: n }, () => 0);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (n - 1));

  for (const tree of userTrees) {
    const stamp = tree?.date || tree?.purchaseDate || tree?.created_at;
    const t = stamp ? new Date(stamp).getTime() : NaN;
    if (!Number.isFinite(t)) continue;
    const day = new Date(t);
    day.setHours(0, 0, 0, 0);
    const idx = Math.round((day.getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < n) buckets[idx] += 1;
  }
  return buckets;
}

function buildNarrative({ projects, stats, userStats, byCountry, byType }) {
  const totalTrees = num(stats?.total_trees_planted);
  const funds = num(stats?.total_funds_raised);
  const active = num(stats?.active_projects) || projects.length;
  const verified = num(stats?.verified_projects);
  const topCountry = byCountry[0]?.label;
  const topType = byType[0]?.label || "community reforestation";
  const myTrees = num(userStats?.treesPlanted);
  const myCo2 = num(userStats?.co2Offset);

  const openers = [
    "The canopy ledger is open: every verified project here is a quiet bet on cooler air and stronger local livelihoods.",
    "Think of this page as a living nursery dashboard — numbers with roots, not vanity metrics.",
    "Climate Wavers turns tree gifts into geography you can point to. Here’s the pulse of the grove.",
  ];
  const opener = openers[(totalTrees + myTrees) % openers.length];

  const networkLine =
    `${active} active project${active === 1 ? "" : "s"}` +
    (verified ? ` (${verified} verified)` : "") +
    ` have logged about ${totalTrees.toLocaleString()} trees` +
    (funds > 0 ? ` and ~$${Math.round(funds).toLocaleString()} raised` : "") +
    ".";

  const placeLine = topCountry
    ? `${topCountry} currently leads the map for planted volume — a signal to gift there if you want density, or diversify if you want resilience across biomes.`
    : "Plantings are spread across several countries — a healthy mosaic rather than a single monoculture story.";

  const typeLine = `Project mix leans ${topType}. Pair a gift with a short why-note so recipients feel the place, not just the count.`;

  const personalLine =
    myTrees > 0
      ? `Your grove so far: ${myTrees} tree${myTrees === 1 ? "" : "s"}` +
        (myCo2 > 0 ? ` and roughly ${Math.round(myCo2)} kg CO₂ absorption potential` : "") +
        `. One more gift compounds both impact and story.`
      : "You haven’t logged a personal planting yet — start with one verified project and make the first certificate yours (or a gift).";

  const close =
    "This briefing is AI-assisted from live project stats. Always confirm project pages before large gifts.";

  return [opener, networkLine, placeLine, typeLine, personalLine, close].join("\n\n");
}

/**
 * Build chart-ready tree / plant analytics from projects, API stats, and user trees.
 */
export function buildTreeAnalytics({
  projects = [],
  stats = {},
  userTrees = [],
  userStats = {},
} = {}) {
  const list = Array.isArray(projects) ? projects : [];
  const trees = Array.isArray(userTrees) ? userTrees : [];

  const byCountry = countBy(
    list,
    (p) => String(p?.country || "").trim() || "Unknown",
    (p) => num(p?.trees_planted)
  ).slice(0, 8);

  const byType = countBy(
    list,
    (p) =>
      String(p?.project_type || p?.type || p?.category || "Reforestation")
        .replace(/_/g, " ")
        .trim() || "Reforestation"
  ).slice(0, 8);

  const byOrg = countBy(
    list,
    (p) => String(p?.organization_name || p?.organization || "Independent").trim(),
    (p) => num(p?.trees_planted)
  ).slice(0, 6);

  const progressLeaders = [...list]
    .map((p) => ({
      label: String(p?.name || "Project").slice(0, 28),
      value: Math.min(100, Math.round(num(p?.progress_percentage) || (num(p?.target_trees) ? (num(p?.trees_planted) / num(p?.target_trees)) * 100 : 0))),
      trees: num(p?.trees_planted),
      target: num(p?.target_trees),
      country: p?.country || "",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const dayLabels = lastNDaysLabels(7);
  const dayValues = dailyUserTrees(trees, 7);

  const derivedStats = {
    total_projects: num(stats?.total_projects) || list.length,
    active_projects: num(stats?.active_projects) || list.filter((p) => String(p?.status || "active").toLowerCase() === "active").length || list.length,
    verified_projects: num(stats?.verified_projects) || list.filter((p) => p?.is_verified).length,
    total_trees_planted:
      num(stats?.total_trees_planted) ||
      list.reduce((sum, p) => sum + num(p?.trees_planted), 0),
    total_funds_raised:
      num(stats?.total_funds_raised) ||
      list.reduce((sum, p) => sum + num(p?.funds_raised), 0),
  };

  const summary = {
    ...derivedStats,
    my_trees: num(userStats?.treesPlanted) || trees.length,
    my_co2: Math.round(num(userStats?.co2Offset)),
    impact_score: num(userStats?.impactScore),
    top_country: byCountry[0]?.label || "—",
    countries: byCountry.length,
  };

  const narrative = buildNarrative({
    projects: list,
    stats: derivedStats,
    userStats,
    byCountry,
    byType,
  });

  return {
    generated_at: new Date().toISOString(),
    summary,
    charts: {
      by_country: {
        labels: byCountry.map((r) => r.label),
        values: byCountry.map((r) => r.value),
      },
      by_type: {
        labels: byType.map((r) => r.label),
        values: byType.map((r) => r.value),
      },
      by_org: {
        labels: byOrg.map((r) => r.label),
        values: byOrg.map((r) => r.value),
      },
      progress: {
        labels: progressLeaders.map((r) => r.label),
        values: progressLeaders.map((r) => r.value),
      },
      my_activity_7d: {
        labels: dayLabels,
        values: dayValues,
      },
    },
    progress_table: progressLeaders,
    narrative,
    disclaimer:
      "AI-assisted analysis of Climate Wavers tree projects and your planting history. Verify project details before gifting.",
  };
}

export function treeAnalyticsPrompt(report) {
  const s = report?.summary || {};
  return (
    `Write a short, vivid Climate Wavers reforestation briefing (max 120 words) for someone on the Plant a Tree page. ` +
    `Network trees planted: ${s.total_trees_planted || 0}. Active projects: ${s.active_projects || 0}. ` +
    `Funds raised: $${Math.round(s.total_funds_raised || 0)}. Top country: ${s.top_country || "n/a"}. ` +
    `Their trees: ${s.my_trees || 0}. Tone: hopeful, concrete, gift-friendly. No greenwashing.`
  );
}
