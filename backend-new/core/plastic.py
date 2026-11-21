"""
Wavers Plastic Pulse — projects, hotspots, holding zones, recoveries,
direct recycler dispatches, recycler intake, sponsor-a-kilo, certificates.
"""

from __future__ import annotations

import logging
import math
import re
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Optional
from urllib.parse import quote

# Phone GPS is noisy in dense neighborhoods — match "same place", not exact pin.
HOTSPOT_PROXIMITY_RADIUS_M = 250

from django.conf import settings as dj_settings
from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from .models import (
    Notification,
    PlasticCertificate,
    PlasticDispatch,
    PlasticHoldingZone,
    PlasticHotspot,
    PlasticInventoryLedger,
    PlasticProject,
    PlasticRecovery,
    PlasticRecyclerPartner,
    PlasticSponsorship,
    TreeAdminMembership,
)

DEFAULT_COLLECTION_DAYS = ["mon", "wed", "sat"]
DEFAULT_HOLDING_ZONE_MATERIALS = ["plastic", "paper_bags", "PET", "HDPE", "LDPE", "PP"]
DEFAULT_MARKETPLACE_FEE_RATE = Decimal("0.20")


def _clamp_fee_rate(value) -> Decimal:
    rate = _dec(value, str(DEFAULT_MARKETPLACE_FEE_RATE))
    if rate < 0:
        return Decimal("0")
    if rate > Decimal("0.5"):
        return Decimal("0.5")
    return rate.quantize(Decimal("0.0001"))


def split_plastic_marketplace_sale(total_kes, fee_rate=None) -> tuple:
    """
    Recycler pays Climate Wavers; CW keeps platform share and pays collectors.
    Returns (platform_share, collector_share, fee_rate).
    """
    total = _money(total_kes)
    rate = _clamp_fee_rate(
        fee_rate if fee_rate is not None else DEFAULT_MARKETPLACE_FEE_RATE
    )
    platform = _money(total * rate)
    collectors = _money(total - platform)
    return platform, collectors, rate


def _ensure_default_holding_zones(project: PlasticProject) -> list:
    """Ground ops baseline: 3 holding zones per CBO project."""
    existing = list(project.holding_zones.all().order_by("sort_order", "id"))
    if existing:
        return existing
    created = []
    for i in range(1, 4):
        created.append(
            PlasticHoldingZone.objects.create(
                project=project,
                name=f"Holding zone {i}",
                code=f"HZ-{i}",
                materials=list(DEFAULT_HOLDING_ZONE_MATERIALS),
                inventory_kg=Decimal("0"),
                sort_order=i,
            )
        )
    return created


def _pick_holding_zone(project: PlasticProject, zone_id=None) -> PlasticHoldingZone:
    zones = _ensure_default_holding_zones(project)
    if zone_id:
        for z in zones:
            if z.id == int(zone_id):
                return z
        raise ValueError("Holding zone not found.")
    # Fill the lightest zone first (even load across 3 sites).
    return min(zones, key=lambda z: (float(z.inventory_kg or 0), z.sort_order, z.id))


def _bump_polymer_inventory(zone: PlasticHoldingZone, polymer: str, delta: Decimal):
    polymer = str(polymer or "mixed")
    data = dict(zone.inventory_by_polymer or {})
    current = _dec(data.get(polymer, 0))
    nxt = _money(current + delta)
    if nxt < 0:
        nxt = Decimal("0.00")
    data[polymer] = float(nxt)
    zone.inventory_by_polymer = data


def apply_inventory_delta(
    *,
    zone: PlasticHoldingZone,
    delta_kg,
    reason: str,
    polymer_type: str = "mixed",
    user=None,
    recovery=None,
    dispatch=None,
    notes: str = "",
) -> PlasticInventoryLedger:
    """Atomically adjust zone stock and write a ledger row."""
    delta = _money(delta_kg)
    zone = PlasticHoldingZone.objects.select_for_update().get(pk=zone.pk)
    new_bal = _money(zone.inventory_kg + delta)
    if new_bal < 0:
        raise ValueError(
            f"Insufficient inventory in {zone.name}: have {zone.inventory_kg} kg."
        )
    zone.inventory_kg = new_bal
    _bump_polymer_inventory(zone, polymer_type, delta)
    zone.save(update_fields=["inventory_kg", "inventory_by_polymer", "updated_at"])
    return PlasticInventoryLedger.objects.create(
        project_id=zone.project_id,
        holding_zone=zone,
        recovery=recovery,
        dispatch=dispatch,
        created_by=user if getattr(user, "is_authenticated", False) else None,
        delta_kg=delta,
        balance_after_kg=new_bal,
        polymer_type=str(polymer_type or "mixed")[:20],
        reason=reason,
        notes=str(notes or "")[:255],
    )


from .tree_admin import primary_tree_admin_membership, user_has_tree_admin_access
from .tree_pricing import resolve_platform_fee_rate, split_tree_payment


def _dec(value, default="0") -> Decimal:
    try:
        return Decimal(str(value if value is not None else default))
    except Exception:
        return Decimal(default)


