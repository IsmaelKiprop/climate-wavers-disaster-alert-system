"""
Per-species seedling inventory on TreeProject.tree_species JSON.

Shape: [{ "name": "Rhizophora", "target": 20000, "planted": 120 }, ...]
remaining = max(0, target - planted)
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple


def normalize_tree_species(raw) -> List[Dict[str, Any]]:
    """Accept legacy string names or {name, target, planted} objects."""
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
            try:
                target = int(
                    item.get("target")
                    or item.get("quantity")
                    or item.get("count")
                    or 0
                )
            except (TypeError, ValueError):
                target = 0
            try:
                planted = int(item.get("planted") or item.get("sold") or 0)
            except (TypeError, ValueError):
                planted = 0
            out.append(
                {
                    "name": name,
                    "target": max(0, target),
                    "planted": max(0, planted),
                }
            )
    return out


def species_remaining(entry: Dict[str, Any]) -> int:
    target = int(entry.get("target") or 0)
    planted = int(entry.get("planted") or 0)
    if target <= 0:
        # Unlimited / untracked target — do not block sales
        return 10**9
    return max(0, target - planted)


def with_remaining(raw) -> List[Dict[str, Any]]:
    out = []
    for s in normalize_tree_species(raw):
        rem = species_remaining(s)
        out.append(
            {
                **s,
                "remaining": rem if int(s.get("target") or 0) > 0 else None,
            }
        )
    return out


def _clean_selected(selected_species) -> Dict[str, int]:
    if not isinstance(selected_species, dict):
        return {}
    cleaned: Dict[str, int] = {}
    for name, qty in selected_species.items():
        label = str(name or "").strip()
        if not label:
            continue
        try:
            n = int(qty or 0)
        except (TypeError, ValueError):
            n = 0
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

    project.tree_species = [
        {
            "name": s["name"],
            "target": int(s.get("target") or 0),
            "planted": int(s.get("planted") or 0),
        }
        for s in catalog
    ]
    if save:
        project.save(update_fields=["tree_species"])
    return cleaned
