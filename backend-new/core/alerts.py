import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from api.tasks import _post_notification

from .geo import haversine_km, nearby_agencies
from .models import (
    EmergencyAgency,
    NewsletterSubscriber,
    Notification,
    UserAlertPreference,
)

logger = logging.getLogger(__name__)

DEFAULT_RADIUS_KM = 100
FRONTEND = getattr(settings, "FRONTEND_URL", "https://alerts.flowops.africa").rstrip("/")


def _authorized(request):
    secret = request.headers.get("X-Internal-Secret") or ""
    expected = getattr(settings, "NOTIFICATION_SECRET", "") or ""
    return bool(expected) and secret == expected


def _confidence_label(is_official):
    if is_official:
        return "Confirmed official feed"
    return "Community report — unconfirmed"


def _build_message(payload):
    city = (payload.get("city") or payload.get("region") or "").strip()
    country = (payload.get("country") or "").strip()
    disaster_type = (payload.get("disasterType") or payload.get("disaster_type") or "disaster").strip()
    vision = (payload.get("vision") or "").strip()
    ai_summary = (payload.get("aiSummary") or payload.get("ai_summary") or "").strip()
    is_official = bool(payload.get("isOfficial") or payload.get("is_official"))
    place = ", ".join([part for part in [city, country] if part]) or "an unspecified location"
    confidence = _confidence_label(is_official)
    if is_official:
        message = f"{confidence}: {disaster_type} near {place}."
    else:
        message = f"{confidence}: {disaster_type} report in {place}."
    if payload.get("magnitude") is not None:
        message = f"{message} Magnitude {payload.get('magnitude')}."
    if ai_summary:
        message = f"{message} {ai_summary}"
    elif vision:
        message = f"{message} Computer vision: {vision}."
    message = f"{message} Follow local emergency instructions."
    return message, place, disaster_type, confidence


class _PrefProxy:
    """Lightweight stand-in when a user has not saved alert preferences yet."""

    def __init__(self, user):
        self.user = user
        self.email_alerts = True
        self.whatsapp_alerts = False
        self.radius_km = DEFAULT_RADIUS_KM
        self.min_magnitude = 4.5
        self.latitude = None
        self.longitude = None
        self.phone = getattr(user, "phone", None)
        self.phone_verified = False


def _user_location_hay(user):
    return " ".join(
        filter(None, [user.state, user.country, user.location])
    ).lower()


def _match_users(lat, lng, city, country, magnitude=None):
    prefs = list(
        UserAlertPreference.objects.select_related("user").filter(user__is_active=True)
    )
    pref_user_ids = {pref.user_id for pref in prefs}
    # Soft default: active users without prefs still get email on city/country match
    from api.models import User

    extras = User.objects.filter(is_active=True).exclude(id__in=pref_user_ids)[:500]
    for user in extras:
        prefs.append(_PrefProxy(user))

    matched = []
    for pref in prefs:
        if not pref.email_alerts and not pref.whatsapp_alerts:
            continue

        radius = float(pref.radius_km or DEFAULT_RADIUS_KM)
        included = False
        if lat is not None and lng is not None and pref.latitude and pref.longitude:
            dist = haversine_km(lat, lng, pref.latitude, pref.longitude)
            if dist is not None and dist <= radius:
                included = True
        elif city or country:
            hay = _user_location_hay(pref.user)
            needles = [n.lower() for n in [city, country] if n]
            if any(n and n in hay for n in needles):
                included = True

        if included:
            matched.append(pref)
    return matched


def _agency_rows(lat, lng, radius_km=150, limit=5):
    if lat is None or lng is None:
        return []
    agencies = EmergencyAgency.objects.filter(is_active=True)
    scored = nearby_agencies(agencies, lat, lng, radius_km=radius_km, limit=limit)
    rows = []
    for dist, agency in scored:
        rows.append(
            {
                "id": agency.id,
                "name": agency.name,
                "type": agency.agency_type,
                "phone": agency.phone,
                "email": agency.email,
                "whatsapp_opt_in": agency.whatsapp_opt_in,
                "distance_km": round(dist, 1),
            }
        )
    return rows


