"""Tree Admin plan catalog + platform fee on tree purchases."""

from datetime import timedelta
from decimal import Decimal
from typing import Optional, Tuple

from django.utils import timezone

PLAN_PILOT = "pilot"
PLAN_GROWTH = "growth"
PLAN_PARTNER = "partner"

PLAN_STATUS_PENDING = "pending"
PLAN_STATUS_TRIAL = "trial"
PLAN_STATUS_ACTIVE = "active"
PLAN_STATUS_EXPIRED = "expired"

PLATFORM_FEE_RATE = Decimal("0.18")

PLANS = {
    PLAN_PILOT: {
        "key": PLAN_PILOT,
        "name": "Tree Admin Pilot",
        "price_kes_month": 0,
        "price_label": "Free for 90 days",
        "max_active_projects": 2,
        "trial_days": 90,
        "detail": "Verified local planters start with a free pilot.",
    },
    PLAN_GROWTH: {
        "key": PLAN_GROWTH,
        "name": "Tree Admin Growth",
        "price_kes_month": 3000,
        "price_label": "KES 3,000 / mo",
        "max_active_projects": 5,
        "trial_days": 90,
        "detail": "Multi-project orgs with featured listing.",
    },
    PLAN_PARTNER: {
        "key": PLAN_PARTNER,
        "name": "Tree Admin Partner",
        "price_kes_month": None,
        "price_label": "Custom",
        "max_active_projects": None,
        "trial_days": 90,
        "detail": "Multi-town ops, payout priority, FlowOps support.",
    },
}

PLAN_CHOICES = [(key, meta["name"]) for key, meta in PLANS.items()]
PLAN_STATUS_CHOICES = [
    (PLAN_STATUS_PENDING, "Pending verification"),
    (PLAN_STATUS_TRIAL, "Trial"),
    (PLAN_STATUS_ACTIVE, "Active"),
    (PLAN_STATUS_EXPIRED, "Expired"),
]


def normalize_plan(plan: str) -> str:
    key = (plan or "").strip().lower()
    if key in PLANS:
        return key
    return PLAN_PILOT


def plan_meta(plan: str) -> dict:
    return PLANS.get(plan) or PLANS[PLAN_PILOT]


def start_tree_pilot(org, plan: Optional[str] = None):
    """Approve path: start free trial on the chosen/default plan."""
    chosen = normalize_plan(plan or getattr(org, "plan", None))
    meta = plan_meta(chosen)
    now = timezone.now()
    org.plan = chosen
    org.plan_status = PLAN_STATUS_TRIAL
    org.plan_started_at = now
    org.plan_ends_at = now + timedelta(days=int(meta.get("trial_days") or 90))
    return org


def activate_paid_plan(org, plan: Optional[str] = None, months: int = 1):
    chosen = normalize_plan(plan or org.plan)
    meta = plan_meta(chosen)
    now = timezone.now()
    org.plan = chosen
    org.plan_status = PLAN_STATUS_ACTIVE
    org.plan_started_at = org.plan_started_at or now
    org.plan_ends_at = now + timedelta(days=max(1, int(months)) * 30)
    return org


def refresh_plan_status(org) -> bool:
    if org.verification_status != "approved":
        return False
    if org.plan_status not in {PLAN_STATUS_TRIAL, PLAN_STATUS_ACTIVE}:
        return False
    if org.plan_ends_at and org.plan_ends_at < timezone.now():
        org.plan_status = PLAN_STATUS_EXPIRED
        return True
    return False


def has_tree_admin_access(org) -> bool:
    if org.verification_status != "approved":
        return False
    changed = refresh_plan_status(org)
    if changed:
        org.save(update_fields=["plan_status", "updated_at"])
    return org.plan_status in {PLAN_STATUS_TRIAL, PLAN_STATUS_ACTIVE}


def max_active_projects(org) -> Optional[int]:
    return plan_meta(org.plan).get("max_active_projects")


