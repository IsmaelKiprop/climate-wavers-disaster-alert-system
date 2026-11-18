"""
Per-species seedling inventory on TreeProject.tree_species JSON.

Shape:
  [{ "name": "Rhizophora", "target": 20000, "planted": 120, "price": 2.31 }, ...]

- remaining = max(0, target - planted)
- price (optional USD) overrides project.tree_price for that species
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple


def _as_int(value, default: int = 0) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return default


def _as_price(value) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        amount = Decimal(str(value))
    except Exception:
        return None
    if amount < 0:
        return None
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def normalize_tree_species(raw) -> List[Dict[str, Any]]:
    """Accept legacy string names or {name, target, planted, price} objects."""
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in raw:
        if item is None:
            continue
        if isinstance(item, str):
            name = item.strip()
            if name:
                out.append({"name": name, "target": 0, "planted": 0})
            continue
        if isinstance(item, dict):
            name = str(
                item.get("name")
                or item.get("species")
                or item.get("label")
                or ""
            ).strip()
            if not name:
                continue
            target = max(
                0,
                _as_int(
                    item.get("target")
                    or item.get("quantity")
                    or item.get("count")
                    or 0
                ),
            )
            planted = max(0, _as_int(item.get("planted") or item.get("sold") or 0))
            row: Dict[str, Any] = {
                "name": name,
                "target": target,
                "planted": planted,
            }
            price = _as_price(
                item.get("price")
                if "price" in item
                else item.get("unit_price")
                if "unit_price" in item
                else item.get("tree_price")
            )
            if price is not None:
                row["price"] = float(price)
            out.append(row)
    return out


def species_remaining(entry: Dict[str, Any]) -> int:
    target = int(entry.get("target") or 0)
    planted = int(entry.get("planted") or 0)
    if target <= 0:
        # Unlimited / untracked target — do not block sales
        return 10**9
    return max(0, target - planted)


def species_unit_price(entry: Optional[Dict[str, Any]], fallback) -> Decimal:
    """USD for one seedling of this species; falls back to project tree_price."""
    if entry:
        own = _as_price(entry.get("price"))
        if own is not None:
            return own
    return _as_price(fallback) or Decimal("0.00")


def with_remaining(raw) -> List[Dict[str, Any]]:
    out = []
    for s in normalize_tree_species(raw):
        rem = species_remaining(s)
        row = {
            **s,
            "remaining": rem if int(s.get("target") or 0) > 0 else None,
        }
        out.append(row)
    return out


def _clean_selected(selected_species) -> Dict[str, int]:
    if not isinstance(selected_species, dict):
        return {}
    cleaned: Dict[str, int] = {}
    for name, qty in selected_species.items():
        label = str(name or "").strip()
        if not label:
            continue
        n = _as_int(qty, 0)
        if n > 0:
            cleaned[label] = cleaned.get(label, 0) + n
    return cleaned


def validate_species_purchase(project, selected_species) -> Tuple[Dict[str, int], int]:
    """
    Validate selected_species against inventory.
    Returns (cleaned_selection, total_trees).
    Raises ValueError on oversell / unknown species when catalog exists.
    """
    cleaned = _clean_selected(selected_species)
    catalog = normalize_tree_species(getattr(project, "tree_species", None))
    if not catalog:
        total = sum(cleaned.values()) if cleaned else 0
        return cleaned, total

    by_name = {s["name"].lower(): s for s in catalog}
    for name, qty in cleaned.items():
        entry = by_name.get(name.lower())
        if entry is None:
            raise ValueError(f"Species “{name}” is not on this project.")
        rem = species_remaining(entry)
        if int(entry.get("target") or 0) > 0 and qty > rem:
            raise ValueError(
                f"Only {rem:,} “{entry['name']}” seedling(s) left "
                f"(requested {qty:,})."
            )
    total = sum(cleaned.values())
    return cleaned, total


def selection_total_usd(project, selected_species) -> Tuple[Decimal, int]:
    """
    USD cart total for a selection using per-species prices when set,
    otherwise project.tree_price.
    Returns (total_usd, tree_count).
    """
    cleaned, total_trees = validate_species_purchase(project, selected_species)
    fallback = getattr(project, "tree_price", 0)
    if not cleaned:
        return (
            (species_unit_price(None, fallback) * Decimal(max(total_trees, 0))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            ),
            total_trees,
        )

    catalog = normalize_tree_species(getattr(project, "tree_species", None))
    by_name = {s["name"].lower(): s for s in catalog}
    total = Decimal("0.00")
    for name, qty in cleaned.items():
        entry = by_name.get(name.lower())
        unit = species_unit_price(entry, fallback)
        total += unit * Decimal(int(qty))
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), total_trees


def _persist_row(s: Dict[str, Any]) -> Dict[str, Any]:
    row = {
        "name": s["name"],
        "target": int(s.get("target") or 0),
        "planted": int(s.get("planted") or 0),
    }
    price = _as_price(s.get("price"))
    if price is not None:
        row["price"] = float(price)
    return row


def apply_species_purchase(project, selected_species, *, save: bool = True) -> Dict[str, int]:
    """
    Increment planted counts for each species. Returns cleaned selection.
    Caller should also bump project.trees_planted by the total.
    """
    cleaned, _total = validate_species_purchase(project, selected_species)
    if not cleaned:
        return cleaned

    catalog = normalize_tree_species(getattr(project, "tree_species", None))
    if not catalog:
        return cleaned

    by_lower = {s["name"].lower(): s for s in catalog}
    for name, qty in cleaned.items():
        entry = by_lower.get(name.lower())
        if entry is None:
            continue
        entry["planted"] = int(entry.get("planted") or 0) + int(qty)

    project.tree_species = [_persist_row(s) for s in catalog]
    if save:
        project.save(update_fields=["tree_species"])
    return cleaned
