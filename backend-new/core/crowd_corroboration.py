"""Two-way community hazard verification for nearby members (not only champions)."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .geo import haversine_km
from .models import CommunityHazardCorroboration, Disaster

logger = logging.getLogger(__name__)

CONFIRM_THRESHOLD = 3
MAX_DISTANCE_KM = 25.0


def serialize_corroboration(c: CommunityHazardCorroboration) -> dict:
    return {
        "id": c.id,
        "disaster_id": c.disaster_id,
        "user_id": c.user_id,
        "decision": c.decision,
        "note": c.note or "",
        "evidence": c.evidence or [],
        "latitude": float(c.latitude) if c.latitude is not None else None,
        "longitude": float(c.longitude) if c.longitude is not None else None,
        "distance_km": c.distance_km,
        "source_channel": c.source_channel,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def corroboration_stats(disaster_id: int) -> dict:
    agg = (
        CommunityHazardCorroboration.objects.filter(disaster_id=disaster_id)
        .values("decision")
        .annotate(n=Count("id"))
    )
    counts = {"confirm": 0, "deny": 0}
    for row in agg:
        counts[row["decision"]] = int(row["n"] or 0)
    return {
        "confirms": counts["confirm"],
        "denies": counts["deny"],
        "threshold": CONFIRM_THRESHOLD,
        "met": counts["confirm"] >= CONFIRM_THRESHOLD,
    }


def maybe_escalate_disaster(disaster: Disaster) -> str:
    stats = corroboration_stats(disaster.id)
    # Also count champion confirms toward the same ward alert
    try:
        from .models import ChampionVerification

        champ_confirms = ChampionVerification.objects.filter(
            disaster=disaster, decision="confirm"
        ).count()
    except Exception:
        champ_confirms = 0
    total_confirms = stats["confirms"] + champ_confirms
    if total_confirms >= CONFIRM_THRESHOLD and disaster.status in (
        "monitoring",
        "investigating",
        "reported",
        "pending",
    ):
        disaster.status = "alert"
        disaster.save(update_fields=["status", "updated_at"])
    elif stats["denies"] >= CONFIRM_THRESHOLD and disaster.status == "alert":
        disaster.status = "investigating"
        disaster.save(update_fields=["status", "updated_at"])
    return disaster.status


class HazardCorroborationCreateView(APIView):
    """Nearby member submits ground-truth photo + confirm/deny."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, disaster_id=None):
        disaster_id = disaster_id or request.data.get("disaster_id")
        disaster = Disaster.objects.filter(pk=disaster_id).first()
        if not disaster:
            return Response({"detail": "Disaster not found"}, status=404)

        if CommunityHazardCorroboration.objects.filter(
            disaster=disaster, user=request.user
        ).exists():
            return Response(
                {"detail": "You already corroborated this report."}, status=400
            )

        decision = (request.data.get("decision") or "").strip().lower()
        if decision not in {"confirm", "deny"}:
            return Response({"detail": "decision must be confirm or deny"}, status=400)

        try:
            lat = float(request.data.get("latitude"))
            lng = float(request.data.get("longitude"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "GPS latitude/longitude required for ground-truth."},
                status=400,
            )

        dist = None
        if disaster.latitude is not None and disaster.longitude is not None:
            dist = haversine_km(
                lat, lng, float(disaster.latitude), float(disaster.longitude)
            )
            if dist > MAX_DISTANCE_KM:
                return Response(
                    {
                        "detail": (
                            f"You must be within {int(MAX_DISTANCE_KM)}km of the "
                            f"report to corroborate (you are {dist:.1f}km away)."
                        )
                    },
                    status=400,
                )

        evidence = request.data.get("evidence") or request.data.get("images") or []
        if not isinstance(evidence, list):
            evidence = [evidence] if evidence else []
        evidence = [str(u).strip() for u in evidence if str(u or "").strip()][:8]
        if decision == "confirm" and not evidence:
            return Response(
                {"detail": "Attach at least one ground-truth photo to confirm."},
                status=400,
            )

        source = (request.data.get("source_channel") or "app").strip()
        if source not in {"app", "sms", "offline_sync"}:
            source = "app"
        was_offline = bool(
            request.data.get("was_offline") or request.data.get("offline")
        )
        client_uuid = request.data.get("client_uuid") or None

        row = CommunityHazardCorroboration.objects.create(
            disaster=disaster,
            user=request.user,
            decision=decision,
            note=(request.data.get("note") or "").strip()[:2000],
            evidence=evidence,
            latitude=Decimal(str(round(lat, 6))),
            longitude=Decimal(str(round(lng, 6))),
            accuracy_m=(
                float(request.data["accuracy_m"])
                if request.data.get("accuracy_m") not in (None, "")
                else None
            ),
            distance_km=dist,
            source_channel=source if not was_offline else "offline_sync",
            client_uuid=client_uuid,
            queued_offline_at=timezone.now() if was_offline else None,
        )
        new_status = maybe_escalate_disaster(disaster)
        stats = corroboration_stats(disaster.id)
        return Response(
            {
                "ok": True,
                "corroboration": serialize_corroboration(row),
                "stats": stats,
                "disaster_status": new_status,
            },
            status=201,
        )


class HazardCorroborationStatsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, disaster_id):
        disaster = Disaster.objects.filter(pk=disaster_id).first()
        if not disaster:
            return Response({"detail": "Not found"}, status=404)
        rows = CommunityHazardCorroboration.objects.filter(
            disaster=disaster
        ).order_by("-created_at")[:50]
        return Response(
            {
                "disaster_id": disaster.id,
                "disaster_status": disaster.status,
                "stats": corroboration_stats(disaster.id),
                "recent": [serialize_corroboration(r) for r in rows],
            }
        )


class HazardCorroborationQueueView(APIView):
    """Nearby open reports that still need crowd confirms."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            lat = float(request.query_params.get("latitude"))
            lng = float(request.query_params.get("longitude"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Pass latitude & longitude query params."}, status=400
            )

        already = CommunityHazardCorroboration.objects.filter(
            user=request.user
        ).values_list("disaster_id", flat=True)
        qs = (
            Disaster.objects.exclude(status__in=["resolved", "false_alarm"])
            .exclude(id__in=already)
            .exclude(latitude__isnull=True)
            .order_by("-created_at")[:120]
        )
        results = []
        for d in qs:
            try:
                dist = haversine_km(lat, lng, float(d.latitude), float(d.longitude))
            except Exception:
                continue
            if dist > MAX_DISTANCE_KM:
                continue
            stats = corroboration_stats(d.id)
            if stats["met"]:
                continue
            results.append(
                {
                    "id": d.id,
                    "title": getattr(d, "title", None)
                    or getattr(d, "disaster_type", None)
                    or "Hazard report",
                    "disaster_type": getattr(d, "disaster_type", None)
                    or getattr(d, "type", None),
                    "status": d.status,
                    "latitude": float(d.latitude),
                    "longitude": float(d.longitude),
                    "distance_km": round(dist, 2),
                    "city": getattr(d, "city", None) or "",
                    "country": getattr(d, "country", None) or "",
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                    "stats": stats,
                }
            )
            if len(results) >= 40:
                break
        return Response({"results": results, "count": len(results)})
