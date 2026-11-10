"""RapidBrief plan catalog used by apply, admin, and access checks."""

from datetime import timedelta
from typing import Optional

from django.utils import timezone

PLAN_PILOT = "pilot"
PLAN_NGO = "ngo"
PLAN_ORG = "org"
PLAN_PARTNER = "partner"

PLAN_STATUS_PENDING = "pending"
PLAN_STATUS_TRIAL = "trial"
PLAN_STATUS_ACTIVE = "active"
PLAN_STATUS_EXPIRED = "expired"

PLANS = {
    PLAN_PILOT: {
        "key": PLAN_PILOT,
        "name": "RapidBrief Pilot",
        "price_kes_month": 0,
        "price_label": "Free for 90 days",
        "max_seats": 5,
        "trial_days": 90,
        "detail": "Verified humanitarian orgs start with a free pilot.",
    },
    PLAN_NGO: {
        "key": PLAN_NGO,
        "name": "RapidBrief NGO",
        "price_kes_month": 5000,
        "price_label": "KES 5,000 / mo",
        "max_seats": 8,
        "trial_days": 90,
        "detail": "Small–mid NGOs and community response teams.",
    },
    PLAN_ORG: {
        "key": PLAN_ORG,
        "name": "RapidBrief Org",
        "price_kes_month": 15000,
        "price_label": "KES 15,000 / mo",
        "max_seats": 25,
        "trial_days": 90,
        "detail": "Counties, national NGOs, multi-seat desks.",
    },
    PLAN_PARTNER: {
        "key": PLAN_PARTNER,
        "name": "FlowOps Partner",
        "price_kes_month": None,
        "price_label": "Custom",
        "max_seats": 100,
        "trial_days": 90,
        "detail": "WhatsApp/AI setup, training, and priority support.",
    },
}

PLAN_CHOICES = [(key, meta["name"]) for key, meta in PLANS.items()]
PLAN_STATUS_CHOICES = [
    (PLAN_STATUS_PENDING, "Pending verification"),
    (PLAN_STATUS_TRIAL, "Trial"),
    (PLAN_STATUS_ACTIVE, "Active"),
    (PLAN_STATUS_EXPIRED, "Expired"),
]


def default_plan_for_org_type(org_type: str) -> str:
    org_type = (org_type or "").lower()
    if org_type in {"county", "government", "un"}:
        return PLAN_ORG
    if org_type in {"ngo", "red_cross", "medical", "fire", "police", "other"}:
        return PLAN_NGO
    return PLAN_NGO


def normalize_plan(plan: str, org_type: str = "") -> str:
    key = (plan or "").strip().lower()
    if key in PLANS:
        return key
    return default_plan_for_org_type(org_type)


def plan_meta(plan: str) -> dict:
    return PLANS.get(plan) or PLANS[PLAN_NGO]


def start_pilot(org, plan: Optional[str] = None):
    """Approve path: start free trial on the chosen/default plan."""
    chosen = normalize_plan(plan or getattr(org, "plan", None), org.org_type)
    meta = plan_meta(chosen)
    now = timezone.now()
    org.plan = chosen
    org.plan_status = PLAN_STATUS_TRIAL
    org.plan_started_at = now
    org.plan_ends_at = now + timedelta(days=int(meta.get("trial_days") or 90))
    org.max_seats = int(meta.get("max_seats") or 5)
    return org


def activate_paid_plan(org, plan: Optional[str] = None, months: int = 1):
    chosen = normalize_plan(plan or org.plan, org.org_type)
    meta = plan_meta(chosen)
    now = timezone.now()
    org.plan = chosen
    org.plan_status = PLAN_STATUS_ACTIVE
    org.plan_started_at = org.plan_started_at or now
    org.plan_ends_at = now + timedelta(days=max(1, int(months)) * 30)
    org.max_seats = int(meta.get("max_seats") or 5)
    return org


def refresh_plan_status(org) -> bool:
    """Expire trials/active windows. Returns True if org was changed."""
    if org.verification_status != "approved":
        return False
    if org.plan_status not in {PLAN_STATUS_TRIAL, PLAN_STATUS_ACTIVE}:
        return False
    if org.plan_ends_at and org.plan_ends_at < timezone.now():
        org.plan_status = PLAN_STATUS_EXPIRED
        return True
    return False


def has_rapidbrief_access(org) -> bool:
    if org.verification_status != "approved":
        return False
    changed = refresh_plan_status(org)
    if changed:
        org.save(update_fields=["plan_status", "updated_at"])
    return org.plan_status in {PLAN_STATUS_TRIAL, PLAN_STATUS_ACTIVE}