def dispatch_disaster_alert(payload):
    """
    Core fanout used by HTTP endpoint and official poller.
    Returns stats dict.
    """
    message, place, disaster_type, confidence = _build_message(payload)
    lat = payload.get("latitude")
    lng = payload.get("longitude")
    try:
        lat = float(lat) if lat is not None and lat != "" else None
        lng = float(lng) if lng is not None and lng != "" else None
    except (TypeError, ValueError):
        lat = lng = None

    magnitude = payload.get("magnitude")
    city = (payload.get("city") or payload.get("region") or "").strip()
    country = (payload.get("country") or "").strip()
    source = (payload.get("official_source") or payload.get("source") or "").strip()
    source_url = (payload.get("source_url") or "").strip()
    event_id = str(payload.get("id") or payload.get("event_id") or "")
    deep_link = (
        payload.get("deepLink")
        or payload.get("deep_link")
        or f"{FRONTEND}/disasters"
    )
    ai_summary = (payload.get("aiSummary") or payload.get("ai_summary") or "").strip()
    is_official = bool(payload.get("isOfficial") or payload.get("is_official"))

    # Magnitude gate only for earthquake prefs when magnitude present
    prefs = _match_users(lat, lng, city, country, magnitude)
    if magnitude is not None:
        filtered = []
        for pref in prefs:
            dtype = (disaster_type or "").lower()
            if dtype == "earthquake":
                try:
                    if float(magnitude) < float(pref.min_magnitude or 4.5):
                        continue
                except (TypeError, ValueError):
                    pass
            filtered.append(pref)
        prefs = filtered

    agencies = _agency_rows(lat, lng)
    agency_blurb = ""
    if agencies:
        agency_blurb = " Nearby agencies: " + "; ".join(
            f"{a['name']} ({a.get('phone') or 'n/a'})" for a in agencies[:3]
        )

    in_app_message = f"{message}{agency_blurb}"
    notifications = [
        Notification(
            user=pref.user,
            notification_type="disaster",
            message=in_app_message[:2000],
        )
        for pref in prefs[:400]
    ]
    created = 0
    if notifications:
        Notification.objects.bulk_create(notifications)
        created = len(notifications)

    email_recipients = []
    whatsapp_recipients = []
    for pref in prefs[:300]:
        if pref.email_alerts and pref.user.email:
            email_recipients.append(pref.user.email.lower())
        if (
            pref.whatsapp_alerts
            and pref.phone_verified
            and (pref.phone or pref.user.phone)
        ):
            whatsapp_recipients.append(
                {
                    "phone": pref.phone or pref.user.phone,
                    "email": pref.user.email,
                    "name": pref.user.get_full_name or pref.user.username,
                }
            )

    # Newsletter only when at least one nearby/matched user was found (avoid global spam)
    if prefs:
        email_recipients += list(
            NewsletterSubscriber.objects.filter(is_active=True).values_list(
                "email", flat=True
            )[:100]
        )
    unique_emails = sorted({e.lower() for e in email_recipients if e})

    mail_payload = {
        "city": place,
        "disasterType": disaster_type,
        "country": country,
        "emails": unique_emails,
        "confidence": confidence,
        "aiSummary": ai_summary,
        "source": source,
        "sourceUrl": source_url,
        "deepLink": deep_link,
        "magnitude": magnitude,
        "isOfficial": is_official,
        "agencies": agencies,
        "eventId": event_id,
        "disclaimer": (
            "Climate Wavers operational alert — not a government emergency warning. "
            "Follow local authorities."
        ),
    }

    mailed = 0
    if unique_emails:
        try:
            _post_notification({"type": "disaster_alert", "data": mail_payload})
            mailed = len(unique_emails)
        except Exception as exc:
            logger.exception("Disaster alert mail fanout failed: %s", exc)

    wa_sent = 0
    if whatsapp_recipients:
        try:
            _post_notification(
                {
                    "type": "disaster_alert_whatsapp",
                    "data": {
                        **mail_payload,
                        "recipients": whatsapp_recipients,
                        "template": "disaster_alert_user",
                    },
                }
            )
            wa_sent = len(whatsapp_recipients)
        except Exception as exc:
            logger.exception("Disaster alert WhatsApp fanout failed: %s", exc)

    agency_emails = [a["email"] for a in agencies if a.get("email")]
    agency_wa = [
        {"phone": a["phone"], "name": a["name"]}
        for a in agencies
        if a.get("whatsapp_opt_in") and a.get("phone")
    ]
    agency_mailed = 0
    agency_wa_sent = 0
    if agency_emails:
        try:
            _post_notification(
                {
                    "type": "disaster_alert",
                    "data": {
                        **mail_payload,
                        "emails": agency_emails,
                        "audience": "agency",
                        "city": place,
                    },
                }
            )
            agency_mailed = len(agency_emails)
        except Exception as exc:
            logger.exception("Agency alert mail failed: %s", exc)
    if agency_wa:
        try:
            _post_notification(
                {
                    "type": "disaster_alert_whatsapp",
                    "data": {
                        **mail_payload,
                        "recipients": agency_wa,
                        "template": "disaster_alert_agency",
                        "audience": "agency",
                    },
                }
            )
            agency_wa_sent = len(agency_wa)
        except Exception as exc:
            logger.exception("Agency WhatsApp alert failed: %s", exc)

    responder_stats = {}
    try:
        from .responder_dispatch import create_responder_dispatches

        responder_stats = create_responder_dispatches(
            payload,
            place=place,
            disaster_type=disaster_type,
            confidence=confidence,
            lat=lat,
            lng=lng,
            city=city,
            country=country,
            magnitude=magnitude,
            is_official=is_official,
            ai_summary=ai_summary,
            source=source,
        )
    except Exception as exc:
        logger.exception("Responder RapidBrief dispatch failed: %s", exc)
        responder_stats = {"error": str(exc)}

    return {
        "ok": True,
        "notifications": created,
        "emails": mailed,
        "whatsapp": wa_sent,
        "agency_emails": agency_mailed,
        "agency_whatsapp": agency_wa_sent,
        "agencies": agencies,
        "message": in_app_message,
        "matched_users": len(prefs),
        **responder_stats,
    }


@csrf_exempt
@require_http_methods(["POST"])
def fanout_disaster_alert(request):
    if not _authorized(request):
        return JsonResponse({"error": "unauthorized"}, status=401)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "invalid json"}, status=400)

    result = dispatch_disaster_alert(payload)
    return JsonResponse(result)
