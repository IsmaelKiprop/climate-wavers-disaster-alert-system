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