def split_tree_payment(amount) -> Tuple[Decimal, Decimal, Decimal]:
    """Return (platform_fee, admin_share, fee_rate) for a gross payment amount."""
    gross = Decimal(str(amount or 0)).quantize(Decimal("0.01"))
    rate = PLATFORM_FEE_RATE
    platform_fee = (gross * rate).quantize(Decimal("0.01"))
    admin_share = (gross - platform_fee).quantize(Decimal("0.01"))
    return platform_fee, admin_share, rate


# Paystack charges KES; project.funds_raised is tracked in USD.
DEFAULT_USD_KES = Decimal("150")


def _as_decimal(value, default: Optional[Decimal] = None) -> Optional[Decimal]:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def kes_to_usd(amount_kes, rate=None) -> Decimal:
    kes = _as_decimal(amount_kes, Decimal("0")) or Decimal("0")
    usd_kes = _as_decimal(rate, DEFAULT_USD_KES) or DEFAULT_USD_KES
    if usd_kes <= 0:
        usd_kes = DEFAULT_USD_KES
    return (kes / usd_kes).quantize(Decimal("0.01"))


def donation_amount_usd(donation, project=None, *, metadata=None, kes_amount=None) -> Decimal:
    """
    Best-effort USD gross for a tree donation.
    Prefer explicit USD from checkout metadata, then species×prices, then KES÷rate.
    """
    meta = metadata if isinstance(metadata, dict) else {}
    for key in ("amount_usd", "original_usd", "usd_amount", "price_usd"):
        raw = meta.get(key)
        if raw is None and donation is not None and hasattr(donation, key):
            raw = getattr(donation, key, None)
        parsed = _as_decimal(raw)
        if parsed is not None and parsed > 0:
            return parsed.quantize(Decimal("0.01"))

    proj = project or (getattr(donation, "project", None) if donation is not None else None)
    selected = (
        (getattr(donation, "selected_species", None) if donation is not None else None)
        or meta.get("selected_species")
        or {}
    )
    if isinstance(selected, str):
        try:
            import json

            selected = json.loads(selected)
        except Exception:
            selected = {}
    if proj is not None and isinstance(selected, dict) and selected:
        try:
            from .tree_inventory import normalize_tree_species

            catalog = {
                str(s.get("name") or "").strip().lower(): s
                for s in normalize_tree_species(getattr(proj, "tree_species", None))
            }
            fallback = _as_decimal(getattr(proj, "tree_price", 0), Decimal("0")) or Decimal("0")
            total = Decimal("0")
            for name, qty in selected.items():
                try:
                    q = int(qty or 0)
                except (TypeError, ValueError):
                    q = 0
                if q <= 0:
                    continue
                row = catalog.get(str(name or "").strip().lower()) or {}
                unit = _as_decimal(row.get("price"), fallback) or fallback
                total += unit * Decimal(q)
            if total > 0:
                return total.quantize(Decimal("0.01"))
        except Exception:
            pass

    rate = _as_decimal(meta.get("usd_kes_rate") or meta.get("exchange_rate"), DEFAULT_USD_KES)
    kes = _as_decimal(
        kes_amount
        if kes_amount is not None
        else getattr(donation, "amount", None),
        Decimal("0"),
    ) or Decimal("0")
    return kes_to_usd(kes, rate)


def project_funds_raised_usd(project) -> Decimal:
    """Sum Tree Admin USD share from completed donations (does not save)."""
    from .models import TreeProjectDonation

    total = Decimal("0.00")
    qs = TreeProjectDonation.objects.filter(
        project_id=project.pk, payment_status="completed"
    ).only("amount", "admin_share", "selected_species", "trees_purchased")
    for donation in qs:
        usd_gross = donation_amount_usd(donation, project)
        _fee, admin_share_usd, _rate = split_tree_payment(usd_gross)
        total += admin_share_usd
    return total.quantize(Decimal("0.01"))


def recompute_project_funds_raised(project) -> Decimal:
    """Persist funds_raised (USD) from completed donations — Tree Admin share only."""
    project.funds_raised = project_funds_raised_usd(project)
    project.save(update_fields=["funds_raised"])
    return project.funds_raised
