"""Match approved responder orgs and create RapidBrief dispatches during fanout."""

import hashlib
import logging

from django.utils import timezone

from .geo import haversine_km
from .models import Notification, ResponderDispatch, ResponderOrganization
from .rapid_brief import generate_rapid_brief

logger = logging.getLogger(__name__)


def _event_key(payload, disaster_type, place, lat, lng):
    explicit = str(
        payload.get("id")
        or payload.get("event_id")
        or payload.get("eventId")
        or ""
    ).strip()
    if explicit:
        return explicit[:200]
    raw = "|".join(
        [
            str(payload.get("source") or ""),
            str(disaster_type or ""),
            str(place or ""),
            str(lat or ""),
            str(lng or ""),
            str(payload.get("magnitude") or ""),
        ]
    )
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:40]


def _type_matches(org, disaster_type):
    configured = org.disaster_types or []
    if not configured:
        return True
    needle = (disaster_type or "").strip().lower()
    if not needle:
        return True
    for raw in configured:
        token = str(raw).strip().lower()
        if not token:
            continue
        if token == needle or token in needle or needle in token:
            return True
    return False


def match_responder_orgs(lat, lng, city, country, disaster_type, limit=20):
    """Return list of (distance_km|None, org) for approved orgs in range / locale."""
    orgs = list(
        ResponderOrganization.objects.filter(verification_status="approved")
    )
    scored = []
    city_l = (city or "").strip().lower()
    country_l = (country or "").strip().lower()

    for org in orgs:
        if not _type_matches(org, disaster_type):
            continue
        dist = None
        included = False
        if lat is not None and lng is not None:
            dist = haversine_km(lat, lng, org.latitude, org.longitude)
            radius = float(org.coverage_radius_km or 150)
            if dist is not None and dist <= radius:
                included = True
        if not included and (city_l or country_l):
            hay = " ".join(
                filter(None, [org.city or "", org.country or ""])
            ).lower()
            needles = [n for n in [city_l, country_l] if n]
            if any(n and n in hay for n in needles):
                included = True
                if dist is None and lat is not None and lng is not None:
                    dist = haversine_km(lat, lng, org.latitude, org.longitude)
        if included:
            scored.append((dist, org))

    scored.sort(key=lambda item: (item[0] is None, item[0] if item[0] is not None else 0))
    return scored[:limit]


def create_responder_dispatches(
    payload,
    *,
    place,
    disaster_type,
    confidence,
    lat,
    lng,
    city,
    country,
    magnitude,
    is_official,
    ai_summary,
    source,
):
    """
    Create durable RapidBrief dispatches for matched approved orgs.
    Returns stats: created, notified_users, emails, whatsapp.
    """
    from api.tasks import _post_notification

    matches = match_responder_orgs(lat, lng, city, country, disaster_type)
    event_key = _event_key(payload, disaster_type, place, lat, lng)
    deep_link = (
        payload.get("deepLink")
        or payload.get("deep_link")
        or ""
    )

    created = 0
    notified_users = 0
    emails = []
    whatsapp = []

    for dist, org in matches:
        event = {
            "place": place,
            "city": city,
            "country": country,
            "disaster_type": disaster_type,
            "is_official": is_official,
            "isOfficial": is_official,
            "magnitude": magnitude,
        }
        brief = generate_rapid_brief(org, event, distance_km=dist)

        defaults = {
            "source": (source or "")[:40],
            "disaster_type": (disaster_type or "")[:80],
            "place": (place or "")[:300],
            "city": (city or "")[:100],
            "country": (country or "")[:100],
            "latitude": lat,
            "longitude": lng,
            "magnitude": magnitude,
            "is_official": is_official,
            "confidence": (confidence or "")[:120],
            "ai_summary": ai_summary or "",
            "ai_brief": brief,
            "payload": payload if isinstance(payload, dict) else {},
            "distance_km": round(dist, 1) if dist is not None else None,
            "notified_at": timezone.now(),
        }

        dispatch, was_created = ResponderDispatch.objects.get_or_create(
            org=org,
            event_key=event_key[:200],
            defaults=defaults,
        )
        if not was_created:
            # Refresh brief/summary if still new; do not reset status
            if dispatch.status == "new":
                dispatch.ai_brief = brief
                dispatch.ai_summary = ai_summary or dispatch.ai_summary
                dispatch.notified_at = timezone.now()
                dispatch.save(
                    update_fields=["ai_brief", "ai_summary", "notified_at", "updated_at"]
                )
            continue

        created += 1

        members = list(org.memberships.select_related("user").all())
        notes = []
        for membership in members:
            user = membership.user
            if not user or not user.is_active:
                continue
            snippet = (
                f"RapidBrief: {disaster_type or 'disaster'} near {place or 'reported area'}. "
                f"Open Responder Desk to acknowledge."
            )
            notes.append(
                Notification(
                    user=user,
                    notification_type="disaster",
                    message=snippet[:2000],
                )
            )
            notified_users += 1
        if notes:
            Notification.objects.bulk_create(notes)

        if org.contact_email:
            emails.append(org.contact_email.lower())
        if org.whatsapp_opt_in and org.contact_phone:
            whatsapp.append({"phone": org.contact_phone, "name": org.name})

    emailed = 0
    wa_sent = 0
    mail_payload = {
        "city": place,
        "disasterType": disaster_type,
        "country": country,
        "emails": sorted(set(emails)),
        "confidence": confidence,
        "aiSummary": ai_summary,
        "source": source,
        "deepLink": deep_link or None,
        "magnitude": magnitude,
        "isOfficial": is_official,
        "audience": "responder",
        "disclaimer": (
            "Climate Wavers RapidBrief — not a government emergency warning. "
            "Follow local authorities."
        ),
    }
    if emails:
        try:
            _post_notification({"type": "disaster_alert", "data": mail_payload})
            emailed = len(set(emails))
        except Exception as exc:
            logger.exception("Responder RapidBrief mail failed: %s", exc)
    if whatsapp:
        try:
            _post_notification(
                {
                    "type": "disaster_alert_whatsapp",
                    "data": {
                        **mail_payload,
                        "recipients": whatsapp,
                        "template": "disaster_alert_agency",
                        "audience": "responder",
                    },
                }
            )
            wa_sent = len(whatsapp)
        except Exception as exc:
            logger.exception("Responder RapidBrief WhatsApp failed: %s", exc)

    return {
        "responder_dispatches": created,
        "responder_notifications": notified_users,
        "responder_emails": emailed,
        "responder_whatsapp": wa_sent,
        "responder_matched": len(matches),
    }
