/**
 * Normalize tree_species JSON to
 * [{ name, target, planted, remaining }].
 * remaining = target > 0 ? max(0, target - planted) : null (untracked).
 */
export function normalizeTreeSpecies(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item == null) continue;
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) continue;
      out.push({ name, target: 0, planted: 0, remaining: null });
      continue;
    }
    if (typeof item === "object") {
      const name = String(item.name || item.species || item.label || "").trim();
      if (!name) continue;
      const target = Math.max(
        0,
        parseInt(item.target ?? item.quantity ?? item.count ?? 0, 10) || 0
      );
      const planted = Math.max(
        0,
        parseInt(item.planted ?? item.sold ?? 0, 10) || 0
      );
      const remaining =
        item.remaining != null && item.remaining !== ""
          ? Math.max(0, parseInt(item.remaining, 10) || 0)
          : target > 0
            ? Math.max(0, target - planted)
            : null;
      out.push({ name, target, planted, remaining });
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

export function speciesPlantedSum(raw) {
  return normalizeTreeSpecies(raw).reduce((sum, s) => sum + (s.planted || 0), 0);
}

export function speciesRemaining(entry) {
  if (!entry) return null;
  if (entry.remaining != null) return entry.remaining;
  if (!entry.target) return null;
  return Math.max(0, (entry.target || 0) - (entry.planted || 0));
}

export function formatSpeciesList(raw, { withTargets = true, withRemaining = false } = {}) {
  const list = normalizeTreeSpecies(raw);
  if (!list.length) return "";
  return list
    .map((s) => {
      if (withRemaining && s.target > 0) {
        const rem = speciesRemaining(s);
        return `${s.name} (${(s.planted || 0).toLocaleString()}/${s.target.toLocaleString()} · ${rem.toLocaleString()} left)`;
      }
      if (withTargets && s.target > 0) {
        return `${s.name} (${s.target.toLocaleString()})`;
      }
      return s.name;
    })
    .join(", ");
}

/** Persist shape for API — keep planted so admin edits do not wipe inventory. */
export function serializeTreeSpecies(raw) {
  return normalizeTreeSpecies(raw)
    .filter((s) => s.name)
    .map((s) => ({
      name: s.name,
      target: Math.max(0, parseInt(s.target, 10) || 0),
      planted: Math.max(0, parseInt(s.planted, 10) || 0),
    }));
}