def _money(value) -> Decimal:
    return _dec(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _notify(user, message: str, obj=None):
    if not user:
        return
    kwargs = {
        "user": user,
        "notification_type": "plastic",
        "message": message,
    }
    if obj is not None:
        from django.contrib.contenttypes.models import ContentType

        kwargs["content_type"] = ContentType.objects.get_for_model(obj)
        kwargs["object_id"] = obj.pk
    try:
        Notification.objects.create(**kwargs)
    except Exception:
        pass


def _org_membership(user) -> Optional[TreeAdminMembership]:
    return primary_tree_admin_membership(user)


def _normalize_claim_pin(value) -> str:
    """Digits-only PIN for CBO ↔ collector matching (ignore spaces/dashes)."""
    return re.sub(r"\D", "", str(value or "").strip())


def _claim_pins_match(stored: str, provided) -> bool:
    a = _normalize_claim_pin(stored)
    b = _normalize_claim_pin(provided)
    if not a:
        return False
    return bool(b) and a == b


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    """Great-circle distance in meters between two WGS84 points."""
    try:
        φ1, λ1, φ2, λ2 = map(
            math.radians,
            [float(lat1), float(lon1), float(lat2), float(lon2)],
        )
    except (TypeError, ValueError):
        return float("inf")
    dφ = φ2 - φ1
    dλ = λ2 - λ1
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return 6371000.0 * 2 * math.asin(math.sqrt(min(1.0, a)))


def _proximity_radius_m() -> float:
    try:
        return float(
            getattr(dj_settings, "PLASTIC_HOTSPOT_PROXIMITY_M", HOTSPOT_PROXIMITY_RADIUS_M)
            or HOTSPOT_PROXIMITY_RADIUS_M
        )
    except (TypeError, ValueError):
        return float(HOTSPOT_PROXIMITY_RADIUS_M)


def _gps_near_hotspot(hotspot: PlasticHotspot, lat, lng, *, radius_m: float | None = None):
    """
    Returns (ok, distance_m, radius_m, detail_or_empty).
    Collectors must be within radius of the CBO pin — one physical site.
    """
    if hotspot is None or hotspot.latitude is None or hotspot.longitude is None:
        return False, None, _proximity_radius_m(), "Hotspot has no GPS pin."
    if lat in (None, "") or lng in (None, ""):
        return (
            False,
            None,
            _proximity_radius_m(),
            "Capture GPS at the hotspot before continuing.",
        )
    radius = float(radius_m if radius_m is not None else _proximity_radius_m())
    distance = _haversine_m(hotspot.latitude, hotspot.longitude, lat, lng)
    if distance == float("inf"):
        return False, None, radius, "Invalid GPS coordinates."
    if distance > radius:
        return (
            False,
            round(distance),
            round(radius),
            (
                f"You are about {int(round(distance))} m from the CBO hotspot pin "
                f"(allowed {int(round(radius))} m). Move closer to the site and try again."
            ),
        )
    return True, round(distance), round(radius), ""


def _normalize_phone(value) -> str:
    """Normalize Kenyan / regional phones to digits (prefer 254…)."""
    digits = re.sub(r"\D", "", str(value or "").strip())
    if not digits:
        return ""
    if digits.startswith("0") and len(digits) >= 9:
        digits = "254" + digits.lstrip("0")
    elif len(digits) == 9 and digits.startswith(("7", "1")):
        digits = "254" + digits
    return digits[:32]


def _phone_hint(phone: str) -> str:
    digits = _normalize_phone(phone)
    if len(digits) < 4:
        return ""
    return f"***{digits[-4:]}"


def _parse_guest_identity(data) -> tuple[str, str]:
    name = str(
        (data or {}).get("guest_name")
        or (data or {}).get("collector_name")
        or (data or {}).get("name")
        or ""
    ).strip()[:120]
    phone = _normalize_phone(
        (data or {}).get("guest_phone")
        or (data or {}).get("collector_phone")
        or (data or {}).get("phone")
        or ""
    )
    return name, phone


def _new_guest_token() -> str:
    return uuid.uuid4().hex


def _guest_owns_hotspot(hotspot: PlasticHotspot, *, phone: str = "", token: str = "") -> bool:
    if hotspot.status != "claimed":
        return False
    if hotspot.claimed_by_id:
        return False
    token = str(token or "").strip()
    phone = _normalize_phone(phone)
    if token and hotspot.guest_claim_token and token == hotspot.guest_claim_token:
        return True
    if phone and hotspot.claimed_guest_phone and phone == hotspot.claimed_guest_phone:
        return True
    return False


def _collector_label(recovery: PlasticRecovery) -> str:
    if recovery.guest_name:
        return recovery.guest_name.strip()
    if recovery.submitted_by_id:
        return _user_display_name(recovery.submitted_by)
    return "Climate Wavers collector"


def _can_manage_project(user, project: PlasticProject) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff:
        return True
    if project.organization_id == user.id:
        return True
    if not project.tree_admin_org_id:
        return False
    m = TreeAdminMembership.objects.filter(
        user=user, org_id=project.tree_admin_org_id, role__in=("owner", "manager")
    ).select_related("org").first()
    return bool(m and m.org and m.org.has_tree_admin_access)


def _frontend_base() -> str:
    return str(
        getattr(dj_settings, "FRONTEND_URL", None)
        or getattr(dj_settings, "SITE_URL", None)
        or "https://alerts.flowops.africa"
    ).rstrip("/")


def _recycler_partners_for_user(user):
    if not user or not getattr(user, "is_authenticated", False):
        return PlasticRecyclerPartner.objects.none()
    return PlasticRecyclerPartner.objects.filter(linked_user=user, is_active=True)


def _recycler_partner_for_project(user, project: PlasticProject):
    """Linked scan-only partner that belongs to this project's CBO org."""
    qs = _recycler_partners_for_user(user)
    if not qs.exists():
        return None
    if project.tree_admin_org_id:
        match = qs.filter(organization_id=project.tree_admin_org_id).first()
        if match:
            return match
    # Fallback: partner created under same CBO user ownership
    return qs.filter(created_by_id=project.organization_id).first()


def _can_intake_recovery(user, recovery: PlasticRecovery) -> bool:
    if _can_manage_project(user, recovery.project) or getattr(user, "is_staff", False):
        return True
    return bool(_recycler_partner_for_project(user, recovery.project))


def _is_scan_only_recycler(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user_has_tree_admin_access(user) or getattr(user, "is_staff", False):
        return False
    return _recycler_partners_for_user(user).exists()


def _whatsapp_share_url(phone: str, text: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("0") and len(digits) >= 9:
        digits = "254" + digits.lstrip("0")
    elif len(digits) == 9 and digits.startswith("7"):
        digits = "254" + digits
    encoded = quote(text)
    if digits:
        return f"https://wa.me/{digits}?text={encoded}"
    return f"https://wa.me/?text={encoded}"


def _invite_urls(token: str) -> dict:
    path = f"/plastic/recycler-invite/{token}"
    invite_url = f"{_frontend_base()}{path}"
    return {"invite_path": path, "invite_url": invite_url}


def _safe_email(value: str) -> str:
    email = str(value or "").strip()[:254]
    if not email or "@" not in email:
        return ""
    try:
        from django.core.validators import validate_email

        validate_email(email)
        return email
    except Exception:
        return ""


def _user_display_name(user) -> str:
    """Support both User.get_full_name as @property and as method."""
    if not user:
        return ""
    full = getattr(user, "get_full_name", None)
    if callable(full):
        try:
            full = full()
        except Exception:
            full = ""
    name = str(full or "").strip()
    if name:
        return name[:200]
    return str(getattr(user, "username", "") or "").strip()[:200]


def _issue_certificate(
    *,
    project: PlasticProject,
    kg,
    holder_name="",
    holder_email="",
    recovery: PlasticRecovery | None = None,
    sponsorship: PlasticSponsorship | None = None,
) -> PlasticCertificate:
    code = f"CW-PL-{uuid.uuid4().hex[:12].upper()}"
    cert = PlasticCertificate.objects.create(
        code=code,
        project=project,
        recovery=recovery,
        sponsorship=sponsorship,
        kg=_money(kg),
        holder_name=(holder_name or "")[:200],
        holder_email=_safe_email(holder_email),
    )
    if sponsorship is not None:
        sponsorship.certificate_id = code
        sponsorship.certificate_issued_at = timezone.now()
        sponsorship.save(
            update_fields=["certificate_id", "certificate_issued_at"]
        )
    return cert


def _plastic_cert_recipients(cert: PlasticCertificate, recovery: PlasticRecovery | None):
    """Submitter + CBO contacts (deduped)."""
    emails: list[str] = []

    def add(value):
        cleaned = _safe_email(value)
        if cleaned and cleaned.lower() not in {e.lower() for e in emails}:
            emails.append(cleaned)

    add(cert.holder_email)
    if recovery and recovery.submitted_by_id:
        add(getattr(recovery.submitted_by, "email", ""))
    project = cert.project or (recovery.project if recovery else None)
    if project is not None:
        if getattr(project, "organization_id", None):
            add(getattr(project.organization, "email", ""))
        org = getattr(project, "tree_admin_org", None)
        if org is not None:
            add(getattr(org, "contact_email", ""))
            for m in TreeAdminMembership.objects.filter(
                org_id=org.id, role__in=("owner", "manager")
            ).select_related("user")[:5]:
                add(getattr(m.user, "email", ""))
    return emails


def _send_plastic_certificate_email(
    cert: PlasticCertificate,
    *,
    to_email: str,
    recipient_name: str = "",
) -> bool:
    email = _safe_email(to_email)
    if not email or email.endswith("@example.com"):
        return False

    recovery = cert.recovery
    project = cert.project
    verify_url = f"{_frontend_base()}/verify/plastic/{cert.code}"
    bag = recovery.bag_id if recovery else "—"
    kg = cert.kg
    project_name = project.name if project else "Plastic Pulse"
    name = (recipient_name or cert.holder_name or email.split("@")[0]).strip()
    subject = f"Plastic Pulse certificate · {cert.code}"
    body = (
        f"Hi {name},\n\n"
        f"Your Climate Wavers Plastic Pulse recovery certificate is ready.\n\n"
        f"Certificate: {cert.code}\n"
        f"Project: {project_name}\n"
        f"Bag ID: {bag}\n"
        f"Verified kg: {kg}\n\n"
        f"View / share your certificate:\n{verify_url}\n\n"
        f"Powered by FlowOps Africa · Climate Wavers"
    )
    try:
        from api.tasks import _deliver_mail

        _deliver_mail(
            "custom_mail",
            {
                "email": email,
                "data": {
                    "subject": subject,
                    "headline": "Your plastic recovery certificate is ready.",
                    "name": name,
                    "content": body,
                    "cta_text": "View certificate",
                    "cta_url": verify_url,
                    "link": verify_url,
                    "preheader": f"{kg} kg verified · {cert.code}",
                    "reply_hint": (
                        "This certificate confirms verified plastic recovery "
                        "on Climate Wavers Plastic Pulse."
                    ),
                },
            },
        )
        return True
    except Exception:
        logger.exception("Plastic certificate email failed to %s", email)
        return False


def _email_plastic_certificate(
    cert: PlasticCertificate,
    *,
    force: bool = False,
) -> dict:
    """Email certificate to submitter + CBO. Idempotent unless force=True."""
    if cert.emailed_at and not force:
        return {"emailed": False, "already": True, "recipients": []}

    recovery = None
    if cert.recovery_id:
        recovery = (
            PlasticRecovery.objects.select_related(
                "submitted_by",
                "project",
                "project__organization",
                "project__tree_admin_org",
            )
            .filter(pk=cert.recovery_id)
            .first()
        )
    if not getattr(cert, "project", None) and cert.project_id:
        cert = (
            PlasticCertificate.objects.select_related(
                "project", "project__organization", "project__tree_admin_org"
            )
            .filter(pk=cert.pk)
            .first()
            or cert
        )

    recipients = _plastic_cert_recipients(cert, recovery)
    if not recipients:
        return {"emailed": False, "already": False, "recipients": []}

    sent = []
    for to_email in recipients:
        name = ""
        if recovery and _safe_email(getattr(recovery.submitted_by, "email", "")) == to_email:
            name = _user_display_name(recovery.submitted_by)
        elif _safe_email(cert.holder_email) == to_email:
            name = cert.holder_name
        if _send_plastic_certificate_email(cert, to_email=to_email, recipient_name=name):
            sent.append(to_email)

    if sent:
        cert.emailed_at = timezone.now()
        cert.save(update_fields=["emailed_at"])
    return {"emailed": bool(sent), "already": False, "recipients": sent}


def _schedule_plastic_certificate_email(cert_id: int):
    def _run():
        try:
            cert = (
                PlasticCertificate.objects.select_related(
                    "project", "recovery", "recovery__submitted_by"
                )
                .filter(pk=cert_id)
                .first()
            )
            if cert:
                _email_plastic_certificate(cert)
        except Exception:
            logger.exception("Scheduled plastic certificate email failed id=%s", cert_id)

    try:
        transaction.on_commit(_run)
    except Exception:
        _run()


def _ensure_recovery_certificate(recovery: PlasticRecovery) -> PlasticCertificate | None:
    """Issue a certificate if intake is done but none exists yet; email when ready."""
    existing = recovery.certificates.order_by("-issued_at").first()
    if existing:
        if not existing.emailed_at:
            _schedule_plastic_certificate_email(existing.id)
        return existing
    if recovery.status != "intake_confirmed":
        return None
    kg = recovery.kg_verified or recovery.kg_claimed
    if _money(kg) <= 0:
        return None
    holder = _collector_label(recovery)
    email = getattr(recovery.submitted_by, "email", "") if recovery.submitted_by_id else ""
    cert = None
    try:
        cert = _issue_certificate(
            project=recovery.project,
            kg=kg,
            holder_name=holder,
            holder_email=email,
            recovery=recovery,
        )
    except Exception:
        logger.exception(
            "Plastic certificate backfill failed for bag %s", recovery.bag_id
        )
        try:
            cert = _issue_certificate(
                project=recovery.project,
                kg=kg,
                holder_name=holder or "Climate Wavers recovery",
                holder_email="",
                recovery=recovery,
            )
        except Exception:
            logger.exception(
                "Plastic certificate retry failed for bag %s", recovery.bag_id
            )
            return None
    if cert:
        _schedule_plastic_certificate_email(cert.id)
    return cert


# ---------- serializers ----------


class PlasticHotspotSerializer(serializers.ModelSerializer):
    has_claim_pin = serializers.SerializerMethodField()
    claimed_guest_phone_hint = serializers.SerializerMethodField()
    is_guest_claim = serializers.SerializerMethodField()
    # Write-only for collectors never see this on public reads unless include_claim_pin.
    claim_pin = serializers.CharField(
        required=False, allow_blank=True, max_length=12, write_only=False
    )

    class Meta:
        model = PlasticHotspot
        fields = [
            "id",
            "project",
            "created_by",
            "claimed_by",
            "claimed_guest_name",
            "claimed_guest_phone_hint",
            "is_guest_claim",
            "title",
            "notes",
            "photo",
            "latitude",
            "longitude",
            "location_label",
            "severity",
            "drain_related",
            "claim_pin",
            "has_claim_pin",
            "status",
            "claimed_at",
            "cleared_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "created_by",
            "claimed_by",
            "claimed_guest_name",
            "claimed_guest_phone_hint",
            "is_guest_claim",
            "claimed_at",
            "cleared_at",
            "created_at",
            "status",
            "has_claim_pin",
        ]

    def get_has_claim_pin(self, obj):
        return bool(_normalize_claim_pin(getattr(obj, "claim_pin", "")))

    def get_claimed_guest_phone_hint(self, obj):
        return _phone_hint(getattr(obj, "claimed_guest_phone", ""))

    def get_is_guest_claim(self, obj):
        return bool(
            obj.status == "claimed"
            and not obj.claimed_by_id
            and (obj.claimed_guest_phone or obj.guest_claim_token)
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        include_pin = bool(self.context.get("include_claim_pin"))
        if not include_pin:
            data.pop("claim_pin", None)
        else:
            data["claim_pin"] = getattr(instance, "claim_pin", "") or ""
        data["has_claim_pin"] = self.get_has_claim_pin(instance)
        data["claimed_guest_phone_hint"] = self.get_claimed_guest_phone_hint(instance)
        data["is_guest_claim"] = self.get_is_guest_claim(instance)
        # Never expose guest claim token or raw phone on nested public reads.
        data.pop("guest_claim_token", None)
        data.pop("claimed_guest_phone", None)
        return data

    def validate_claim_pin(self, value):
        pin = _normalize_claim_pin(value)
        if value and not pin:
            raise serializers.ValidationError("Claim PIN must include digits.")
        if pin and (len(pin) < 4 or len(pin) > 8):
            raise serializers.ValidationError("Claim PIN must be 4–8 digits.")
        return pin


class PlasticRecoverySerializer(serializers.ModelSerializer):
    project_name = serializers.SerializerMethodField()
    hotspot_title = serializers.SerializerMethodField()
    certificate_code = serializers.SerializerMethodField()
    verify_url = serializers.SerializerMethodField()
    collector_name = serializers.SerializerMethodField()
    guest_phone_hint = serializers.SerializerMethodField()
    is_guest = serializers.SerializerMethodField()
    whatsapp_share_url = serializers.SerializerMethodField()

    class Meta:
        model = PlasticRecovery
        fields = [
            "id",
            "project",
            "project_name",
            "hotspot",
            "hotspot_title",
            "holding_zone",
            "submitted_by",
            "verified_by",
            "recycler",
            "guest_name",
            "guest_phone_hint",
            "collector_name",
            "is_guest",
            "whatsapp_share_url",
            "client_uuid",
            "bag_id",
            "polymer_type",
            "kg_claimed",
            "kg_verified",
            "images",
            "videos",
            "latitude",
            "longitude",
            "location_label",
            "notes",
            "status",
            "reject_reason",
            "offline_queued_at",
            "synced_at",
            "verified_at",
            "intake_at",
            "certificate_code",
            "verify_url",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "verified_by",
            "recycler",
            "guest_name",
            "guest_phone_hint",
            "collector_name",
            "is_guest",
            "whatsapp_share_url",
            "kg_verified",
            "status",
            "reject_reason",
            "synced_at",
            "verified_at",
            "intake_at",
            "project_name",
            "hotspot_title",
            "certificate_code",
            "verify_url",
            "created_at",
        ]

    def get_collector_name(self, obj):
        return _collector_label(obj)

    def get_guest_phone_hint(self, obj):
        return _phone_hint(getattr(obj, "guest_phone", ""))

    def get_is_guest(self, obj):
        return bool(getattr(obj, "guest_phone", None) or getattr(obj, "guest_name", None))

    def get_whatsapp_share_url(self, obj):
        if not self.context.get("include_guest_whatsapp"):
            return ""
        phone = getattr(obj, "guest_phone", "") or ""
        if not phone:
            return ""
        cert_code = self.get_certificate_code(obj)
        verify = self.get_verify_url(obj)
        kg = obj.kg_verified if obj.kg_verified is not None else obj.kg_claimed
        text = (
            f"Climate Wavers Plastic Pulse bag {obj.bag_id}: {kg} kg · {obj.status}."
            + (f" Certificate {cert_code}: {_frontend_base()}{verify}" if cert_code else "")
        )
        return _whatsapp_share_url(phone, text)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Never leak guest_token / raw phone on default serialization.
        data.pop("guest_token", None)
        data.pop("guest_phone", None)
        if self.context.get("include_guest_phone"):
            data["guest_phone"] = getattr(instance, "guest_phone", "") or ""
        return data

    def get_project_name(self, obj):
        project = getattr(obj, "project", None)
        return getattr(project, "name", "") if project else ""

    def get_hotspot_title(self, obj):
        hotspot = getattr(obj, "hotspot", None)
        if not hotspot:
            return ""
        return (
            (hotspot.title or "").strip()
            or (hotspot.location_label or "").strip()
            or f"Hotspot #{hotspot.id}"
        )

    def _certificate(self, obj):
        cache = self.context.setdefault("_cert_cache", {})
        if obj.id in cache:
            return cache[obj.id]
        cert = None
        if getattr(obj, "status", None) == "intake_confirmed":
            cert = obj.certificates.order_by("-issued_at").first()
            if not cert:
                cert = _ensure_recovery_certificate(obj)
        cache[obj.id] = cert
        return cert

    def get_certificate_code(self, obj):
        cert = self._certificate(obj)
        return cert.code if cert else ""

    def get_verify_url(self, obj):
        code = self.get_certificate_code(obj)
        return f"/verify/plastic/{code}" if code else ""


class PlasticHoldingZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlasticHoldingZone
        fields = [
            "id",
            "project",
            "name",
            "code",
            "location_label",
            "latitude",
            "longitude",
            "materials",
            "inventory_kg",
            "inventory_by_polymer",
            "notes",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]


class PlasticDispatchSerializer(serializers.ModelSerializer):
    recycler_name = serializers.CharField(source="recycler.name", read_only=True)
    recycler_city = serializers.CharField(source="recycler.city", read_only=True)
    recycler_phone = serializers.CharField(source="recycler.contact_phone", read_only=True)
    holding_zone_name = serializers.SerializerMethodField()
    whatsapp_url = serializers.SerializerMethodField()
    split_summary = serializers.SerializerMethodField()

    class Meta:
        model = PlasticDispatch
        fields = [
            "id",
            "project",
            "holding_zone",
            "holding_zone_name",
            "recycler",
            "recycler_name",
            "recycler_city",
            "recycler_phone",
            "polymer_type",
            "kg",
            "price_kes_per_kg",
            "total_kes",
            "fee_rate",
            "platform_share_kes",
            "collector_share_kes",
            "payment_status",
            "payment_reference",
            "payment_received_at",
            "collector_payout_status",
            "collector_payout_phone",
            "collector_payout_reference",
            "collector_paid_at",
            "split_summary",
            "status",
            "pickup_day",
            "notes",
            "contact_phone",
            "whatsapp_url",
            "offered_at",
            "accepted_at",
            "delivered_at",
            "settled_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "total_kes",
            "fee_rate",
            "platform_share_kes",
            "collector_share_kes",
            "payment_status",
            "payment_received_at",
            "collector_payout_status",
            "collector_paid_at",
            "split_summary",
            "holding_zone_name",
            "recycler_name",
            "recycler_city",
            "recycler_phone",
            "whatsapp_url",
            "offered_at",
            "accepted_at",
            "delivered_at",
            "settled_at",
            "created_at",
            "updated_at",
        ]

    def get_holding_zone_name(self, obj):
        if not obj.holding_zone_id:
            return ""
        return getattr(obj.holding_zone, "name", "") or ""

    def get_split_summary(self, obj):
        total = float(obj.total_kes or 0)
        platform = float(obj.platform_share_kes or 0)
        collectors = float(obj.collector_share_kes or 0)
        rate = float(obj.fee_rate or 0)
        return {
            "model": "climate_wavers_marketplace",
            "description": (
                "Recycler pays Climate Wavers; platform keeps fee and pays collectors."
            ),
            "total_kes": total,
            "platform_share_kes": platform,
            "collector_share_kes": collectors,
            "fee_rate": rate,
            "fee_percent": round(rate * 100, 2),
        }

    def get_whatsapp_url(self, obj):
        phone = obj.contact_phone or getattr(obj.recycler, "contact_phone", "") or ""
        fee_pct = int(float(obj.fee_rate or 0) * 100)
        msg = (
            f"Climate Wavers Plastic Pulse — marketplace offer\n"
            f"(Recycler pays Climate Wavers; we pay collectors.)\n"
            f"Project: {obj.project.name}\n"
            f"{obj.kg} kg {obj.polymer_type}"
            + (
                f" @ KES {obj.price_kes_per_kg}/kg = KES {obj.total_kes}"
                if obj.total_kes is not None
                else (
                    f" @ KES {obj.price_kes_per_kg}/kg"
                    if obj.price_kes_per_kg is not None
                    else ""
                )
            )
            + (
                f"\nPay Climate Wavers: KES {obj.total_kes}"
                f" (platform {fee_pct}% / collectors {100 - fee_pct}%)"
                if obj.total_kes is not None
                else ""
            )
            + (f"\nPickup day: {obj.pickup_day}" if obj.pickup_day else "")
            + (f"\nZone: {obj.holding_zone.name}" if obj.holding_zone_id else "")
            + (f"\n{obj.notes}" if obj.notes else "")
        )
        return _whatsapp_share_url(phone, msg)


class PlasticRecyclerSerializer(serializers.ModelSerializer):
    scan_access = serializers.SerializerMethodField()
    marketplace_ready = serializers.SerializerMethodField()

    class Meta:
        model = PlasticRecyclerPartner
        fields = [
            "id",
            "name",
            "organization",
            "contact_email",
            "contact_phone",
            "website",
            "address",
            "city",
            "latitude",
            "longitude",
            "buy_rates",
            "materials_accepted",
            "min_buy_kg",
            "accepts_small_lots",
            "notes",
            "is_directory",
            "onboarding_status",
            "application_message",
            "applied_at",
            "reviewed_at",
            "is_active",
            "linked_user",
            "invite_status",
            "invite_expires_at",
            "invited_at",
            "invite_accepted_at",
            "scan_access",
            "marketplace_ready",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "linked_user",
            "invite_status",
            "invite_expires_at",
            "invited_at",
            "invite_accepted_at",
            "scan_access",
            "marketplace_ready",
            "onboarding_status",
            "applied_at",
            "reviewed_at",
            "is_directory",
            "created_at",
        ]

    def get_scan_access(self, obj):
        return bool(
            obj.linked_user_id
            and obj.invite_status == "accepted"
            and obj.is_active
            and obj.onboarding_status in ("approved", "none")
        )

    def get_marketplace_ready(self, obj):
        return bool(getattr(obj, "marketplace_ready", False))


class PlasticInventoryLedgerSerializer(serializers.ModelSerializer):
    holding_zone_name = serializers.CharField(source="holding_zone.name", read_only=True)
    bag_id = serializers.CharField(source="recovery.bag_id", read_only=True, default="")

    class Meta:
        model = PlasticInventoryLedger
        fields = [
            "id",
            "project",
            "holding_zone",
            "holding_zone_name",
            "recovery",
            "bag_id",
            "dispatch",
            "delta_kg",
            "balance_after_kg",
            "polymer_type",
            "reason",
            "notes",
            "created_at",
        ]


def build_plastic_project_impact(project: PlasticProject) -> dict:
    """Aggregates for public impact charts on /plastic/:id."""
    goal = float(project.goal_kg or 0)
    recovered = float(project.recovered_kg or 0)
    remaining = max(0.0, goal - recovered)

    recoveries = list(
        project.recoveries.all().only(
            "polymer_type",
            "status",
            "kg_claimed",
            "kg_verified",
            "created_at",
            "verified_at",
            "intake_at",
        )
    )

    def recovery_kg(row):
        if row.kg_verified is not None:
            return float(row.kg_verified or 0)
        return float(row.kg_claimed or 0)

    polymer = {}
    status_map = {}
    for row in recoveries:
        kg = recovery_kg(row)
        polymer_key = row.polymer_type or "mixed"
        polymer[polymer_key] = polymer.get(polymer_key, 0.0) + kg
        st = row.status or "submitted"
        bucket = status_map.setdefault(st, {"kg": 0.0, "count": 0})
        bucket["kg"] += kg
        bucket["count"] += 1

    polymer_breakdown = [
        {"polymer": k, "kg": round(v, 2)}
        for k, v in sorted(polymer.items(), key=lambda x: -x[1])
        if v > 0
    ]
    status_breakdown = [
        {"status": k, "kg": round(v["kg"], 2), "count": v["count"]}
        for k, v in sorted(status_map.items(), key=lambda x: -x[1]["kg"])
    ]

    hotspot_counts = {}
    drain_open = 0
    for h in project.hotspots.all().only("status", "drain_related"):
        st = h.status or "open"
        hotspot_counts[st] = hotspot_counts.get(st, 0) + 1
        if h.drain_related and st != "cleared":
            drain_open += 1
    hotspot_status = [
        {"status": k, "count": v}
        for k, v in sorted(hotspot_counts.items(), key=lambda x: -x[1])
    ]

    # Weekly kg for last 12 weeks (prefer intake/verified timestamps).
    now = timezone.now()
    week_start = (now - timedelta(weeks=11)).date()
    week_start = week_start - timedelta(days=week_start.weekday())
    weeks = []
    for i in range(12):
        start = week_start + timedelta(weeks=i)
        weeks.append(start)

    weekly = {w.isoformat(): 0.0 for w in weeks}
    for row in recoveries:
        when = row.intake_at or row.verified_at or row.created_at
        if not when:
            continue
        d = when.date()
        ws = d - timedelta(days=d.weekday())
        key = ws.isoformat()
        if key in weekly:
            weekly[key] += recovery_kg(row)

    from datetime import datetime as _dt

    weekly_kg = [
        {
            "week": k,
            "label": _dt.strptime(k, "%Y-%m-%d").strftime("%b %d"),
            "kg": round(v, 2),
        }
        for k, v in weekly.items()
    ]

    sponsors_qs = project.sponsorships.filter(payment_status="completed")
    sponsor_agg = sponsors_qs.aggregate(
        sponsored_kg=Sum("kg_sponsored"),
        sponsor_usd=Sum("amount_usd"),
    )
    sponsored_kg = float(sponsor_agg.get("sponsored_kg") or 0)
    sponsor_usd = float(sponsor_agg.get("sponsor_usd") or 0)
    sponsor_count = sponsors_qs.count()

    recent_sponsors = [
        {
            "name": (s.sponsor_display_name or "Sponsor").strip() or "Sponsor",
            "kg": float(s.kg_sponsored or 0),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sponsors_qs.order_by("-created_at")[:8]
    ]

    cert_qs = project.certificates.all()
    cert_agg = cert_qs.aggregate(total_kg=Sum("kg"))
    certificate_count = cert_qs.count()
    certificate_kg = float(cert_agg.get("total_kg") or 0)

    return {
        "goal_kg": round(goal, 2),
        "recovered_kg": round(recovered, 2),
        "remaining_kg": round(remaining, 2),
        "progress_percentage": round(
            min((recovered / goal) * 100, 100) if goal > 0 else 0, 1
        ),
        "sponsored_kg": round(sponsored_kg, 2),
        "sponsor_usd": round(sponsor_usd, 2),
        "sponsor_count": sponsor_count,
        "certificate_count": certificate_count,
        "certificate_kg": round(certificate_kg, 2),
        "recovery_count": len(recoveries),
        "hotspot_count": sum(hotspot_counts.values()),
        "drain_hotspots_open": drain_open,
        "polymer_breakdown": polymer_breakdown,
        "status_breakdown": status_breakdown,
        "hotspot_status": hotspot_status,
        "weekly_kg": weekly_kg,
        "recent_sponsors": recent_sponsors,
    }


def _absolute_media_url(request, value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    if raw.startswith("//"):
        return f"https:{raw}"
    if request is not None:
        try:
            return request.build_absolute_uri(raw if raw.startswith("/") else f"/{raw}")
        except Exception:
            pass
    base = (getattr(dj_settings, "FRONTEND_URL", None) or "https://alerts.flowops.africa").rstrip(
        "/"
    )
    return f"{base}{raw if raw.startswith('/') else f'/{raw}'}"


def _looks_like_email(value: str) -> bool:
    return "@" in str(value or "") and "." in str(value or "").split("@")[-1]


class PlasticProjectSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.FloatField(read_only=True)
    hotspots = PlasticHotspotSerializer(many=True, read_only=True)
    holding_zones = PlasticHoldingZoneSerializer(many=True, read_only=True)
    recent_recoveries = serializers.SerializerMethodField()
    impact = serializers.SerializerMethodField()
    organization_display_name = serializers.SerializerMethodField()
    organization_logo_url = serializers.SerializerMethodField()
    organization_website = serializers.SerializerMethodField()
    organization_type = serializers.SerializerMethodField()
    organization_verified = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    gallery_urls = serializers.SerializerMethodField()

    class Meta:
        model = PlasticProject
        fields = [
            "id",
            "name",
            "description",
            "short_description",
            "organization",
            "tree_admin_org",
            "organization_name",
            "organization_display_name",
            "organization_logo_url",
            "organization_website",
            "organization_type",
            "organization_verified",
            "country",
            "region",
            "city",
            "latitude",
            "longitude",
            "address",
            "status",
            "goal_kg",
            "recovered_kg",
            "sponsor_price_usd_per_kg",
            "scrap_pet_kes_per_kg",
            "scrap_hdpe_kes_per_kg",
            "collection_days",
            "weekly_target_kg",
            "marketplace_fee_rate",
            "cover_image",
            "cover_image_url",
            "gallery",
            "gallery_urls",
            "flood_zone_flag",
            "contact_person",
            "contact_email",
            "contact_phone",
            "progress_percentage",
            "hotspots",
            "holding_zones",
            "recent_recoveries",
            "impact",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "tree_admin_org",
            "recovered_kg",
            "progress_percentage",
            "hotspots",
            "holding_zones",
            "recent_recoveries",
            "impact",
            "organization_display_name",
            "organization_logo_url",
            "organization_website",
            "organization_type",
            "organization_verified",
            "cover_image_url",
            "gallery_urls",
            "created_at",
            "updated_at",
        ]

    def get_recent_recoveries(self, obj):
        # Enough points for the public cleanup map + proof feed.
        qs = obj.recoveries.all()[:40]
        return PlasticRecoverySerializer(qs, many=True).data

    def get_impact(self, obj):
        # Heavy aggregates — only for project detail (public impact charts).
        if not self.context.get("include_impact"):
            return None
        return build_plastic_project_impact(obj)

    def get_organization_display_name(self, obj):
        org = getattr(obj, "tree_admin_org", None)
        if org and getattr(org, "name", None):
            return org.name
        name = (obj.organization_name or "").strip()
        if name and not _looks_like_email(name):
            return name
        user = getattr(obj, "organization", None)
        if user is not None:
            first = (getattr(user, "first_name", None) or "").strip()
            last = (getattr(user, "last_name", None) or "").strip()
            full = f"{first} {last}".strip()
            if full:
                return full
            username = (getattr(user, "username", None) or "").strip()
            if username and not _looks_like_email(username):
                return username
        return name or "Climate Wavers partner"

    def get_organization_logo_url(self, obj):
        request = self.context.get("request")
        user = getattr(obj, "organization", None)
        if user is None:
            return ""
        try:
            url = getattr(user, "profile_picture", None) or ""
        except Exception:
            url = ""
        return _absolute_media_url(request, url)

    def get_organization_website(self, obj):
        org = getattr(obj, "tree_admin_org", None)
        if org and getattr(org, "website", None):
            return org.website
        return ""

    def get_organization_type(self, obj):
        org = getattr(obj, "tree_admin_org", None)
        if org and getattr(org, "org_type", None):
            return org.get_org_type_display() if hasattr(org, "get_org_type_display") else org.org_type
        return ""

    def get_organization_verified(self, obj):
        org = getattr(obj, "tree_admin_org", None)
        return bool(org and getattr(org, "verification_status", None) == "approved")

    def get_cover_image_url(self, obj):
        return _absolute_media_url(self.context.get("request"), obj.cover_image)

    def get_gallery_urls(self, obj):
        request = self.context.get("request")
        items = obj.gallery if isinstance(obj.gallery, list) else []
        urls = []
        for item in items:
            url = _absolute_media_url(request, item if isinstance(item, str) else None)
            if url:
                urls.append(url)
        return urls


class PlasticCertificateSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    organization_name = serializers.CharField(
        source="project.organization_name", read_only=True
    )

    class Meta:
        model = PlasticCertificate
        fields = [
            "code",
            "kg",
            "holder_name",
            "holder_email",
            "issued_at",
            "emailed_at",
            "project",
            "project_name",
            "organization_name",
            "recovery",
            "sponsorship",
        ]


# ---------- views ----------


class PlasticProjectListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = PlasticProject.objects.filter(status="active").select_related(
            "tree_admin_org", "organization"
        )
        mine = str(request.query_params.get("mine") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        include_pin = False
        if mine and request.user.is_authenticated:
            m = _org_membership(request.user)
            org_ids = []
            if m:
                org_ids.append(m.org_id)
            qs = PlasticProject.objects.filter(
                Q(organization=request.user) | Q(tree_admin_org_id__in=org_ids)
            ).distinct()
            include_pin = True
        return Response(
            PlasticProjectSerializer(
                qs[:100],
                many=True,
                context={"request": request, "include_claim_pin": include_pin},
            ).data
        )

    def post(self, request):
        if not user_has_tree_admin_access(request.user):
            return Response(
                {"detail": "Approved Tree Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        m = _org_membership(request.user)
        payload = dict(request.data)
        if not payload.get("collection_days"):
            payload["collection_days"] = list(DEFAULT_COLLECTION_DAYS)
        if payload.get("weekly_target_kg") in (None, ""):
            payload["weekly_target_kg"] = 120
        ser = PlasticProjectSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        org_name = (
            ser.validated_data.get("organization_name")
            or (m.org.name if m else "")
            or request.user.get_username()
        )
        project = ser.save(
            organization=request.user,
            tree_admin_org=m.org if m else None,
            organization_name=org_name,
        )
        _ensure_default_holding_zones(project)
        project.refresh_from_db()
        return Response(
            PlasticProjectSerializer(
                project, context={"request": request, "include_claim_pin": True}
            ).data,
            status=status.HTTP_201_CREATED,
        )


class PlasticProjectDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, project_id):
        try:
            project = (
                PlasticProject.objects.select_related(
                    "organization", "tree_admin_org"
                )
                .prefetch_related(
                    "hotspots",
                    "holding_zones",
                    "recoveries",
                    "sponsorships",
                    "certificates",
                )
                .get(pk=project_id)
            )
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        include_pin = bool(
            request.user
            and request.user.is_authenticated
            and _can_manage_project(request.user, project)
        )
        return Response(
            PlasticProjectSerializer(
                project,
                context={
                    "request": request,
                    "include_impact": True,
                    "include_claim_pin": include_pin,
                },
            ).data
        )

    def patch(self, request, project_id):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        ser = PlasticProjectSerializer(project, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(
            PlasticProjectSerializer(
                project,
                context={
                    "request": request,
                    "include_impact": True,
                    "include_claim_pin": True,
                },
            ).data
        )


class PlasticHotspotCreateView(APIView):
    """CBO / Tree Admin pins hotspots. Field collectors claim them — they do not pin."""

    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response(
                {"detail": "Only the project CBO can pin hotspots."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = PlasticHotspotSerializer(
            data=request.data, context={"include_claim_pin": True}
        )
        ser.is_valid(raise_exception=True)
        lat = ser.validated_data.get("latitude")
        lng = ser.validated_data.get("longitude")
        if lat is None or lng is None:
            return Response(
                {"detail": "latitude and longitude are required."}, status=400
            )
        pin = _normalize_claim_pin(ser.validated_data.get("claim_pin"))
        if not pin:
            return Response(
                {
                    "detail": "Claim PIN required (4–8 digits). Share it with collectors on site."
                },
                status=400,
            )
        hotspot = ser.save(
            project=project,
            created_by=request.user,
            status="open",
            claim_pin=pin,
        )
        for m in TreeAdminMembership.objects.filter(
            org_id=project.tree_admin_org_id
        ).select_related("user")[:20]:
            _notify(
                m.user,
                f"New plastic hotspot on {project.name}",
                hotspot,
            )
        return Response(
            PlasticHotspotSerializer(
                hotspot, context={"include_claim_pin": True}
            ).data,
            status=status.HTTP_201_CREATED,
        )


class PlasticHotspotReopenView(APIView):
    """
    CBO reopens a claimed/cleared hotspot so collectors can claim it again.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, hotspot_id):
        try:
            hotspot = PlasticHotspot.objects.select_related("project").get(pk=hotspot_id)
        except PlasticHotspot.DoesNotExist:
            return Response({"detail": "Hotspot not found."}, status=404)
        if not _can_manage_project(request.user, hotspot.project):
            return Response(
                {"detail": "Only the project CBO can reopen hotspots."},
                status=status.HTTP_403_FORBIDDEN,
            )
        hotspot.status = "open"
        hotspot.claimed_by = None
        hotspot.claimed_guest_name = ""
        hotspot.claimed_guest_phone = ""
        hotspot.guest_claim_token = ""
        hotspot.claimed_at = None
        hotspot.cleared_at = None
        hotspot.save(
            update_fields=[
                "status",
                "claimed_by",
                "claimed_guest_name",
                "claimed_guest_phone",
                "guest_claim_token",
                "claimed_at",
                "cleared_at",
                "updated_at",
            ]
        )
        return Response(
            PlasticHotspotSerializer(
                hotspot, context={"include_claim_pin": True}
            ).data
        )


class PlasticHotspotClaimView(APIView):
    """
    Claim a hotspot after CBO claim PIN match.
    Signed-in collectors OR guests (name + phone) — no account required.
    """

    permission_classes = [AllowAny]

    def post(self, request, hotspot_id):
        try:
            hotspot = PlasticHotspot.objects.select_related("project").get(pk=hotspot_id)
        except PlasticHotspot.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if hotspot.project.status != "active":
            return Response({"detail": "Project is not active."}, status=400)
        if hotspot.status not in ("open", "claimed"):
            return Response({"detail": "Hotspot is not claimable."}, status=400)

        user = request.user if getattr(request.user, "is_authenticated", False) else None
        guest_name, guest_phone = _parse_guest_identity(request.data)
        guest_token_in = str(
            request.data.get("guest_token") or request.data.get("token") or ""
        ).strip()

        already_mine = False
        if user:
            already_mine = (
                hotspot.status == "claimed" and hotspot.claimed_by_id == user.id
            )
        if not already_mine:
            already_mine = _guest_owns_hotspot(
                hotspot, phone=guest_phone, token=guest_token_in
            )

        if hotspot.status == "claimed" and not already_mine:
            # Another account user holds it
            if hotspot.claimed_by_id and (not user or hotspot.claimed_by_id != user.id):
                return Response(
                    {"detail": "Already claimed by someone else."}, status=409
                )
            # Another guest holds it
            if not hotspot.claimed_by_id and (
                hotspot.claimed_guest_phone or hotspot.guest_claim_token
            ):
                return Response(
                    {"detail": "Already claimed by someone else."}, status=409
                )

        if not already_mine:
            provided = request.data.get("claim_pin") or request.data.get("pin") or ""
            if not _normalize_claim_pin(hotspot.claim_pin):
                return Response(
                    {
                        "detail": "This hotspot has no claim PIN. Ask the CBO to re-pin it."
                    },
                    status=400,
                )
            if not _claim_pins_match(hotspot.claim_pin, provided):
                return Response(
                    {"detail": "Claim PIN does not match the CBO PIN."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Collector GPS must be near the CBO pin (same physical site).
            ok, distance_m, radius_m, detail = _gps_near_hotspot(
                hotspot,
                request.data.get("latitude"),
                request.data.get("longitude"),
            )
            if not ok:
                return Response(
                    {
                        "detail": detail,
                        "distance_m": distance_m,
                        "allowed_radius_m": radius_m,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        guest_token = hotspot.guest_claim_token or ""
        if user:
            hotspot.status = "claimed"
            hotspot.claimed_by = user
            hotspot.claimed_guest_name = ""
            hotspot.claimed_guest_phone = ""
            hotspot.guest_claim_token = ""
            guest_token = ""
            label = _user_display_name(user)
        else:
            if not guest_name or len(guest_name) < 2:
                return Response(
                    {"detail": "Name required for guest collection."}, status=400
                )
            if len(guest_phone) < 9:
                return Response(
                    {
                        "detail": "Valid phone required for guest collection (e.g. 07… or +254…)."
                    },
                    status=400,
                )
            if already_mine and hotspot.guest_claim_token:
                guest_token = hotspot.guest_claim_token
            else:
                guest_token = guest_token_in or _new_guest_token()
            hotspot.status = "claimed"
            hotspot.claimed_by = None
            hotspot.claimed_guest_name = guest_name
            hotspot.claimed_guest_phone = guest_phone
            hotspot.guest_claim_token = guest_token
            label = guest_name

        hotspot.claimed_at = timezone.now()
        hotspot.save(
            update_fields=[
                "status",
                "claimed_by",
                "claimed_guest_name",
                "claimed_guest_phone",
                "guest_claim_token",
                "claimed_at",
                "updated_at",
            ]
        )
        if hotspot.project.tree_admin_org_id and not already_mine:
            for m in TreeAdminMembership.objects.filter(
                org_id=hotspot.project.tree_admin_org_id, role__in=("owner", "manager")
            ).select_related("user")[:8]:
                _notify(
                    m.user,
                    f"{label} claimed hotspot on {hotspot.project.name}",
                    hotspot,
                )
        payload = PlasticHotspotSerializer(hotspot).data
        if guest_token:
            payload["guest_token"] = guest_token
            payload["guest_name"] = guest_name or hotspot.claimed_guest_name
            payload["guest_phone"] = guest_phone or hotspot.claimed_guest_phone
        return Response(payload)


class PlasticRecoveryCreateView(APIView):
    """
    Submit bag proof (GPS + media required).
    Signed-in collectors/CBO OR guests with name + phone + claim PIN / guest token.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        project_id = data.get("project") or data.get("project_id")
        try:
            project = PlasticProject.objects.get(pk=int(project_id))
        except (TypeError, ValueError, PlasticProject.DoesNotExist):
            return Response({"detail": "Valid project required."}, status=400)
        if project.status != "active":
            return Response({"detail": "Project is not active."}, status=400)

        user = request.user if getattr(request.user, "is_authenticated", False) else None
        guest_name, guest_phone = _parse_guest_identity(data)
        guest_token = str(
            data.get("guest_token") or data.get("token") or ""
        ).strip()

        if not user:
            if not guest_name or len(guest_name) < 2:
                return Response(
                    {"detail": "Name required for guest collection."}, status=400
                )
            if len(guest_phone) < 9:
                return Response(
                    {
                        "detail": "Valid phone required for guest collection (e.g. 07… or +254…)."
                    },
                    status=400,
                )

        client_uuid = str(data.get("client_uuid") or "").strip()
        if client_uuid:
            existing = PlasticRecovery.objects.filter(
                project=project, client_uuid=client_uuid
            ).first()
            if existing:
                return Response(PlasticRecoverySerializer(existing).data)

        bag_id = str(data.get("bag_id") or "").strip() or f"BAG-{uuid.uuid4().hex[:10].upper()}"
        images = data.get("images") or []
        videos = data.get("videos") or []
        if isinstance(images, str):
            images = [images]
        if isinstance(videos, str):
            videos = [videos]
        lat = data.get("latitude")
        lng = data.get("longitude")
        if lat in (None, "") or lng in (None, ""):
            return Response(
                {"detail": "GPS latitude and longitude are required."}, status=400
            )
        if not images and not videos:
            return Response(
                {"detail": "At least one photo or video is required."}, status=400
            )

        offline = str(data.get("offline") or data.get("was_offline") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        hotspot = None
        hotspot_id = data.get("hotspot") or data.get("hotspot_id")
        if not hotspot_id and not user:
            return Response(
                {"detail": "Claim a hotspot with the CBO PIN before logging a bag."},
                status=400,
            )
        if hotspot_id:
            hotspot = PlasticHotspot.objects.filter(
                pk=hotspot_id, project=project
            ).first()
            if not hotspot:
                return Response({"detail": "Hotspot not found on this project."}, status=400)
            is_manager = bool(user and _can_manage_project(user, project))
            already_mine = bool(user and hotspot.claimed_by_id == user.id)
            if not already_mine:
                already_mine = _guest_owns_hotspot(
                    hotspot, phone=guest_phone, token=guest_token
                )
            if not is_manager and not already_mine:
                provided = data.get("claim_pin") or data.get("pin") or ""
                if not _claim_pins_match(hotspot.claim_pin, provided):
                    return Response(
                        {
                            "detail": "Enter the CBO claim PIN to collect at this hotspot."
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                # Auto-claim after successful PIN match so bag is tied to collector.
                if hotspot.status not in ("open", "claimed"):
                    return Response(
                        {"detail": "Hotspot is not claimable."}, status=400
                    )
                if hotspot.status == "claimed":
                    if hotspot.claimed_by_id and (
                        not user or hotspot.claimed_by_id != user.id
                    ):
                        return Response(
                            {"detail": "Hotspot already claimed by someone else."},
                            status=409,
                        )
                    if (
                        not hotspot.claimed_by_id
                        and (hotspot.claimed_guest_phone or hotspot.guest_claim_token)
                        and not _guest_owns_hotspot(
                            hotspot, phone=guest_phone, token=guest_token
                        )
                    ):
                        return Response(
                            {"detail": "Hotspot already claimed by someone else."},
                            status=409,
                        )
                if user:
                    hotspot.status = "claimed"
                    hotspot.claimed_by = user
                    hotspot.claimed_guest_name = ""
                    hotspot.claimed_guest_phone = ""
                    hotspot.guest_claim_token = ""
                    guest_token = ""
                else:
                    guest_token = guest_token or hotspot.guest_claim_token or _new_guest_token()
                    hotspot.status = "claimed"
                    hotspot.claimed_by = None
                    hotspot.claimed_guest_name = guest_name
                    hotspot.claimed_guest_phone = guest_phone
                    hotspot.guest_claim_token = guest_token
                hotspot.claimed_at = timezone.now()
                hotspot.save(
                    update_fields=[
                        "status",
                        "claimed_by",
                        "claimed_guest_name",
                        "claimed_guest_phone",
                        "guest_claim_token",
                        "claimed_at",
                        "updated_at",
                    ]
                )
            elif already_mine and not user and hotspot.guest_claim_token:
                guest_token = guest_token or hotspot.guest_claim_token

            # Bag GPS must be near the CBO pin (managers may log from desk).
            if not is_manager:
                ok, distance_m, radius_m, detail = _gps_near_hotspot(hotspot, lat, lng)
                if not ok:
                    return Response(
                        {
                            "detail": detail,
                            "distance_m": distance_m,
                            "allowed_radius_m": radius_m,
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

        if not user and not guest_token:
            guest_token = _new_guest_token()

        recovery = PlasticRecovery.objects.create(
            project=project,
            hotspot=hotspot,
            submitted_by=user,
            guest_name=guest_name if not user else "",
            guest_phone=guest_phone if not user else "",
            guest_token=guest_token if not user else "",
            client_uuid=client_uuid,
            bag_id=bag_id[:64],
            polymer_type=str(data.get("polymer_type") or "mixed")[:20],
            kg_claimed=_money(data.get("kg_claimed") or data.get("kg") or 0),
            images=list(images)[:12],
            videos=list(videos)[:6],
            latitude=_dec(lat),
            longitude=_dec(lng),
            location_label=str(data.get("location_label") or "")[:255],
            notes=str(data.get("notes") or "")[:2000],
            status="queued_offline" if offline else "submitted",
            offline_queued_at=timezone.now() if offline else None,
            synced_at=timezone.now(),
        )
        if offline:
            recovery.status = "submitted"
            recovery.save(update_fields=["status", "updated_at"])

        if project.tree_admin_org_id:
            who = guest_name or ( _user_display_name(user) if user else "Collector" )
            for m in TreeAdminMembership.objects.filter(
                org_id=project.tree_admin_org_id, role__in=("owner", "manager")
            ).select_related("user")[:10]:
                _notify(
                    m.user,
                    f"New plastic recovery proof on {project.name} ({recovery.bag_id}) from {who}",
                    recovery,
                )
        payload = PlasticRecoverySerializer(
            recovery,
            context={
                "include_guest_phone": True,
                "include_guest_whatsapp": True,
            },
        ).data
        if guest_token and not user:
            payload["guest_token"] = guest_token
        return Response(payload, status=status.HTTP_201_CREATED)


class PlasticRecoveryVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, recovery_id):
        try:
            recovery = PlasticRecovery.objects.select_related("project", "hotspot").get(
                pk=recovery_id
            )
        except PlasticRecovery.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, recovery.project):
            return Response({"detail": "Forbidden."}, status=403)
        if recovery.status not in ("submitted", "rejected", "queued_offline"):
            return Response(
                {"detail": f"Cannot verify from status {recovery.status}."}, status=400
            )

        action = str(request.data.get("action") or "approve").strip().lower()
        if action in ("reject", "rejected"):
            recovery.status = "rejected"
            recovery.reject_reason = str(request.data.get("reason") or "")[:255]
            recovery.verified_by = request.user
            recovery.verified_at = timezone.now()
            recovery.save(
                update_fields=[
                    "status",
                    "reject_reason",
                    "verified_by",
                    "verified_at",
                    "updated_at",
                ]
            )
            _notify(
                recovery.submitted_by,
                f"Plastic recovery {recovery.bag_id} was rejected.",
                recovery,
            )
            return Response(PlasticRecoverySerializer(recovery).data)

        if recovery.latitude is None or recovery.longitude is None:
            return Response({"detail": "GPS required before verify."}, status=400)
        if not (recovery.images or recovery.videos):
            return Response({"detail": "Media required before verify."}, status=400)

        kg = request.data.get("kg_verified")
        if kg in (None, ""):
            kg = recovery.kg_claimed
        kg = _money(kg)
        if kg <= 0:
            return Response({"detail": "kg_verified must be > 0."}, status=400)

        zone_id = request.data.get("holding_zone") or request.data.get("holding_zone_id")
        try:
            with transaction.atomic():
                recovery.status = "cbo_verified"
                recovery.kg_verified = kg
                recovery.verified_by = request.user
                recovery.verified_at = timezone.now()
                recovery.reject_reason = ""
                zone = _pick_holding_zone(recovery.project, zone_id)
                recovery.holding_zone = zone
                recovery.save(
                    update_fields=[
                        "status",
                        "kg_verified",
                        "verified_by",
                        "verified_at",
                        "reject_reason",
                        "holding_zone",
                        "updated_at",
                    ]
                )
                apply_inventory_delta(
                    zone=zone,
                    delta_kg=kg,
                    reason="verify_in",
                    polymer_type=recovery.polymer_type,
                    user=request.user,
                    recovery=recovery,
                    notes=f"Bag {recovery.bag_id} verified into stock",
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        _notify(
            recovery.submitted_by,
            f"Plastic recovery {recovery.bag_id} verified · stocked in {zone.name}.",
            recovery,
        )
        payload = PlasticRecoverySerializer(recovery).data
        payload["holding_zone_id"] = zone.id
        payload["holding_zone_name"] = zone.name
        payload["holding_zone_inventory_kg"] = float(zone.inventory_kg)
        return Response(payload)


class PlasticIntakeScanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        bag_id = str(request.data.get("bag_id") or "").strip()
        if not bag_id:
            return Response({"detail": "bag_id required."}, status=400)

        try:
            with transaction.atomic():
                # Lock by pk only (avoid FOR UPDATE + ORDER BY/LIMIT edge cases).
                recovery_id = (
                    PlasticRecovery.objects.filter(bag_id__iexact=bag_id)
                    .order_by("-created_at")
                    .values_list("id", flat=True)
                    .first()
                )
                if not recovery_id:
                    return Response({"detail": "Bag not found."}, status=404)

                recovery = (
                    PlasticRecovery.objects.select_for_update()
                    .select_related("project")
                    .get(pk=recovery_id)
                )
                if recovery.status == "intake_confirmed":
                    payload = PlasticRecoverySerializer(recovery).data
                    cert = _ensure_recovery_certificate(recovery)
                    payload["certificate_code"] = cert.code if cert else ""
                    payload["certificate_emailed"] = bool(
                        cert and cert.emailed_at
                    )
                    payload["points_earned"] = 0
                    payload["project_recovered_kg"] = float(
                        recovery.project.recovered_kg or 0
                    )
                    return Response(payload)

                is_cbo = (
                    _can_manage_project(request.user, recovery.project)
                    or request.user.is_staff
                )
                partner = _recycler_partner_for_project(request.user, recovery.project)
                if not is_cbo and not partner:
                    return Response({"detail": "Forbidden."}, status=403)

                # Scan-only recyclers may only intake CBO-verified bags
                allowed_statuses = (
                    ("cbo_verified", "submitted") if is_cbo else ("cbo_verified",)
                )
                if recovery.status not in allowed_statuses:
                    return Response(
                        {
                            "detail": (
                                f"Recovery status {recovery.status} cannot be intaken."
                            )
                        },
                        status=400,
                    )

                kg = request.data.get("kg_verified")
                if kg in (None, ""):
                    kg = recovery.kg_verified or recovery.kg_claimed
                kg = _money(kg)
                if kg <= 0:
                    return Response(
                        {"detail": "Confirmed kg must be > 0."}, status=400
                    )

                recycler = None
                recycler_id = request.data.get("recycler_id") or request.data.get(
                    "recycler"
                )
                if recycler_id:
                    recycler = PlasticRecyclerPartner.objects.filter(
                        pk=recycler_id
                    ).first()
                if not recycler and partner:
                    recycler = partner

                prev_status = recovery.status
                recovery.kg_verified = kg
                recovery.status = "intake_confirmed"
                recovery.recycler = recycler
                recovery.intake_at = timezone.now()
                if prev_status == "cbo_verified" or not recovery.verified_at:
                    recovery.verified_by = recovery.verified_by or request.user
                    recovery.verified_at = recovery.verified_at or timezone.now()
                recovery.save()

                project = PlasticProject.objects.select_for_update().get(
                    pk=recovery.project_id
                )
                project.recovered_kg = _money(_dec(project.recovered_kg) + kg)
                project.save(update_fields=["recovered_kg", "updated_at"])

                if recovery.hotspot_id:
                    PlasticHotspot.objects.filter(pk=recovery.hotspot_id).update(
                        status="cleared", cleared_at=timezone.now()
                    )

                cert = _ensure_recovery_certificate(recovery)

                _notify(
                    recovery.submitted_by,
                    f"Recycler intake confirmed for {recovery.bag_id}: {kg} kg.",
                    recovery,
                )

                certificate_code = cert.code if cert else ""

                payload = PlasticRecoverySerializer(
                    recovery,
                    context={
                        "include_guest_phone": True,
                        "include_guest_whatsapp": True,
                    },
                ).data
                payload["certificate_code"] = certificate_code
                payload["certificate_emailed"] = False  # emailed on_commit after response
                payload["project_recovered_kg"] = float(project.recovered_kg or 0)
                if recovery.guest_phone:
                    verify_path = (
                        f"/verify/plastic/{certificate_code}" if certificate_code else ""
                    )
                    wa_text = (
                        f"Climate Wavers Plastic Pulse: bag {recovery.bag_id} intake "
                        f"confirmed at {kg} kg."
                        + (
                            f" Certificate: {_frontend_base()}{verify_path}"
                            if certificate_code
                            else ""
                        )
                    )
                    payload["collector_whatsapp_url"] = _whatsapp_share_url(
                        recovery.guest_phone, wa_text
                    )
                    payload["guest_phone"] = recovery.guest_phone
                    payload["guest_name"] = recovery.guest_name
                recovery_pk = recovery.pk

            # Points after commit — avoids nested-atomic breakage on ledger errors.
            points_earned = 0
            try:
                from .points import credit_recovery_points

                fresh = PlasticRecovery.objects.filter(pk=recovery_pk).first()
                if fresh:
                    points_earned = credit_recovery_points(fresh) or 0
            except Exception:
                logger.exception(
                    "Plastic recovery points failed for recovery %s", recovery_pk
                )
                points_earned = 0

            payload["points_earned"] = points_earned
            return Response(payload)
        except PlasticRecovery.DoesNotExist:
            return Response({"detail": "Bag not found."}, status=404)
        except Exception as exc:
            logger.exception("Plastic intake scan failed for bag %s", bag_id)
            return Response(
                {"detail": str(exc) or "Intake failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PlasticRecyclerListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = PlasticRecyclerPartner.objects.filter(is_active=True)
        city = str(request.query_params.get("city") or "").strip()
        directory = str(request.query_params.get("directory") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        small_lots = str(request.query_params.get("small_lots") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        approved_only = str(
            request.query_params.get("approved")
            or request.query_params.get("marketplace")
            or ""
        ).lower() in {"1", "true", "yes"}
        if city:
            qs = qs.filter(city__iexact=city)
        if small_lots:
            qs = qs.filter(accepts_small_lots=True)
        if approved_only:
            qs = qs.filter(onboarding_status="approved")
        if directory:
            qs = qs.filter(is_directory=True)
        elif (
            request.user
            and request.user.is_authenticated
            and user_has_tree_admin_access(request.user)
        ):
            # CBO partners + public directory (for direct-to-recycler matching)
            m = _org_membership(request.user)
            if m and m.org_id:
                qs = qs.filter(
                    Q(organization_id=m.org_id)
                    | Q(created_by=request.user)
                    | Q(is_directory=True)
                )
        else:
            qs = qs.filter(is_directory=True)
        return Response(PlasticRecyclerSerializer(qs, many=True).data)

    def post(self, request):
        if not user_has_tree_admin_access(request.user):
            return Response({"detail": "Tree Admin required."}, status=403)
        m = _org_membership(request.user)
        ser = PlasticRecyclerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        partner = ser.save(
            created_by=request.user,
            organization=m.org if m else None,
            is_directory=False,
        )
        return Response(
            PlasticRecyclerSerializer(partner).data, status=status.HTTP_201_CREATED
        )


class PlasticRecyclerDirectoryView(APIView):
    """Public Kenya recycler directory filtered by city (direct sales research)."""

    permission_classes = [AllowAny]

    def get(self, request):
        qs = PlasticRecyclerPartner.objects.filter(is_active=True, is_directory=True)
        city = str(request.query_params.get("city") or "").strip()
        if city:
            qs = qs.filter(city__iexact=city)
        small_lots = str(request.query_params.get("small_lots") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        if small_lots:
            qs = qs.filter(accepts_small_lots=True)
        cities = sorted(
            {
                (c or "").strip()
                for c in PlasticRecyclerPartner.objects.filter(
                    is_active=True, is_directory=True
                )
                .exclude(city="")
                .values_list("city", flat=True)
            },
            key=lambda x: x.lower(),
        )
        return Response(
            {
                "cities": cities,
                "count": qs.count(),
                "recyclers": PlasticRecyclerSerializer(qs, many=True).data,
                "ground_notes": {
                    "typical_cbo_weekly_kg": 120,
                    "holding_zones": 3,
                    "collection_days": DEFAULT_COLLECTION_DAYS,
                    "marketplace_model": (
                        "Recycler pays Climate Wavers; platform fee split to collectors."
                    ),
                    "default_fee_rate": float(DEFAULT_MARKETPLACE_FEE_RATE),
                    "tip": (
                        "Prefer accepts_small_lots=true yards for ~40 kg/zone lots; "
                        "large factories often want 1+ tonne/week."
                    ),
                },
            }
        )


class PlasticHoldingZoneListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        zones = _ensure_default_holding_zones(project)
        return Response(PlasticHoldingZoneSerializer(zones, many=True).data)

    def post(self, request, project_id):
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        ser = PlasticHoldingZoneSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        zone = ser.save(project=project)
        return Response(
            PlasticHoldingZoneSerializer(zone).data, status=status.HTTP_201_CREATED
        )


class PlasticHoldingZoneDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, zone_id):
        zone = PlasticHoldingZone.objects.select_related("project").filter(pk=zone_id).first()
        if not zone:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, zone.project):
            return Response({"detail": "Forbidden."}, status=403)

        # Manual stock edits: staff only. CBO stock comes from verified recoveries.
        if "inventory_kg" in request.data:
            if not (request.user.is_staff or request.user.is_superuser):
                return Response(
                    {
                        "detail": (
                            "Inventory is set by verified recoveries. "
                            "Only Climate Wavers staff can adjust manually."
                        )
                    },
                    status=403,
                )
            try:
                target = _money(request.data.get("inventory_kg"))
                delta = _money(target - zone.inventory_kg)
                if delta != 0:
                    with transaction.atomic():
                        apply_inventory_delta(
                            zone=zone,
                            delta_kg=delta,
                            reason="adjust",
                            polymer_type=str(
                                request.data.get("polymer_type") or "mixed"
                            ),
                            user=request.user,
                            notes=str(request.data.get("notes") or "Zone inventory edit")[
                                :255
                            ],
                        )
                zone.refresh_from_db()
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

        payload = {
            k: v
            for k, v in dict(request.data).items()
            if k not in {"inventory_kg", "inventory_by_polymer"}
        }
        if payload:
            ser = PlasticHoldingZoneSerializer(zone, data=payload, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            zone.refresh_from_db()
        return Response(PlasticHoldingZoneSerializer(zone).data)


class PlasticDispatchListCreateView(APIView):
    """Climate Wavers marketplace: recycler pays platform; CW splits with collectors."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        qs = project.dispatches.select_related("recycler", "holding_zone").all()[:100]
        return Response(PlasticDispatchSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request, project_id):
        try:
            project = PlasticProject.objects.select_for_update().get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)

        recycler_id = request.data.get("recycler") or request.data.get("recycler_id")
        recycler = PlasticRecyclerPartner.objects.filter(
            pk=recycler_id, is_active=True
        ).first()
        if not recycler:
            return Response({"detail": "Recycler required."}, status=400)
        if recycler.onboarding_status != "approved":
            return Response(
                {
                    "detail": (
                        "Recycler must be approved by Climate Wavers superadmin "
                        "before marketplace offers."
                    )
                },
                status=400,
            )

        kg = _dec(request.data.get("kg"))
        if kg <= 0:
            return Response({"detail": "kg must be > 0."}, status=400)

        zone_id = request.data.get("holding_zone") or request.data.get("holding_zone_id")
        if not zone_id:
            return Response(
                {"detail": "Holding zone required — offer from verified stock."},
                status=400,
            )
        zone = (
            PlasticHoldingZone.objects.select_for_update()
            .filter(pk=zone_id, project=project)
            .first()
        )
        if not zone:
            return Response({"detail": "Holding zone not found."}, status=404)

        price = request.data.get("price_kes_per_kg")
        price_dec = _money(price) if price not in (None, "") else None
        if price_dec is None and isinstance(recycler.buy_rates, dict):
            polymer = str(request.data.get("polymer_type") or "mixed")
            rate = recycler.buy_rates.get(polymer) or recycler.buy_rates.get("mixed")
            if rate is not None:
                price_dec = _money(rate)

        total = _money(kg * price_dec) if price_dec is not None else None
        fee_override = request.data.get("fee_rate")
        fee_source = (
            fee_override
            if fee_override not in (None, "")
            else getattr(project, "marketplace_fee_rate", None)
        )
        platform_share = collector_share = None
        fee_rate = _clamp_fee_rate(
            fee_source if fee_source not in (None, "") else DEFAULT_MARKETPLACE_FEE_RATE
        )
        if total is not None:
            platform_share, collector_share, fee_rate = split_plastic_marketplace_sale(
                total, fee_rate
            )

        polymer = str(request.data.get("polymer_type") or "mixed")
        try:
            dispatch = PlasticDispatch.objects.create(
                project=project,
                holding_zone=zone,
                recycler=recycler,
                created_by=request.user,
                polymer_type=polymer,
                kg=kg,
                price_kes_per_kg=price_dec,
                total_kes=total,
                fee_rate=fee_rate,
                platform_share_kes=platform_share,
                collector_share_kes=collector_share,
                payment_status="pending",
                collector_payout_status="none",
                collector_payout_phone=str(
                    request.data.get("collector_payout_phone") or ""
                ).strip()[:40],
                status="offered",
                pickup_day=str(request.data.get("pickup_day") or "").strip().lower()[:16],
                notes=str(request.data.get("notes") or "").strip(),
                contact_phone=str(
                    request.data.get("contact_phone") or recycler.contact_phone or ""
                ).strip(),
                offered_at=timezone.now(),
            )
            if zone:
                apply_inventory_delta(
                    zone=zone,
                    delta_kg=-kg,
                    reason="dispatch_out",
                    polymer_type=polymer,
                    user=request.user,
                    dispatch=dispatch,
                    notes=f"Marketplace offer #{dispatch.id} to {recycler.name}",
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response(
            PlasticDispatchSerializer(dispatch).data, status=status.HTTP_201_CREATED
        )


class PlasticDispatchStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, dispatch_id):
        dispatch = (
            PlasticDispatch.objects.select_related("project", "recycler", "holding_zone")
            .filter(pk=dispatch_id)
            .first()
        )
        if not dispatch:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, dispatch.project):
            return Response({"detail": "Forbidden."}, status=403)

        new_status = str(request.data.get("status") or "").strip().lower()
        allowed = {c[0] for c in PlasticDispatch.STATUS_CHOICES}
        if new_status not in allowed:
            return Response({"detail": "Invalid status."}, status=400)

        with transaction.atomic():
            if new_status == "cancelled" and dispatch.status not in (
                "cancelled",
                "settled",
                "delivered",
            ):
                if dispatch.holding_zone_id:
                    zone = (
                        PlasticHoldingZone.objects.select_for_update()
                        .filter(pk=dispatch.holding_zone_id)
                        .first()
                    )
                    if zone:
                        apply_inventory_delta(
                            zone=zone,
                            delta_kg=dispatch.kg,
                            reason="dispatch_cancel",
                            polymer_type=dispatch.polymer_type,
                            user=request.user,
                            dispatch=dispatch,
                            notes=f"Restored from cancelled offer #{dispatch.id}",
                        )

            dispatch.status = new_status
            now = timezone.now()
            update_fields = ["status", "updated_at"]
            if new_status == "accepted":
                dispatch.accepted_at = now
                update_fields.append("accepted_at")
            elif new_status == "delivered":
                dispatch.delivered_at = now
                update_fields.append("delivered_at")
            elif new_status == "settled":
                dispatch.settled_at = now
                update_fields.append("settled_at")
            dispatch.save(update_fields=update_fields)

        return Response(PlasticDispatchSerializer(dispatch).data)


class PlasticInventoryLedgerView(APIView):
    """CBO inventory movements for a project."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        zones = _ensure_default_holding_zones(project)
        entries = (
            PlasticInventoryLedger.objects.filter(project=project)
            .select_related("holding_zone", "recovery")
            .all()[:100]
        )
        return Response(
            {
                "zones": PlasticHoldingZoneSerializer(zones, many=True).data,
                "ledger": PlasticInventoryLedgerSerializer(entries, many=True).data,
                "total_inventory_kg": float(
                    sum((z.inventory_kg or 0) for z in zones)
                ),
            }
        )

    def post(self, request, project_id):
        """Manual inventory adjustment — staff only."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {
                    "detail": (
                        "Inventory is set by verified recoveries. "
                        "Only Climate Wavers staff can adjust manually."
                    )
                },
                status=403,
            )
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        zone_id = request.data.get("holding_zone") or request.data.get("holding_zone_id")
        try:
            zone = _pick_holding_zone(project, zone_id)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        delta = _money(request.data.get("delta_kg") or request.data.get("kg") or 0)
        if delta == 0:
            return Response({"detail": "delta_kg required."}, status=400)
        try:
            with transaction.atomic():
                entry = apply_inventory_delta(
                    zone=zone,
                    delta_kg=delta,
                    reason="adjust",
                    polymer_type=str(request.data.get("polymer_type") or "mixed"),
                    user=request.user,
                    notes=str(request.data.get("notes") or "Manual adjust")[:255],
                )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(PlasticInventoryLedgerSerializer(entry).data, status=201)


class PlasticRecyclerApplyView(APIView):
    """
    Self-serve recycler onboarding.
    Logged-in user applies (or claims a directory listing) → pending approval.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        claim_id = data.get("directory_recycler_id") or data.get("claim_recycler_id")
        name = str(data.get("name") or "").strip()[:200]
        city = str(data.get("city") or "").strip()[:100]
        phone = _normalize_phone(data.get("contact_phone") or data.get("phone") or "")
        email = str(data.get("contact_email") or data.get("email") or "").strip()[:200]
        address = str(data.get("address") or "").strip()
        website = str(data.get("website") or "").strip()[:200]
        message = str(data.get("application_message") or data.get("message") or "").strip()
        materials = data.get("materials_accepted") or []
        buy_rates = data.get("buy_rates") if isinstance(data.get("buy_rates"), dict) else {}
        accepts_small = str(data.get("accepts_small_lots", "true")).lower() not in {
            "0",
            "false",
            "no",
        }

        existing = _recycler_partners_for_user(request.user).first()
        if existing and existing.onboarding_status in ("applied", "approved"):
            return Response(
                {
                    "detail": f"Already {existing.onboarding_status}.",
                    "recycler": PlasticRecyclerSerializer(existing).data,
                },
                status=400,
            )

        partner = None
        if claim_id:
            partner = PlasticRecyclerPartner.objects.filter(pk=claim_id).first()
            if not partner:
                return Response({"detail": "Directory recycler not found."}, status=404)
            if partner.linked_user_id and partner.linked_user_id != request.user.id:
                return Response(
                    {"detail": "This directory listing is already claimed."}, status=400
                )
            name = name or partner.name
            city = city or partner.city
            phone = phone or _normalize_phone(partner.contact_phone)
            email = email or partner.contact_email

        if not name:
            return Response({"detail": "Company name required."}, status=400)
        if not city:
            return Response({"detail": "City required."}, status=400)
        if not phone and not email:
            return Response({"detail": "Phone or email required."}, status=400)

        # Yard GPS required for validation (same idea as collector proof GPS).
        try:
            lat = data.get("latitude")
            lng = data.get("longitude")
            if lat in (None, "") or lng in (None, ""):
                raise ValueError("missing")
            lat_dec = Decimal(str(lat))
            lng_dec = Decimal(str(lng))
            if not (-90 <= lat_dec <= 90 and -180 <= lng_dec <= 180):
                raise ValueError("range")
        except (InvalidOperation, ValueError, TypeError):
            return Response(
                {
                    "detail": (
                        "Yard GPS required — capture location at the recycling "
                        "site so Climate Wavers can validate the application."
                    )
                },
                status=400,
            )

        now = timezone.now()
        if partner is None:
            partner = PlasticRecyclerPartner(created_by=request.user)

        partner.name = name
        partner.city = city
        partner.contact_phone = phone or partner.contact_phone
        partner.contact_email = email or partner.contact_email
        partner.address = address or partner.address
        partner.website = website or partner.website
        partner.latitude = lat_dec
        partner.longitude = lng_dec
        if materials:
            partner.materials_accepted = materials
        if buy_rates:
            partner.buy_rates = buy_rates
        partner.accepts_small_lots = accepts_small
        partner.application_message = message
        partner.onboarding_status = "applied"
        partner.applied_at = now
        partner.linked_user = request.user
        partner.invite_status = "pending"
        partner.is_active = True
        if partner.is_directory is False and claim_id:
            partner.is_directory = True
        partner.save()

        _notify(
            request.user,
            f"Recycler application for {partner.name} submitted. Await Climate Wavers superadmin approval.",
            partner,
        )
        return Response(
            {
                "ok": True,
                "status": "applied",
                "recycler": PlasticRecyclerSerializer(partner).data,
                "next": (
                    "Climate Wavers superadmin will approve your yard, "
                    "then you can open Marketplace desk."
                ),
            },
            status=201,
        )


class PlasticRecyclerApproveView(APIView):
    """Platform superadmin / staff only — approve or reject recycler applications."""

    permission_classes = [IsAuthenticated]

    def post(self, request, recycler_id):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "Platform superadmin required."}, status=403
            )
        partner = PlasticRecyclerPartner.objects.filter(pk=recycler_id).first()
        if not partner:
            return Response({"detail": "Not found."}, status=404)

        decision = str(request.data.get("decision") or "approve").strip().lower()
        now = timezone.now()
        if decision in {"reject", "rejected"}:
            partner.onboarding_status = "rejected"
            partner.reviewed_at = now
            partner.reviewed_by = request.user
            partner.invite_status = "revoked"
            partner.save(
                update_fields=[
                    "onboarding_status",
                    "reviewed_at",
                    "reviewed_by",
                    "invite_status",
                    "updated_at",
                ]
            )
            if partner.linked_user_id:
                _notify(
                    partner.linked_user,
                    f"Recycler application for {partner.name} was rejected.",
                    partner,
                )
            return Response(PlasticRecyclerSerializer(partner).data)

        partner.onboarding_status = "approved"
        partner.reviewed_at = now
        partner.reviewed_by = request.user
        partner.invite_status = "accepted"
        partner.invite_accepted_at = now
        partner.is_active = True
        if not partner.is_directory:
            partner.is_directory = True
        partner.save()
        if partner.linked_user_id:
            _notify(
                partner.linked_user,
                f"{partner.name} approved on Plastic Pulse. Open Recycler desk to buy lots.",
                partner,
            )
        return Response(PlasticRecyclerSerializer(partner).data)


class PlasticRecyclerApplicationsView(APIView):
    """Pending recycler applications — platform superadmin / staff only."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "Platform superadmin required."}, status=403
            )
        status_filter = str(request.query_params.get("status") or "applied").strip()
        qs = PlasticRecyclerPartner.objects.all()
        if status_filter and status_filter != "all":
            qs = qs.filter(onboarding_status=status_filter)
        return Response(PlasticRecyclerSerializer(qs[:100], many=True).data)


class PlasticRecyclerOffersView(APIView):
    """Marketplace offers for the logged-in approved recycler."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        partners = list(
            _recycler_partners_for_user(request.user).filter(
                onboarding_status="approved", invite_status="accepted"
            )
        )
        if not partners:
            return Response(
                {
                    "is_recycler": False,
                    "offers": [],
                    "detail": "No approved recycler profile. Apply at /plastic/recycler-onboard.",
                }
            )
        ids = [p.id for p in partners]
        offers = (
            PlasticDispatch.objects.filter(recycler_id__in=ids)
            .exclude(status="cancelled")
            .select_related("project", "holding_zone", "recycler")
            .all()[:100]
        )
        return Response(
            {
                "is_recycler": True,
                "partners": PlasticRecyclerSerializer(partners, many=True).data,
                "offers": PlasticDispatchSerializer(offers, many=True).data,
            }
        )


class PlasticDispatchAcceptView(APIView):
    """Recycler accepts a marketplace offer."""

    permission_classes = [IsAuthenticated]

    def post(self, request, dispatch_id):
        dispatch = (
            PlasticDispatch.objects.select_related("recycler", "project")
            .filter(pk=dispatch_id)
            .first()
        )
        if not dispatch:
            return Response({"detail": "Not found."}, status=404)
        partners = _recycler_partners_for_user(request.user).filter(
            pk=dispatch.recycler_id,
            onboarding_status="approved",
            invite_status="accepted",
        )
        if not partners.exists() and not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=403)
        if dispatch.status not in ("offered", "accepted"):
            return Response(
                {"detail": f"Cannot accept from status {dispatch.status}."}, status=400
            )
        if dispatch.status != "accepted":
            dispatch.status = "accepted"
            dispatch.accepted_at = timezone.now()
            dispatch.save(update_fields=["status", "accepted_at", "updated_at"])
        return Response(PlasticDispatchSerializer(dispatch).data)


class PlasticDispatchCheckoutView(APIView):
    """
    Recycler Paystack checkout: pays Climate Wavers for the lot (KES).
    Completion via paystack product=plastic_dispatch.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, dispatch_id):
        dispatch = (
            PlasticDispatch.objects.select_related("recycler", "project")
            .filter(pk=dispatch_id)
            .first()
        )
        if not dispatch:
            return Response({"detail": "Not found."}, status=404)
        partners = _recycler_partners_for_user(request.user).filter(
            pk=dispatch.recycler_id,
            onboarding_status="approved",
        )
        if not partners.exists() and not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=403)
        if dispatch.payment_status == "received":
            return Response({"detail": "Already paid."}, status=400)
        if dispatch.total_kes is None or dispatch.total_kes <= 0:
            return Response({"detail": "Offer has no price."}, status=400)
        if dispatch.status == "cancelled":
            return Response({"detail": "Offer cancelled."}, status=400)
        if dispatch.status == "offered":
            dispatch.status = "accepted"
            dispatch.accepted_at = timezone.now()
            dispatch.save(update_fields=["status", "accepted_at", "updated_at"])

        reference = f"PLASTIC-LOT-{dispatch.id}-{uuid.uuid4().hex[:10].upper()}"
        amount_kes = float(dispatch.total_kes)
        return Response(
            {
                "success": True,
                "reference": reference,
                "dispatch_id": dispatch.id,
                "amount_kes": amount_kes,
                "product": "plastic_dispatch",
                "currency": "KES",
                "metadata": {
                    "product": "plastic_dispatch",
                    "plastic_dispatch_id": str(dispatch.id),
                    "plastic_project_id": str(dispatch.project_id),
                    "recycler_id": str(dispatch.recycler_id),
                    "kg": str(dispatch.kg),
                    "amount_kes": str(amount_kes),
                },
                "split": {
                    "platform_share_kes": float(dispatch.platform_share_kes or 0),
                    "collector_share_kes": float(dispatch.collector_share_kes or 0),
                    "fee_rate": float(dispatch.fee_rate or 0),
                },
            }
        )


class PlasticDispatchSettleView(APIView):
    """
    Record marketplace money movement (staff / Paystack webhook path):
    - action=recycler_paid → override when Paystack already recorded payment
    - action=collectors_paid → CW paid collectors/CBO their share
    """

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, dispatch_id):
        dispatch = (
            PlasticDispatch.objects.select_related("project", "recycler", "holding_zone")
            .select_for_update()
            .filter(pk=dispatch_id)
            .first()
        )
        if not dispatch:
            return Response({"detail": "Not found."}, status=404)

        action = str(request.data.get("action") or "").strip().lower()
        now = timezone.now()
        is_staff = bool(request.user.is_staff or request.user.is_superuser)

        if action in {"recycler_paid", "mark_received"}:
            # Source of truth is Paystack; CBO cannot mark platform payment.
            if not is_staff:
                return Response(
                    {
                        "detail": (
                            "Recycler payment is recorded by Paystack. "
                            "Only Climate Wavers staff can override."
                        )
                    },
                    status=403,
                )
            if dispatch.total_kes is None:
                return Response(
                    {"detail": "Set price/kg before recording payment."}, status=400
                )
            if dispatch.platform_share_kes is None or dispatch.collector_share_kes is None:
                platform, collectors, rate = split_plastic_marketplace_sale(
                    dispatch.total_kes,
                    dispatch.fee_rate or dispatch.project.marketplace_fee_rate,
                )
                dispatch.platform_share_kes = platform
                dispatch.collector_share_kes = collectors
                dispatch.fee_rate = rate
            dispatch.payment_status = "received"
            dispatch.payment_reference = str(
                request.data.get("payment_reference") or dispatch.payment_reference or ""
            ).strip()[:120]
            dispatch.payment_received_at = now
            if dispatch.collector_payout_status == "none":
                dispatch.collector_payout_status = "pending"
            phone = str(request.data.get("collector_payout_phone") or "").strip()
            if phone:
                dispatch.collector_payout_phone = phone[:40]
            dispatch.save()
            return Response(PlasticDispatchSerializer(dispatch).data)

        if action in {"collectors_paid", "mark_collector_paid"}:
            if not is_staff:
                return Response(
                    {
                        "detail": (
                            "Collector payouts are recorded by Climate Wavers staff."
                        )
                    },
                    status=403,
                )
            if dispatch.payment_status != "received":
                return Response(
                    {"detail": "Record recycler payment to Climate Wavers first."},
                    status=400,
                )
            dispatch.collector_payout_status = "paid"
            dispatch.collector_payout_reference = str(
                request.data.get("collector_payout_reference")
                or dispatch.collector_payout_reference
                or ""
            ).strip()[:120]
            phone = str(request.data.get("collector_payout_phone") or "").strip()
            if phone:
                dispatch.collector_payout_phone = phone[:40]
            dispatch.collector_paid_at = now
            dispatch.status = "settled"
            dispatch.settled_at = now
            dispatch.save()
            return Response(PlasticDispatchSerializer(dispatch).data)

        return Response(
            {
                "detail": "action must be recycler_paid or collectors_paid.",
                "model": (
                    "Recycler pays Climate Wavers → CW keeps platform share → "
                    "CW pays collectors."
                ),
            },
            status=400,
        )


class PlasticRecyclerInviteView(APIView):
    """CBO creates/refreshes a scan-only invite link for a recycler partner."""

    permission_classes = [IsAuthenticated]

    def post(self, request, recycler_id):
        if not user_has_tree_admin_access(request.user):
            return Response({"detail": "Tree Admin required."}, status=403)
        partner = PlasticRecyclerPartner.objects.filter(pk=recycler_id).first()
        if not partner:
            return Response({"detail": "Recycler not found."}, status=404)
        m = _org_membership(request.user)
        if m and partner.organization_id and partner.organization_id != m.org_id:
            if partner.created_by_id != request.user.id and not request.user.is_staff:
                return Response({"detail": "Forbidden."}, status=403)

        token = secrets.token_urlsafe(24)
        partner.invite_token = token
        partner.invite_status = "pending"
        partner.invite_expires_at = timezone.now() + timedelta(days=14)
        partner.invited_at = timezone.now()
        partner.invited_by = request.user
        # Keep linked_user until they accept a new invite? Clear so old user loses access
        # until re-accept — safer for re-invite to a different person.
        partner.linked_user = None
        partner.invite_accepted_at = None
        partner.save(
            update_fields=[
                "invite_token",
                "invite_status",
                "invite_expires_at",
                "invited_at",
                "invited_by",
                "linked_user",
                "invite_accepted_at",
                "updated_at",
            ]
        )

        urls = _invite_urls(token)
        org_name = ""
        if m and m.org:
            org_name = getattr(m.org, "name", "") or ""
        message = (
            f"Climate Wavers Plastic Pulse: {org_name or 'a CBO'} invited "
            f"{partner.name} to confirm bag intake. Open this link, sign in "
            f"(or create a free account), then scan bags:\n{urls['invite_url']}"
        )
        whatsapp_url = _whatsapp_share_url(partner.contact_phone, message)
        return Response(
            {
                "recycler": PlasticRecyclerSerializer(partner).data,
                "invite_url": urls["invite_url"],
                "invite_path": urls["invite_path"],
                "whatsapp_url": whatsapp_url,
                "message": message,
                "expires_at": partner.invite_expires_at,
            }
        )


class PlasticRecyclerInviteRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, recycler_id):
        if not user_has_tree_admin_access(request.user):
            return Response({"detail": "Tree Admin required."}, status=403)
        partner = PlasticRecyclerPartner.objects.filter(pk=recycler_id).first()
        if not partner:
            return Response({"detail": "Recycler not found."}, status=404)
        partner.invite_status = "revoked"
        partner.invite_token = ""
        partner.linked_user = None
        partner.save(
            update_fields=[
                "invite_status",
                "invite_token",
                "linked_user",
                "updated_at",
            ]
        )
        return Response({"recycler": PlasticRecyclerSerializer(partner).data})


class PlasticRecyclerInviteDetailView(APIView):
    """Public preview of a scan-only invite."""

    permission_classes = [AllowAny]

    def get(self, request, token):
        token = str(token or "").strip()
        partner = (
            PlasticRecyclerPartner.objects.select_related("organization")
            .filter(invite_token=token)
            .first()
        )
        if not partner:
            return Response({"detail": "Invite not found."}, status=404)
        status_value = partner.invite_status
        if status_value == "pending" and partner.invite_is_expired:
            partner.invite_status = "revoked"
            partner.save(update_fields=["invite_status", "updated_at"])
            status_value = "expired"
        org_name = ""
        if partner.organization_id:
            org_name = getattr(partner.organization, "name", "") or ""
        return Response(
            {
                "valid": status_value == "pending",
                "status": status_value,
                "recycler_name": partner.name,
                "city": partner.city,
                "organization_name": org_name,
                "expires_at": partner.invite_expires_at,
            }
        )


class PlasticRecyclerInviteAcceptView(APIView):
    """Authenticated user accepts invite → becomes scan-only recycler for that partner."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, token):
        token = str(token or request.data.get("token") or "").strip()
        if not token:
            return Response({"detail": "token required."}, status=400)
        partner = (
            PlasticRecyclerPartner.objects.select_for_update()
            .filter(invite_token=token)
            .first()
        )
        if not partner:
            return Response({"detail": "Invite not found."}, status=404)
        if partner.invite_status == "accepted" and partner.linked_user_id == request.user.id:
            return Response(
                {
                    "already": True,
                    "recycler": PlasticRecyclerSerializer(partner).data,
                    "scan_path": "/plastic/intake",
                }
            )
        if partner.invite_status != "pending":
            return Response(
                {"detail": f"Invite is {partner.invite_status}."}, status=400
            )
        if partner.invite_is_expired:
            partner.invite_status = "revoked"
            partner.save(update_fields=["invite_status", "updated_at"])
            return Response({"detail": "Invite expired."}, status=400)

        partner.linked_user = request.user
        partner.invite_status = "accepted"
        partner.invite_accepted_at = timezone.now()
        partner.save(
            update_fields=[
                "linked_user",
                "invite_status",
                "invite_accepted_at",
                "updated_at",
            ]
        )
        if partner.contact_email and not request.user.email:
            pass
        _notify(
            request.user,
            f"You can now scan Plastic Pulse bags for {partner.name}. Open Recycler intake.",
            partner,
        )
        return Response(
            {
                "already": False,
                "recycler": PlasticRecyclerSerializer(partner).data,
                "scan_path": "/plastic/intake",
            }
        )


class PlasticRecyclerMeView(APIView):
    """Current user's recycler profile (onboarding + marketplace + scan)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        partners = list(
            _recycler_partners_for_user(request.user).select_related("organization")
        )
        if not partners:
            return Response(
                {
                    "is_recycler": False,
                    "scan_only": False,
                    "marketplace_ready": False,
                    "partners": [],
                    "onboard_path": "/plastic/recycler-onboard",
                }
            )
        ready = any(getattr(p, "marketplace_ready", False) for p in partners)
        return Response(
            {
                "is_recycler": True,
                "scan_only": _is_scan_only_recycler(request.user),
                "marketplace_ready": ready,
                "partners": PlasticRecyclerSerializer(partners, many=True).data,
                "scan_path": "/plastic/intake",
                "desk_path": "/plastic/desk",
                "onboard_path": "/plastic/recycler-onboard",
            }
        )


class PlasticCertificateVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code=None):
        code = (code or request.query_params.get("code") or "").strip()
        if not code:
            return Response({"detail": "code required."}, status=400)
        try:
            cert = PlasticCertificate.objects.select_related("project", "recovery").get(
                code__iexact=code
            )
        except PlasticCertificate.DoesNotExist:
            return Response({"detail": "Certificate not found."}, status=404)
        data = PlasticCertificateSerializer(cert).data
        if cert.recovery_id:
            data["recovery"] = PlasticRecoverySerializer(cert.recovery).data
        return Response({"valid": True, "certificate": data})


class PlasticFloodHotspotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            PlasticHotspot.objects.filter(
                drain_related=True, status__in=("open", "claimed")
            )
            .select_related("project")
            .order_by("-created_at")[:200]
        )
        return Response(
            [
                {
                    "id": h.id,
                    "project_id": h.project_id,
                    "project_name": h.project.name,
                    "title": h.title or h.location_label or f"Hotspot {h.id}",
                    "latitude": float(h.latitude),
                    "longitude": float(h.longitude),
                    "severity": h.severity,
                    "status": h.status,
                    "drain_related": h.drain_related,
                    "photo": h.photo,
                }
                for h in qs
            ]
        )


class PlasticSponsorCheckoutView(APIView):
    """
    Prepare sponsor-a-kilo quote. Frontend opens Paystack with metadata product=plastic.
    Completion handled in paystack_payment.record_plastic_sponsorship.
    """

    permission_classes = [AllowAny]

    def post(self, request, project_id):
        try:
            project = PlasticProject.objects.select_related("tree_admin_org").get(
                pk=project_id
            )
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        kg = _money(request.data.get("kg") or request.data.get("kg_sponsored") or 0)
        if kg <= 0:
            return Response({"detail": "kg must be > 0."}, status=400)
        if kg > 5000:
            return Response({"detail": "Max 5000 kg per sponsorship."}, status=400)

        price = _money(project.sponsor_price_usd_per_kg)
        amount_usd = _money(price * kg)
        org = project.tree_admin_org
        platform_fee, admin_share, fee_rate = split_tree_payment(amount_usd, org=org)

        redeem_points = str(request.data.get("redeem_points") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        if redeem_points:
            if not request.user.is_authenticated:
                return Response({"detail": "Login required to redeem points."}, status=401)
            try:
                from .points import redeem_plastic_with_points

                result = redeem_plastic_with_points(
                    user=request.user,
                    project=project,
                    kg=kg,
                    dedication_message=str(request.data.get("dedication_message") or ""),
                )
                return Response({"success": True, "redeemed": True, **result})
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

        reference = f"PLASTIC-{uuid.uuid4().hex[:16].upper()}"
        return Response(
            {
                "success": True,
                "reference": reference,
                "project_id": project.id,
                "kg_sponsored": float(kg),
                "amount_usd": float(amount_usd),
                "sponsor_price_usd_per_kg": float(price),
                "platform_fee_usd": float(platform_fee),
                "admin_share_usd": float(admin_share),
                "fee_rate": float(fee_rate),
                "product": "plastic",
                "metadata": {
                    "product": "plastic",
                    "plastic_project_id": str(project.id),
                    "kg_sponsored": str(kg),
                    "amount_usd": str(amount_usd),
                    "dedication_message": str(
                        request.data.get("dedication_message") or ""
                    )[:500],
                    "sponsor_name": str(request.data.get("sponsor_name") or "")[:200],
                },
            }
        )


class PlasticAdminQueueView(APIView):
    """Recoveries for the caller's org. Default: awaiting CBO verify (submitted)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_tree_admin_access(request.user):
            return Response({"detail": "Tree Admin required."}, status=403)
        m = _org_membership(request.user)
        org_id = m.org_id if m else None
        allowed = {
            "submitted",
            "cbo_verified",
            "intake_confirmed",
            "rejected",
            "queued_offline",
        }
        raw_status = str(request.query_params.get("status") or "submitted").strip()
        statuses = [s.strip() for s in raw_status.split(",") if s.strip() in allowed]
        if not statuses:
            statuses = ["submitted"]
        qs = PlasticRecovery.objects.filter(status__in=statuses).select_related(
            "project", "hotspot", "submitted_by"
        )
        if org_id:
            qs = qs.filter(
                Q(project__tree_admin_org_id=org_id)
                | Q(project__organization=request.user)
            )
        else:
            qs = qs.filter(project__organization=request.user)
        return Response(
            PlasticRecoverySerializer(
                qs[:100],
                many=True,
                context={
                    "request": request,
                    "include_guest_phone": True,
                    "include_guest_whatsapp": True,
                },
            ).data
        )


class PlasticMyRecoveriesView(APIView):
    """Field collector desk — bags the current user submitted."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            PlasticRecovery.objects.filter(submitted_by=request.user)
            .select_related("project", "hotspot")
            .prefetch_related("certificates")
            .order_by("-created_at")
        )
        project_id = request.query_params.get("project") or request.query_params.get(
            "project_id"
        )
        if project_id:
            try:
                qs = qs.filter(project_id=int(project_id))
            except (TypeError, ValueError):
                return Response({"detail": "Invalid project."}, status=400)
        status_filter = str(request.query_params.get("status") or "").strip()
        if status_filter:
            allowed = {
                "queued_offline",
                "submitted",
                "cbo_verified",
                "rejected",
                "intake_confirmed",
            }
            statuses = [s.strip() for s in status_filter.split(",") if s.strip() in allowed]
            if statuses:
                qs = qs.filter(status__in=statuses)
        return Response(
            PlasticRecoverySerializer(qs[:100], many=True, context={"request": request}).data
        )


class PlasticGuestRecoveriesView(APIView):
    """Guest collector bag list — phone + guest_token (no account)."""

    permission_classes = [AllowAny]

    def post(self, request):
        phone = _normalize_phone(
            request.data.get("guest_phone")
            or request.data.get("phone")
            or request.query_params.get("phone")
        )
        token = str(
            request.data.get("guest_token")
            or request.data.get("token")
            or request.query_params.get("token")
            or ""
        ).strip()
        if len(phone) < 9 or not token:
            return Response(
                {"detail": "guest_phone and guest_token are required."}, status=400
            )
        qs = (
            PlasticRecovery.objects.filter(guest_phone=phone, guest_token=token)
            .select_related("project", "hotspot")
            .prefetch_related("certificates")
            .order_by("-created_at")
        )
        project_id = request.data.get("project") or request.query_params.get("project")
        if project_id:
            try:
                qs = qs.filter(project_id=int(project_id))
            except (TypeError, ValueError):
                return Response({"detail": "Invalid project."}, status=400)
        return Response(
            PlasticRecoverySerializer(
                qs[:100],
                many=True,
                context={
                    "request": request,
                    "include_guest_phone": True,
                    "include_guest_whatsapp": True,
                },
            ).data
        )


class PlasticBagLookupView(APIView):
    """Look up a recovery by bag_id for recycler QR intake screens (or bag owner)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, bag_id=None):
        bag_id = str(bag_id or request.query_params.get("bag") or "").strip()
        if not bag_id:
            return Response({"detail": "bag_id required."}, status=400)
        recovery = (
            PlasticRecovery.objects.select_related(
                "project", "hotspot", "submitted_by", "recycler"
            )
            .filter(bag_id__iexact=bag_id)
            .order_by("-created_at")
            .first()
        )
        if not recovery:
            return Response({"detail": "Bag not found."}, status=404)
        is_owner = recovery.submitted_by_id == request.user.id
        can_intake = _can_intake_recovery(request.user, recovery)
        if not (is_owner or can_intake or request.user.is_staff):
            return Response({"detail": "Forbidden."}, status=403)
        is_cbo = _can_manage_project(request.user, recovery.project) or request.user.is_staff
        data = PlasticRecoverySerializer(
            recovery, context={"request": request}
        ).data
        data["project_name"] = recovery.project.name if recovery.project_id else ""
        data["is_owner"] = is_owner
        if is_cbo:
            data["can_intake"] = recovery.status in ("cbo_verified", "submitted")
        elif can_intake:
            data["can_intake"] = recovery.status == "cbo_verified"
        else:
            data["can_intake"] = False
        cert = _ensure_recovery_certificate(recovery)
        data["certificate_code"] = cert.code if cert else data.get("certificate_code") or ""
        if data["certificate_code"]:
            data["verify_url"] = f"/verify/plastic/{data['certificate_code']}"
        partner = _recycler_partner_for_project(request.user, recovery.project)
        data["scanner_recycler_id"] = partner.id if partner else None
        data["scan_only"] = bool(partner) and not is_cbo
        return Response(data)
