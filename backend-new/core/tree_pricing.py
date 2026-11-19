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


def resolve_platform_fee_rate(org=None) -> Decimal:
    """Per-org fee rate when set; otherwise global PLATFORM_FEE_RATE."""
    if org is not None:
        raw = getattr(org, "platform_fee_rate", None)
        if raw is not None and str(raw).strip() != "":
            try:
                rate = Decimal(str(raw))
                if Decimal("0") <= rate < Decimal("1"):
                    return rate.quantize(Decimal("0.0001"))
            except Exception:
                pass
    return PLATFORM_FEE_RATE


def split_tree_payment(amount, fee_rate=None, org=None) -> Tuple[Decimal, Decimal, Decimal]:
    """Return (platform_fee, admin_share, fee_rate) for a gross payment amount."""
    gross = Decimal(str(amount or 0)).quantize(Decimal("0.01"))
    if fee_rate is not None and str(fee_rate).strip() != "":
        try:
            rate = Decimal(str(fee_rate))
            if not (Decimal("0") <= rate < Decimal("1")):
                rate = resolve_platform_fee_rate(org)
        except Exception:
            rate = resolve_platform_fee_rate(org)
    else:
        rate = resolve_platform_fee_rate(org)
    rate = rate.quantize(Decimal("0.0001"))
    platform_fee = (gross * rate).quantize(Decimal("0.01"))
    admin_share = (gross - platform_fee).quantize(Decimal("0.01"))
    return platform_fee, admin_share, rate


# Paystack charges KES; project.funds_raised is tracked in USD.
# Soft fallback only — prefer live market via core.fx / checkout metadata.
DEFAULT_USD_KES = Decimal("130")


def _as_decimal(value, default: Optional[Decimal] = None) -> Optional[Decimal]:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def kes_to_usd(amount_kes, rate=None) -> Decimal:
    from .fx import kes_to_usd as fx_kes_to_usd

    kes = _as_decimal(amount_kes, Decimal("0")) or Decimal("0")
    if rate is not None:
        usd_kes = _as_decimal(rate)
        if usd_kes and usd_kes > 0:
            return (kes / usd_kes).quantize(Decimal("0.01"))
    return fx_kes_to_usd(kes)


def donation_usd_from_species(donation, project=None) -> Optional[Decimal]:
    """USD gross from trees_purchased × catalog prices (authoritative when present)."""
    proj = project or (getattr(donation, "project", None) if donation is not None else None)
    if proj is None:
        return None
    selected = getattr(donation, "selected_species", None) or {}
    if isinstance(selected, str):
        try:
            import json

            selected = json.loads(selected)
        except Exception:
            selected = {}
    trees = int(getattr(donation, "trees_purchased", 0) or 0)
    fallback = _as_decimal(getattr(proj, "tree_price", 0), Decimal("0")) or Decimal("0")
    if isinstance(selected, dict) and selected:
        try:
            from .tree_inventory import normalize_tree_species

            catalog = {
                str(s.get("name") or "").strip().lower(): s
                for s in normalize_tree_species(getattr(proj, "tree_species", None))
            }
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
    if trees > 0 and fallback > 0:
        return (fallback * Decimal(trees)).quantize(Decimal("0.01"))
    return None


def donation_amount_usd(donation, project=None, *, metadata=None, kes_amount=None) -> Decimal:
    """
    Best-effort USD gross for a tree donation.
    Prefer explicit USD from checkout metadata, then species×prices, then KES÷live rate.
    """
    meta = metadata if isinstance(metadata, dict) else {}
    for key in ("amount_usd", "original_usd", "usd_amount", "price_usd"):
        raw = meta.get(key)
        if raw is None and donation is not None and hasattr(donation, key):
            raw = getattr(donation, key, None)
        parsed = _as_decimal(raw)
        if parsed is not None and parsed > 0:
            return parsed.quantize(Decimal("0.01"))

    species_usd = donation_usd_from_species(donation, project)
    if species_usd is not None and species_usd > 0:
        return species_usd

    rate = _as_decimal(meta.get("usd_kes_rate") or meta.get("exchange_rate"))
    kes = _as_decimal(
        kes_amount
        if kes_amount is not None
        else getattr(donation, "amount", None),
        Decimal("0"),
    ) or Decimal("0")
    return kes_to_usd(kes, rate)


