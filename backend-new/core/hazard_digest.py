"""Scheduled SMS / WhatsApp digests of nearby USGS/NASA + community hazards."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.tasks import _post_notification

from .geo import haversine_km
from .models import Disaster, HazardDigestLog, UserAlertPreference
from .sms_gateway import send_sms

logger = logging.getLogger(__name__)
FRONTEND = getattr(settings, "FRONTEND_URL", "https://alerts.flowops.africa").rstrip("/")


def _window_for(cadence: str):
    now = timezone.now()
    if cadence == "weekly":
        return now - timedelta(days=7), now
    return now - timedelta(hours=26), now


def _nearby_disasters(pref: UserAlertPreference, since, until):
    qs = Disaster.objects.filter(
        created_at__gte=since,
        created_at__lte=until,
    ).exclude(status="resolved")
    if pref.min_magnitude is not None:
        qs = qs.filter(Q(magnitude__isnull=True) | Q(magnitude__gte=pref.min_magnitude))

    rows = []
    for d in qs.order_by("-created_at")[:80]:
        if pref.latitude and pref.longitude and d.latitude and d.longitude:
            try:
                dist = haversine_km(
                    float(pref.latitude),
                    float(pref.longitude),
                    float(d.latitude),
                    float(d.longitude),
                )
            except Exception:
                dist = None
            if dist is not None and dist > float(pref.radius_km or 100):
                continue
            rows.append((d, dist))
        else:
            # Soft match on city/country text when GPS missing
            hay = f"{getattr(d, 'city', '')} {getattr(d, 'region', '')} {getattr(d, 'country', '')}".lower()
            user_hay = " ".join(
                filter(
                    None,
                    [
                        getattr(pref.user, "state", None),
                        getattr(pref.user, "country", None),
                        getattr(pref.user, "location", None),
                    ],
                )
            ).lower()
            if user_hay and any(part and part in hay for part in user_hay.split() if len(part) > 3):
                rows.append((d, None))
    return rows[:8]


def _digest_text(pref, rows) -> str:
    cadence = pref.digest_cadence or "daily"
    if not rows:
        return (
            f"Climate Wavers {cadence} digest: no new hazards in your "
            f"{pref.radius_km or 100}km radius. Stay ready → {FRONTEND}/app"
        )
    lines = [f"Climate Wavers {cadence} hazard digest ({len(rows)}):"]
    for d, dist in rows:
        place = ", ".join(
            filter(None, [getattr(d, "city", None), getattr(d, "country", None)])
        ) or "unspecified"
        dtype = getattr(d, "disaster_type", None) or getattr(d, "type", None) or "hazard"
        mag = f" M{d.magnitude}" if getattr(d, "magnitude", None) else ""
        near = f" · {dist:.0f}km" if dist is not None else ""
        lines.append(f"• {dtype}{mag} near {place}{near}")
    lines.append(f"Open map: {FRONTEND}/impact-map")
    return "\n".join(lines)[:900]


def _send_whatsapp_digest(phone: str, text: str) -> dict:
    try:
        result = _post_notification(
            {
                "type": "disaster_alert_whatsapp",
                "data": {
                    "template": "hazard_digest",
                    "body": text,
                    "recipients": [{"phone": phone}],
                },
            }
        )
        return {"ok": True, "result": result}
    except Exception as exc:
        logger.warning("WhatsApp digest failed: %s", exc)
        # Fall back to Meta text if helper exists
        try:
            from . import meta_whatsapp

            if hasattr(meta_whatsapp, "send_text"):
                meta_whatsapp.send_text(phone, text)
                return {"ok": True, "result": "meta_text"}
        except Exception as exc2:
            return {"ok": False, "detail": str(exc2)[:300]}
        return {"ok": False, "detail": str(exc)[:300]}


def send_digest_for_pref(pref: UserAlertPreference) -> dict:
    cadence = pref.digest_cadence or "daily"
    since, until = _window_for(cadence)
    if pref.last_digest_at:
        min_gap = timedelta(hours=20) if cadence == "daily" else timedelta(days=6)
        if timezone.now() - pref.last_digest_at < min_gap:
            return {"ok": False, "skipped": "too_soon"}

    rows = _nearby_disasters(pref, since, until)
    text = _digest_text(pref, rows)
    channel = pref.digest_channel or "whatsapp"
    phone = (pref.phone or getattr(pref.user, "phone", None) or "").strip()
    results = []

    if channel in ("sms", "both") and (pref.sms_alerts or channel == "sms"):
        if not phone:
            results.append({"channel": "sms", "ok": False, "detail": "no phone"})
        else:
            sms = send_sms(phone, text)
            HazardDigestLog.objects.create(
                user=pref.user,
                channel="sms",
                cadence=cadence,
                alert_count=len(rows),
                payload_preview=text[:500],
                success=bool(sms.get("ok")),
                error=str(sms.get("detail") or "")[:500],
            )
            results.append({"channel": "sms", **sms})

    if channel in ("whatsapp", "both") and (
        pref.whatsapp_alerts or channel == "whatsapp"
    ):
        if not phone or not pref.phone_verified:
            results.append(
                {"channel": "whatsapp", "ok": False, "detail": "phone not verified"}
            )
        else:
            wa = _send_whatsapp_digest(phone, text)
            HazardDigestLog.objects.create(
                user=pref.user,
                channel="whatsapp",
                cadence=cadence,
                alert_count=len(rows),
                payload_preview=text[:500],
                success=bool(wa.get("ok")),
                error=str(wa.get("detail") or "")[:500],
            )
            results.append({"channel": "whatsapp", **wa})

    pref.last_digest_at = timezone.now()
    pref.save(update_fields=["last_digest_at", "updated_at"])
    return {"ok": True, "alerts": len(rows), "results": results}


def run_hazard_digests(limit: int = 300) -> dict:
    prefs = (
        UserAlertPreference.objects.select_related("user")
        .filter(digest_enabled=True, user__is_active=True)
        .order_by("last_digest_at")[:limit]
    )
    sent = 0
    skipped = 0
    for pref in prefs:
        try:
            out = send_digest_for_pref(pref)
            if out.get("ok"):
                sent += 1
            else:
                skipped += 1
        except Exception as exc:
            logger.exception("Digest failed user=%s: %s", pref.user_id, exc)
            skipped += 1
    return {"sent": sent, "skipped": skipped}


class HazardDigestRunView(APIView):
    """Staff / internal cron hook to flush digests."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            secret = request.headers.get("X-Internal-Secret") or ""
            expected = getattr(settings, "NOTIFICATION_SECRET", "") or ""
            if not expected or secret != expected:
                return Response({"detail": "Forbidden"}, status=403)
        return Response(run_hazard_digests())
