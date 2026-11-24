"""Idempotent persistence for public community hazard reports.

Community reports are stored in the same Disaster table used by Champion
verification, so a report is immediately eligible for nearby champion review.
"""
from decimal import Decimal, InvalidOperation
import logging

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Disaster

logger = logging.getLogger(__name__)


TYPE_MAP = {
    "floods": "flood", "flood": "flood", "earthquake": "earthquake",
    "wildfire": "wildfire", "storm": "storm", "drought": "drought",
    "landslide": "landslide", "other": "other",
}


def _severity(value):
    try:
        magnitude = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        magnitude = Decimal("5")
    if magnitude < 2:
        return "low"
    if magnitude < 4:
        return "moderate"
    if magnitude < 6:
        return "high"
    if magnitude < 8:
        return "severe"
    return "extreme"


def _payload(disaster):
    return {
        "id": disaster.id,
        "title": disaster.title,
        "description": disaster.description,
        "disaster_type": disaster.disaster_type,
        "severity": disaster.severity,
        "status": disaster.status,
        "country": disaster.country,
        "region": disaster.region,
        "city": disaster.city,
        "latitude": float(disaster.latitude) if disaster.latitude is not None else None,
        "longitude": float(disaster.longitude) if disaster.longitude is not None else None,
        "cover_image": disaster.cover_image,
        "gallery": disaster.gallery,
        "start_date": disaster.start_date.isoformat(),
        "created_at": disaster.created_at.isoformat(),
        "is_verified": False,
    }


def _distance_km(lat1, lng1, lat2, lng2):
    from math import asin, cos, radians, sin, sqrt
    dlat, dlng = radians(float(lat2) - float(lat1)), radians(float(lng2) - float(lng1))
    a = sin(dlat / 2) ** 2 + cos(radians(float(lat1))) * cos(radians(float(lat2))) * sin(dlng / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


class CommunityDisasterReportView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}
        report_id = str(data.get("clientReportId") or data.get("client_report_id") or "").strip()
        if not report_id or len(report_id) > 80:
            return Response({"detail": "A valid client report id is required."}, status=400)
        report_id = report_id[:80]
        existing = Disaster.objects.filter(client_report_id=report_id).first()
        if existing:
            return Response({"disaster": _payload(existing), "duplicate": True}, status=200)

        raw_type = str(data.get("disasterType") or data.get("disaster_type") or "").strip().lower()
        disaster_type = TYPE_MAP.get(raw_type)
        title = str(data.get("title") or data.get("disasterType") or "Community hazard").strip()[:200]
        country = str(data.get("country") or "").strip()[:100]
        region = str(data.get("region") or data.get("city") or "").strip()[:100]
        details = str(data.get("details") or data.get("description") or "").strip()
        if not disaster_type or not country or not region or not details:
            return Response({"detail": "Disaster type, country, city/region, and details are required."}, status=400)

        coordinate = data.get("coordinate") if isinstance(data.get("coordinate"), dict) else {}
        raw_lat = data.get("latitude", data.get("lat", coordinate.get("lat")))
        raw_lng = data.get("longitude", data.get("lng", coordinate.get("lng")))
        latitude = longitude = None
        if raw_lat not in (None, "") or raw_lng not in (None, ""):
            try:
                latitude, longitude = Decimal(str(raw_lat)), Decimal(str(raw_lng))
                if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                    raise ValueError
            except (InvalidOperation, TypeError, ValueError):
                return Response({"detail": "Enter valid GPS coordinates."}, status=400)

        images = data.get("images") or []
        if isinstance(images, str):
            images = [images]
        images = [str(url)[:500] for url in images if isinstance(url, str) and url.startswith(("https://", "http://"))][:8]
        magnitude = data.get("magnitude", 5)
        try:
            magnitude = Decimal(str(magnitude))
        except (InvalidOperation, TypeError, ValueError):
            magnitude = Decimal("5")
        fields = {
            "client_report_id": report_id,
            "title": title,
            "description": details[:12000],
            "disaster_type": disaster_type,
            "severity": _severity(magnitude),
            "status": "unconfirmed",
            "country": country,
            "region": region,
            "city": region,
            "latitude": latitude,
            "longitude": longitude,
            "start_date": timezone.now(),
            "cover_image": images[0] if images else None,
            "gallery": images,
            "is_verified": False,
        }
        # Repeat reports of the same unconfirmed incident should resolve to one
        # queue item. Limit this to tightly co-located reports in a short window.
        if latitude is not None and longitude is not None:
            recent = Disaster.objects.filter(
                status="unconfirmed", disaster_type=disaster_type,
                country__iexact=country, start_date__gte=timezone.now() - timezone.timedelta(minutes=30),
            ).exclude(latitude__isnull=True).exclude(longitude__isnull=True)
            for prior in recent.order_by("-start_date")[:100]:
                if _distance_km(latitude, longitude, prior.latitude, prior.longitude) <= 1:
                    return Response({"disaster": _payload(prior), "duplicate": True}, status=200)
        try:
            with transaction.atomic():
                disaster = Disaster.objects.create(**fields)
        except IntegrityError:
            # A retried mobile/offline submission can race its first request.
            disaster = Disaster.objects.filter(client_report_id=report_id).first()
            if disaster is None:
                raise
            return Response({"disaster": _payload(disaster), "duplicate": True}, status=200)
        alert = {}
        if not data.get("syncOnly"):
            try:
                from .alerts import dispatch_disaster_alert

                alert = dispatch_disaster_alert({
                    **_payload(disaster),
                    "id": disaster.id,
                    "source": "Community report",
                    "magnitude": float(magnitude),
                    "deepLink": f"/disasters/{disaster.id}",
                    "is_official": False,
                })
            except Exception:
                logger.exception("Community disaster alert fanout failed for report %s", disaster.id)
        return Response({"disaster": _payload(disaster), "duplicate": False, "alert": alert}, status=201)