def expected_admin_share_usd(donation, project=None) -> Tuple[Decimal, Decimal, Decimal]:
    """Return (platform_fee, admin_share, fee_rate) from true USD gross."""
    proj = project or getattr(donation, "project", None)
    org = getattr(proj, "tree_admin_org", None) if proj is not None else None
    usd_gross = donation_amount_usd(donation, proj)
    fee_rate = getattr(donation, "fee_rate", None)
    return split_tree_payment(usd_gross, fee_rate=fee_rate, org=org)


def admin_share_looks_inflated(donation, project=None) -> bool:
    """
    Detect KES-as-USD fee split: stored admin_share ≈ KES×(1-fee) instead of USD share.
    """
    stored = _as_decimal(getattr(donation, "admin_share", None), Decimal("0")) or Decimal("0")
    if stored <= 0:
        return False
    _fee, expected, _rate = expected_admin_share_usd(donation, project)
    if expected <= 0:
        return stored > Decimal("5")
    # Inflated if stored is much larger than price-based share (e.g. $94 vs $0.82)
    if stored > expected * Decimal("2.5") and stored - expected > Decimal("1"):
        return True
    kes = _as_decimal(getattr(donation, "amount", None), Decimal("0")) or Decimal("0")
    if kes > 0:
        # Classic bug: admin_share ≈ amount_kes * (1 - fee)
        fee = _as_decimal(getattr(donation, "fee_rate", None), PLATFORM_FEE_RATE) or PLATFORM_FEE_RATE
        kes_as_share = (kes * (Decimal("1") - fee)).quantize(Decimal("0.01"))
        if abs(stored - kes_as_share) <= Decimal("0.05") and stored > expected * Decimal("2"):
            return True
    return False


def repair_donation_fee_split(donation, project=None, *, save: bool = True) -> bool:
    """Rewrite platform_fee/admin_share from true USD. Returns True if changed."""
    proj = project or getattr(donation, "project", None)
    fee, share, rate = expected_admin_share_usd(donation, proj)
    changed = False
    updates = []
    for field, value in (
        ("platform_fee", fee),
        ("admin_share", share),
        ("fee_rate", rate),
    ):
        current = _as_decimal(getattr(donation, field, None))
        if current is None or abs(current - value) > Decimal("0.001"):
            setattr(donation, field, value)
            updates.append(field)
            changed = True
    if changed and save and updates:
        donation.save(update_fields=updates)
    return changed


def project_funds_raised_usd(project) -> Decimal:
    """Sum Tree Admin USD share from completed donations (does not save)."""
    from .models import TreeProjectDonation

    total = Decimal("0.00")
    qs = TreeProjectDonation.objects.filter(
        project_id=project.pk, payment_status="completed"
    ).select_related("project", "project__tree_admin_org")
    for donation in qs:
        # Always derive from USD gross — never trust possibly inflated stored share
        _fee, admin_share_usd, _rate = expected_admin_share_usd(donation, project)
        total += admin_share_usd
    return total.quantize(Decimal("0.01"))


def recompute_project_funds_raised(project, *, repair_donations: bool = True) -> Decimal:
    """Persist funds_raised (USD) from completed donations — Tree Admin share only."""
    if repair_donations:
        from .models import TreeProjectDonation

        for donation in TreeProjectDonation.objects.filter(
            project_id=project.pk, payment_status="completed"
        ).select_related("project", "project__tree_admin_org"):
            repair_donation_fee_split(donation, project, save=True)
    project.funds_raised = project_funds_raised_usd(project)
    project.save(update_fields=["funds_raised"])
    return project.funds_raised


def repair_all_tree_project_funds() -> dict:
    """Repair fee splits + funds_raised for every tree project."""
    from .models import TreeProject, TreeProjectDonation

    fixed_donations = 0
    for donation in TreeProjectDonation.objects.filter(
        payment_status="completed"
    ).select_related("project", "project__tree_admin_org"):
        if repair_donation_fee_split(donation, donation.project, save=True):
            fixed_donations += 1
    projects = 0
    for project in TreeProject.objects.all():
        recompute_project_funds_raised(project, repair_donations=False)
        projects += 1
    return {"donations_repaired": fixed_donations, "projects_recomputed": projects}
