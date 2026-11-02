import json
import logging

from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from api.models import User
from api.tasks import _post_notification

from .models import NewsletterSubscriber, Notification

logger = logging.getLogger(__name__)


def _authorized(request):
    secret = request.headers.get("X-Internal-Secret") or ""
    expected = getattr(settings, "NOTIFICATION_SECRET", "") or ""
    return bool(expected) and secret == expected


@csrf_exempt
@require_http_methods(["POST"])
def fanout_disaster_alert(request):
    if not _authorized(request):
        return JsonResponse({"error": "unauthorized"}, status=401)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "invalid json"}, status=400)

    city = (payload.get("city") or payload.get("region") or "").strip()
    country = (payload.get("country") or "").strip()
    disaster_type = (payload.get("disasterType") or "disaster").strip()
    vision = (payload.get("vision") or "").strip()
    place = ", ".join([part for part in [city, country] if part]) or "an unspecified location"
    message = f"Unconfirmed {disaster_type} report in {place}."
    if vision:
        message = f"{message} Computer vision: {vision}."

    users = User.objects.filter(is_active=True)
    matched = users.none()
    if city:
        matched = users.filter(
            Q(state__iexact=city) | Q(location__icontains=city) | Q(country__iexact=city)
        )
    if country:
        country_matched = users.filter(Q(country__iexact=country) | Q(location__icontains=country))
        matched = (matched | country_matched).distinct()
    if not matched.exists():
        matched = users.filter(is_staff=True)[:50]

    notifications = [
        Notification(user=user, notification_type="post", message=message)
        for user in matched[:400]
    ]
    created = 0
    if notifications:
        Notification.objects.bulk_create(notifications)
        created = len(notifications)

    emails = list(matched.values_list("email", flat=True)[:200])
    emails += list(
        NewsletterSubscriber.objects.filter(is_active=True).values_list("email", flat=True)[:200]
    )
    unique_emails = sorted({email.lower() for email in emails if email})

    mailed = 0
    if unique_emails:
        try:
            _post_notification(
                {
                    "type": "disaster_alert",
                    "data": {
                        "city": city or country or "Climate Wavers",
                        "disasterType": disaster_type,
                        "emails": unique_emails,
                    },
                }
            )
            mailed = len(unique_emails)
        except Exception as exc:
            logger.exception("Disaster alert mail fanout failed: %s", exc)

    return JsonResponse(
        {
            "ok": True,
            "notifications": created,
            "emails": mailed,
            "message": message,
        }
    )
