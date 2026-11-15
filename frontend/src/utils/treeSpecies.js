/**
 * Normalize tree_species JSON (legacy string[] or {name,target}[]) to
 * [{ name: string, target: number }].
 */
export function normalizeTreeSpecies(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item == null) continue;
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) continue;
      out.push({ name, target: 0 });
      continue;
    }
    if (typeof item === "object") {
      const name = String(item.name || item.species || item.label || "").trim();
      if (!name) continue;
      const target = Math.max(0, parseInt(item.target ?? item.quantity ?? item.count ?? 0, 10) || 0);
      out.push({ name, target });
    }
  }
  return out;
}

export function speciesNames(raw) {
  return normalizeTreeSpecies(raw).map((s) => s.name);
}

export function speciesTargetSum(raw) {
  return normalizeTreeSpecies(raw).reduce((sum, s) => sum + (s.target || 0), 0);
}

export function formatSpeciesList(raw, { withTargets = true } = {}) {
  const list = normalizeTreeSpecies(raw);
  if (!list.length) return "";
  return list
    .map((s) =>
      withTargets && s.target > 0
        ? `${s.name} (${s.target.toLocaleString()})`
        : s.name
    )
    .join(", ");
}

/** Persist shape for API — always objects when targets matter. */
export function serializeTreeSpecies(raw) {
  return normalizeTreeSpecies(raw)
    .filter((s) => s.name)
    .map((s) => ({
      name: s.name,
      target: Math.max(0, parseInt(s.target, 10) || 0),
    }));
}
