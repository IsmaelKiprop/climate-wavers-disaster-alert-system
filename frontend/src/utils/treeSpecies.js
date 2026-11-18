/**
 * Normalize tree_species JSON to
 * [{ name, target, planted, remaining, price }].
 * remaining = target > 0 ? max(0, target - planted) : null (untracked).
 * price = per-species USD when set; null means use project tree_price.
 */
export function normalizeTreeSpecies(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (item == null) continue;
    if (typeof item === "string") {
      const name = item.trim();
      if (!name) continue;
      out.push({ name, target: 0, planted: 0, remaining: null, price: null });
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
      const rawPrice = item.price ?? item.unit_price ?? item.tree_price;
      let price = null;
      if (rawPrice != null && rawPrice !== "") {
        const n = Number(rawPrice);
        if (Number.isFinite(n) && n >= 0) price = n;
      }
      out.push({ name, target, planted, remaining, price });
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

/** USD price for one seedling of this species (falls back to project price). */
export function speciesUnitPrice(entry, fallbackPrice = 0) {
  const own = entry?.price;
  if (own != null && Number.isFinite(Number(own)) && Number(own) >= 0) {
    return Number(own);
  }
  const fb = Number(fallbackPrice);
  return Number.isFinite(fb) && fb >= 0 ? fb : 0;
}

/**
 * Cart total in USD from selected_species map + catalog.
 * selected = { "Mango": 2, "Avocado": 1 }
 */
export function selectionTotalUsd(
  selected = {},
  catalogRaw = [],
  fallbackPrice = 0
) {
  const catalog = normalizeTreeSpecies(catalogRaw);
  const byName = new Map(catalog.map((s) => [s.name.toLowerCase(), s]));
  let total = 0;
  let qty = 0;
  for (const [name, rawQty] of Object.entries(selected || {})) {
    const n = Math.max(0, parseInt(rawQty, 10) || 0);
    if (!n) continue;
    qty += n;
    const entry = byName.get(String(name || "").toLowerCase());
    total += n * speciesUnitPrice(entry, fallbackPrice);
  }
  return { total, quantity: qty };
}

export function formatSpeciesList(raw, { withTargets = true, withRemaining = false, withPrice = false, fallbackPrice = null } = {}) {
  const list = normalizeTreeSpecies(raw);
  if (!list.length) return "";
  return list
    .map((s) => {
      const bits = [s.name];
      if (withPrice) {
        const p = speciesUnitPrice(s, fallbackPrice);
        bits.push(`$${Number(p).toFixed(2)}`);
      }
      if (withRemaining && s.target > 0) {
        const rem = speciesRemaining(s);
        bits.push(
          `${(s.planted || 0).toLocaleString()}/${s.target.toLocaleString()} · ${rem.toLocaleString()} left`
        );
      } else if (withTargets && s.target > 0) {
        bits.push(`(${s.target.toLocaleString()})`);
      }
      return bits.join(" ");
    })
    .join(", ");
}

/** Persist shape for API — keep planted + optional per-species price. */
export function serializeTreeSpecies(raw) {
  return normalizeTreeSpecies(raw)
    .filter((s) => s.name)
    .map((s) => {
      const row = {
        name: s.name,
        target: Math.max(0, parseInt(s.target, 10) || 0),
        planted: Math.max(0, parseInt(s.planted, 10) || 0),
      };
      if (s.price != null && Number.isFinite(Number(s.price)) && Number(s.price) >= 0) {
        row.price = Number(Number(s.price).toFixed(2));
      }
      return row;
    });
}
