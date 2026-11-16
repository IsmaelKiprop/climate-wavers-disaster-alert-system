"""Community Champions — Verify / Warn nearby / CCTV / enrollment APIs."""

from __future__ import annotations

import logging
import math
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .champion_curriculum import (
    CURRICULUM,
    grade_quiz,
    lesson_payload,
    module_by_id,
    public_module_card,
)

from .models import (
    CameraAccessLog,
    CameraClip,
    ChampionCheckIn,
    ChampionEnrollment,
    ChampionRating,
    ChampionTrainingProgress,
    ChampionVerification,
    CommunityChampion,
    DeviceLocationPing,
    DevicePushToken,
    Disaster,
    Notification,
    PartnerCamera,
    ProximityBlast,
    ProximityBlastReceipt,
)
from .signals import send_to_websocket

User = get_user_model()
logger = logging.getLogger(__name__)

TRAINING_MODULES = [m["id"] for m in CURRICULUM]
WARN_TEMPLATES = [
    "Hazard nearby — move to safety now",
    "Verified flood risk in your area — seek higher ground",
    "Fire / smoke nearby — avoid the area",
    "Stay indoors until further notice",
]


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    try:
        la1, lo1, la2, lo2 = map(float, (lat1, lng1, lat2, lng2))
    except (TypeError, ValueError):
        return 9999.0
    r = 6371.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1)
    dl = math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def get_champion(user) -> CommunityChampion | None:
    if not user or not user.is_authenticated:
        return None
    return CommunityChampion.objects.filter(user=user).first()


def require_active_champion(user):
    champ = get_champion(user)
    if not champ or champ.status != "active":
        return None, Response(
            {"detail": "Active Community Champion profile required."},
            status=403,
        )
    return champ, None


def compute_champion_impact(champ: CommunityChampion) -> dict:
    """Aggregate measurable impact + refresh cached score/rating fields."""
    verifs = ChampionVerification.objects.filter(champion=champ)
    vstats = verifs.aggregate(
        total=Count("id"),
        confirms=Count("id", filter=Q(decision="confirm")),
        denies=Count("id", filter=Q(decision="deny")),
        escalates=Count("id", filter=Q(decision="escalate")),
        avg_evidence=Avg("evidence_score"),
    )
    blast_stats = ProximityBlast.objects.filter(champion=champ).aggregate(
        blasts=Count("id"),
        delivered=Sum("delivered_count"),
        need_help=Sum("need_help_count"),
        acked=Sum("acked_count"),
    )
    enrollments = champ.enrollments.count()
    training_done = champ.training.filter(passed=True).count()
    training_total = len(TRAINING_MODULES)
    rating_stats = champ.ratings.aggregate(avg=Avg("score"), count=Count("id"))
    rating_avg = float(rating_stats["avg"] or 0)
    rating_count = int(rating_stats["count"] or 0)

    confirms = int(vstats["confirms"] or 0)
    denies = int(vstats["denies"] or 0)
    escalates = int(vstats["escalates"] or 0)
    avg_evidence = float(vstats["avg_evidence"] or 0)
    delivered = int(blast_stats["delivered"] or 0)
    blasts = int(blast_stats["blasts"] or 0)

    # Weighted 0–100 impact score
    score = 0
    score += min(confirms * 8, 32)
    score += min(denies * 3, 12)  # false-alarm filtering also has value
    score += min(escalates * 4, 12)
    score += min(int(avg_evidence / 5), 20)
    score += min(enrollments * 2, 12)
    score += min(delivered, 10)
    score += min(int(rating_avg * rating_count), 10) if rating_count else 0
    score += 2 if training_done >= training_total else 0
    impact_score = max(0, min(100, score))

    CommunityChampion.objects.filter(id=champ.id).update(
        verifications_count=int(vstats["total"] or 0),
        enrollments_count=enrollments,
        proximity_blasts_count=blasts,
        rating_avg=round(rating_avg, 2),
        rating_count=rating_count,
        impact_score=impact_score,
    )
    champ.verifications_count = int(vstats["total"] or 0)
    champ.enrollments_count = enrollments
    champ.proximity_blasts_count = blasts
    champ.rating_avg = round(rating_avg, 2)
    champ.rating_count = rating_count
    champ.impact_score = impact_score

    return {
        "impact_score": impact_score,
        "rating_avg": round(rating_avg, 2),
        "rating_count": rating_count,
        "verifications": {
            "total": int(vstats["total"] or 0),
            "confirms": confirms,
            "denies": denies,
            "escalates": escalates,
            "avg_evidence_score": round(avg_evidence, 1),
        },
        "alerts": {
            "blasts": blasts,
            "people_reached": delivered,
            "acked": int(blast_stats["acked"] or 0),
            "need_help": int(blast_stats["need_help"] or 0),
        },
        "enrollments": enrollments,
        "training": {
            "completed": training_done,
            "total": training_total,
        },
    }


def serialize_champion(champ: CommunityChampion, *, public=False) -> dict:
    data = {
        "id": champ.id,
        "display_name": champ.display_name or getattr(champ.user, "username", ""),
        "bio": champ.bio,
        "affiliation": champ.affiliation,
        "languages": champ.languages,
        "country": champ.country,
        "region": champ.region,
        "city": champ.city,
        "ward": champ.ward,
        "latitude": float(champ.latitude) if champ.latitude is not None else None,
        "longitude": float(champ.longitude) if champ.longitude is not None else None,
        "radius_km": champ.radius_km,
        "tier": champ.tier,
        "status": champ.status,
        "sponsor_name": champ.sponsor_name,
        "verifications_count": champ.verifications_count,
        "enrollments_count": champ.enrollments_count,
        "proximity_blasts_count": champ.proximity_blasts_count,
        "rating_avg": float(champ.rating_avg or 0),
        "rating_count": champ.rating_count or 0,
        "impact_score": champ.impact_score or 0,
        "certificate_code": champ.certificate_code or "",
        "certificate_issued_at": champ.certificate_issued_at.isoformat()
        if champ.certificate_issued_at
        else None,
        "last_check_in_at": champ.last_check_in_at.isoformat()
        if champ.last_check_in_at
        else None,
        "trained_at": champ.trained_at.isoformat() if champ.trained_at else None,
        "approved_at": champ.approved_at.isoformat() if champ.approved_at else None,
    }
    if not public:
        data.update(
            {
                "phone": champ.phone,
                "relay_nodes": champ.relay_nodes or [],
                "user_id": champ.user_id,
            }
        )
    return data


def serialize_verification(v: ChampionVerification) -> dict:
    return {
        "id": v.id,
        "disaster_id": v.disaster_id,
        "decision": v.decision,
        "note": v.note,
        "feed_comparison": v.feed_comparison,
        "field_signals": v.field_signals or {},
        "latitude": float(v.latitude) if v.latitude is not None else None,
        "longitude": float(v.longitude) if v.longitude is not None else None,
        "accuracy_m": v.accuracy_m,
        "distance_km": v.distance_km,
        "evidence": v.evidence or [],
        "jitsi_room": v.jitsi_room,
        "evidence_score": v.evidence_score,
        "source_channel": v.source_channel,
        "created_at": v.created_at.isoformat(),
    }


def compute_evidence_score(payload: dict, distance_km: float | None) -> int:
    score = 0
    if distance_km is not None and distance_km <= 5:
        score += 25
    accuracy = payload.get("accuracy_m")
    try:
        if accuracy is not None and float(accuracy) <= 50:
            score += 15
    except (TypeError, ValueError):
        pass
    evidence = payload.get("evidence") or []
    kinds = {str(e.get("kind") or "") for e in evidence if isinstance(e, dict)}
    if kinds & {"photo", "video"}:
        score += 20
    if "live_cam" in kinds or payload.get("jitsi_room"):
        score += 15
    if kinds & {"cctv_clip", "cctv_snapshot"}:
        score += 25
    if "voice" in kinds or (payload.get("note") or "").strip():
        score += 10
    if payload.get("feed_comparison"):
        score += 5
    return min(score, 100)


def notify_user(user, message: str, ntype: str = "champion", content=None):
    if not user:
        return
    notice = Notification.objects.create(
        user=user,
        notification_type=ntype,
        message=message,
    )
    try:
        send_to_websocket(
            notice.id,
            user.username,
            message,
            user,
            ntype,
            content=content or {},
        )
    except Exception:
        pass


def _parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class ChampionApplyView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        existing = get_champion(request.user)
        if existing:
            return Response(
                {
                    "detail": "Application already exists",
                    "champion": serialize_champion(existing),
                },
                status=200,
            )
        data = request.data or {}
        lat = _parse_float(data.get("latitude"))
        lng = _parse_float(data.get("longitude"))
        display = (
            (data.get("display_name") or "").strip()
            or f"{(request.user.first_name or '').strip()} {(request.user.last_name or '').strip()}".strip()
            or request.user.username
        )
        champ = CommunityChampion.objects.create(
            user=request.user,
            status="pending",
            tier="trainee",
            display_name=display[:120],
            bio=(data.get("bio") or "").strip()[:2000],
            phone=(data.get("phone") or getattr(request.user, "phone", None) or "")[
                :32
            ],
            affiliation=(data.get("affiliation") or "").strip()[:200],
            languages=(data.get("languages") or "").strip()[:200],
            country=(data.get("country") or getattr(request.user, "country", None) or "Kenya")[
                :100
            ]
            or "Kenya",
            region=(data.get("region") or "").strip()[:100],
            city=(data.get("city") or getattr(request.user, "state", None) or "")[:100],
            ward=(data.get("ward") or "").strip()[:100],
            latitude=lat,
            longitude=lng,
            radius_km=CommunityChampion.TIER_RADIUS_KM["trainee"],
            relay_nodes=data.get("relay_nodes")
            if isinstance(data.get("relay_nodes"), list)
            else [],
        )
        return Response({"champion": serialize_champion(champ)}, status=201)


class ChampionMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ = get_champion(request.user)
        if not champ:
            return Response({"champion": None})
        training = list(
            champ.training.filter(passed=True)
            .values_list("module", flat=True)
            .order_by("module")
        )
        impact = compute_champion_impact(champ) if champ.status == "active" else None
        return Response(
            {
                "champion": serialize_champion(champ),
                "impact": impact,
                "training_completed": training,
                "training_modules": TRAINING_MODULES,
                "certificate": serialize_certificate(champ),
                "warn_templates": WARN_TEMPLATES,
            }
        )

    def patch(self, request):
        champ = get_champion(request.user)
        if not champ:
            return Response({"detail": "No champion profile"}, status=404)
        data = request.data or {}
        for field in (
            "display_name",
            "bio",
            "phone",
            "affiliation",
            "languages",
            "country",
            "region",
            "city",
            "ward",
            "sponsor_name",
        ):
            if field in data:
                setattr(champ, field, str(data.get(field) or "")[:200])
        if "latitude" in data:
            champ.latitude = _parse_float(data.get("latitude"))
        if "longitude" in data:
            champ.longitude = _parse_float(data.get("longitude"))
        if "relay_nodes" in data and isinstance(data.get("relay_nodes"), list):
            champ.relay_nodes = data.get("relay_nodes")[:20]
        champ.save()
        return Response(
            {
                "champion": serialize_champion(champ),
                "certificate": serialize_certificate(champ),
            }
        )


class ChampionCheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            # Allow pending check-in only for active; pending can still set location via PATCH
            champ = get_champion(request.user)
            if not champ:
                return Response({"detail": "No champion profile"}, status=404)
        lat = _parse_float(request.data.get("latitude"))
        lng = _parse_float(request.data.get("longitude"))
        if lat is None or lng is None:
            return Response({"detail": "latitude and longitude required"}, status=400)
        accuracy = _parse_float(request.data.get("accuracy_m"))
        check = ChampionCheckIn.objects.create(
            champion=champ,
            latitude=lat,
            longitude=lng,
            accuracy_m=accuracy,
        )
        champ.last_check_in_at = check.created_at
        champ.latitude = lat
        champ.longitude = lng
        champ.save(update_fields=["last_check_in_at", "latitude", "longitude", "updated_at"])
        return Response(
            {
                "check_in_id": check.id,
                "last_check_in_at": check.created_at.isoformat(),
            }
        )


class ChampionDirectoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = CommunityChampion.objects.filter(status="active").select_related("user")
        country = (request.query_params.get("country") or "").strip()
        if country:
            qs = qs.filter(country__iexact=country)
        city = (request.query_params.get("city") or "").strip()
        if city:
            qs = qs.filter(city__icontains=city)
        order = (request.query_params.get("order") or "impact").strip().lower()
        if order == "rating":
            qs = qs.order_by("-rating_avg", "-rating_count", "-impact_score")
        else:
            qs = qs.order_by("-impact_score", "-rating_avg", "-verifications_count")
        results = [serialize_champion(c, public=True) for c in qs[:100]]
        return Response({"count": len(results), "results": results})


class ChampionImpactView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, champion_id=None):
        if champion_id:
            champ = CommunityChampion.objects.filter(id=champion_id).first()
            if champ and champ.status != "active" and not (
                request.user
                and request.user.is_authenticated
                and (
                    request.user.id == champ.user_id
                    or request.user.is_staff
                    or request.user.is_superuser
                )
            ):
                return Response({"detail": "Champion not found"}, status=404)
        elif request.user and request.user.is_authenticated:
            champ = get_champion(request.user)
        else:
            return Response(
                {"detail": "Sign in or pass champion_id"}, status=401
            )
        if not champ:
            return Response({"detail": "Champion not found"}, status=404)
        impact = compute_champion_impact(champ)
        is_owner = bool(
            request.user
            and request.user.is_authenticated
            and request.user.id == champ.user_id
        )
        return Response(
            {
                "champion": serialize_champion(champ, public=not is_owner),
                "impact": impact,
            }
        )


class ChampionRatingListCreateView(APIView):
    """GET public ratings; POST/PUT authenticated community rating (not self)."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, champion_id):
        champ = CommunityChampion.objects.filter(id=champion_id, status="active").first()
        if not champ:
            return Response({"detail": "Champion not found"}, status=404)
        rows = (
            ChampionRating.objects.filter(champion=champ)
            .select_related("user")
            .order_by("-updated_at")[:50]
        )
        my_rating = None
        if request.user and request.user.is_authenticated:
            mine = ChampionRating.objects.filter(
                champion=champ, user=request.user
            ).first()
            if mine:
                my_rating = {
                    "score": mine.score,
                    "comment": mine.comment,
                    "updated_at": mine.updated_at.isoformat(),
                }
        return Response(
            {
                "rating_avg": float(champ.rating_avg or 0),
                "rating_count": champ.rating_count or 0,
                "impact_score": champ.impact_score or 0,
                "my_rating": my_rating,
                "results": [
                    {
                        "id": r.id,
                        "score": r.score,
                        "comment": r.comment,
                        "user_name": getattr(r.user, "username", "") or f"user-{r.user_id}",
                        "updated_at": r.updated_at.isoformat(),
                    }
                    for r in rows
                ],
            }
        )

    def post(self, request, champion_id):
        champ = CommunityChampion.objects.filter(id=champion_id, status="active").first()
        if not champ:
            return Response({"detail": "Champion not found"}, status=404)
        if champ.user_id == request.user.id:
            return Response({"detail": "You cannot rate yourself"}, status=400)
        try:
            score = int(request.data.get("score"))
        except (TypeError, ValueError):
            return Response({"detail": "score must be 1–5"}, status=400)
        if score < 1 or score > 5:
            return Response({"detail": "score must be 1–5"}, status=400)
        comment = (request.data.get("comment") or "").strip()[:400]
        rating, created = ChampionRating.objects.update_or_create(
            champion=champ,
            user=request.user,
            defaults={"score": score, "comment": comment},
        )
        impact = compute_champion_impact(champ)
        return Response(
            {
                "created": created,
                "rating": {
                    "score": rating.score,
                    "comment": rating.comment,
                    "updated_at": rating.updated_at.isoformat(),
                },
                "rating_avg": impact["rating_avg"],
                "rating_count": impact["rating_count"],
                "impact_score": impact["impact_score"],
            },
            status=201 if created else 200,
        )


class ChampionApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, champion_id):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"detail": "Staff only"}, status=403)
        champ = CommunityChampion.objects.filter(id=champion_id).first()
        if not champ:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "approve").strip().lower()
        if action == "approve":
            champ.status = "active"
            champ.approved_at = timezone.now()
            champ.approved_by = request.user
            # trained_at + certificate come from completing the Champion training path
            champ.apply_tier_radius()
            champ.save()
            notify_user(
                champ.user,
                "Your Community Champion application was approved. Complete Training to earn your certificate.",
                "champion",
                {"champion_id": champ.id},
            )
        elif action == "suspend":
            champ.status = "suspended"
            champ.save(update_fields=["status", "updated_at"])
        elif action == "reject":
            champ.status = "rejected"
            champ.save(update_fields=["status", "updated_at"])
        elif action == "set_tier":
            tier = (request.data.get("tier") or "").strip().lower()
            if tier not in dict(CommunityChampion.TIER_CHOICES):
                return Response({"detail": "Invalid tier"}, status=400)
            champ.tier = tier
            champ.apply_tier_radius()
            champ.save()
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response({"champion": serialize_champion(champ)})


class ChampionVerifyQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        if champ.latitude is None or champ.longitude is None:
            return Response(
                {"detail": "Set your territory location / check in first.", "results": []}
            )
        lat, lng = float(champ.latitude), float(champ.longitude)
        radius = float(champ.radius_km or 5)
        # Pull recent open disasters and filter by distance
        disasters = Disaster.objects.exclude(
            status__in=("resolved", "contained")
        ).order_by("-start_date")[:200]
        already = set(
            ChampionVerification.objects.filter(champion=champ).values_list(
                "disaster_id", flat=True
            )
        )
        results = []
        for d in disasters:
            if d.id in already:
                continue
            if d.latitude is None or d.longitude is None:
                continue
            dist = haversine_km(lat, lng, d.latitude, d.longitude)
            if dist > radius + float(d.affected_area_radius or 0):
                continue
            results.append(
                {
                    "id": d.id,
                    "title": d.title,
                    "disaster_type": d.disaster_type,
                    "severity": d.severity,
                    "status": d.status,
                    "city": d.city,
                    "region": d.region,
                    "country": d.country,
                    "latitude": float(d.latitude),
                    "longitude": float(d.longitude),
                    "cover_image": d.cover_image,
                    "distance_km": round(dist, 2),
                    "description": (d.description or "")[:280],
                    "start_date": d.start_date.isoformat() if d.start_date else None,
                }
            )
        results.sort(key=lambda x: x["distance_km"])
        return Response({"results": results[:50], "radius_km": radius})


class ChampionVerificationCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        data = request.data or {}
        disaster_id = data.get("disaster_id")
        decision = (data.get("decision") or "").strip().lower()
        if decision not in ("confirm", "deny", "escalate"):
            return Response(
                {"detail": "decision must be confirm, deny, or escalate"},
                status=400,
            )
        disaster = Disaster.objects.filter(id=disaster_id).first()
        if not disaster:
            return Response({"detail": "Disaster not found"}, status=404)
        if ChampionVerification.objects.filter(
            champion=champ, disaster=disaster
        ).exists():
            return Response({"detail": "Already verified this hazard"}, status=400)

        lat = _parse_float(data.get("latitude"))
        lng = _parse_float(data.get("longitude"))
        accuracy = _parse_float(data.get("accuracy_m"))
        distance = None
        if (
            lat is not None
            and lng is not None
            and disaster.latitude is not None
            and disaster.longitude is not None
        ):
            distance = haversine_km(lat, lng, disaster.latitude, disaster.longitude)

        # Presence gate for confirm/deny (escalate allowed remotely)
        if decision in ("confirm", "deny"):
            if lat is None or lng is None:
                return Response(
                    {"detail": "GPS required to confirm or deny on the ground"},
                    status=400,
                )
            max_km = float(champ.radius_km or 5) + float(
                disaster.affected_area_radius or 2
            )
            if distance is not None and distance > max_km:
                return Response(
                    {
                        "detail": f"Too far from hazard ({distance:.1f} km). Escalate instead or move closer.",
                    },
                    status=400,
                )

        evidence = data.get("evidence") if isinstance(data.get("evidence"), list) else []
        score = compute_evidence_score(
            {
                "accuracy_m": accuracy,
                "evidence": evidence,
                "jitsi_room": data.get("jitsi_room"),
                "note": data.get("note"),
                "feed_comparison": data.get("feed_comparison"),
            },
            distance,
        )
        source = (data.get("source_channel") or "app").strip().lower()
        if source not in ("app", "sms", "offline_sync"):
            source = "app"

        verification = ChampionVerification.objects.create(
            champion=champ,
            disaster=disaster,
            decision=decision,
            note=(data.get("note") or "").strip()[:2000],
            feed_comparison=(data.get("feed_comparison") or "").strip()[:20],
            field_signals=data.get("field_signals")
            if isinstance(data.get("field_signals"), dict)
            else {},
            latitude=lat,
            longitude=lng,
            accuracy_m=accuracy,
            distance_km=distance,
            evidence=evidence,
            jitsi_room=(data.get("jitsi_room") or "").strip()[:120],
            evidence_score=score,
            source_channel=source,
            queued_offline_at=timezone.now()
            if source == "offline_sync"
            else None,
            synced_at=timezone.now() if source == "offline_sync" else None,
        )
        CommunityChampion.objects.filter(id=champ.id).update(
            verifications_count=F("verifications_count") + 1
        )

        # Bridge: confirm with enough evidence → investigating/alert
        if decision == "confirm" and score >= 40:
            confirms = ChampionVerification.objects.filter(
                disaster=disaster, decision="confirm"
            ).count()
            trusted = ChampionVerification.objects.filter(
                disaster=disaster,
                decision="confirm",
                champion__tier="trusted",
            ).exists()
            if confirms >= 2 or trusted or score >= 70:
                if disaster.status in ("monitoring", "investigating"):
                    disaster.status = "alert"
                    disaster.save(update_fields=["status", "updated_at"])
            elif disaster.status == "monitoring":
                disaster.status = "investigating"
                disaster.save(update_fields=["status", "updated_at"])
        elif decision == "deny":
            denies = ChampionVerification.objects.filter(
                disaster=disaster, decision="deny"
            ).count()
            if denies >= 2 and disaster.status in ("monitoring", "investigating", "alert"):
                disaster.status = "investigating"
                disaster.save(update_fields=["status", "updated_at"])

        impact = compute_champion_impact(champ)
        return Response(
            {
                "verification": serialize_verification(verification),
                "disaster_status": disaster.status,
                "impact_score": impact["impact_score"],
            },
            status=201,
        )


class ChampionLiveCamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, verification_id=None):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        from .climate_events import new_jitsi_room

        room = new_jitsi_room()
        if verification_id:
            v = ChampionVerification.objects.filter(
                id=verification_id, champion=champ
            ).first()
            if v:
                v.jitsi_room = room
                evidence = list(v.evidence or [])
                evidence.append({"kind": "live_cam", "jitsi_room": room})
                v.evidence = evidence
                v.save(update_fields=["jitsi_room", "evidence", "updated_at"])
        return Response({"jitsi_room": room, "roomName": room})


class ChampionEnrollmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            # pending can view empty
            champ = get_champion(request.user)
            if not champ:
                return err
        rows = champ.enrollments.order_by("-created_at")[:200]
        return Response(
            {
                "results": [
                    {
                        "id": e.id,
                        "name": e.name,
                        "email": e.email,
                        "phone": e.phone,
                        "channel_pref": e.channel_pref,
                        "sms_opt_in": e.sms_opt_in,
                        "push_opt_in": e.push_opt_in,
                        "consent_at": e.consent_at.isoformat() if e.consent_at else None,
                    }
                    for e in rows
                ]
            }
        )

    def post(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        data = request.data or {}
        email = (data.get("email") or "").strip().lower()
        phone = (data.get("phone") or "").strip()
        if not email and not phone:
            return Response({"detail": "email or phone required"}, status=400)
        linked = None
        if email:
            linked = User.objects.filter(email__iexact=email).first()
        enrollment = ChampionEnrollment.objects.create(
            champion=champ,
            user=linked,
            name=(data.get("name") or "").strip()[:120],
            email=email[:254],
            phone=phone[:32],
            channel_pref=(data.get("channel_pref") or "whatsapp")[:20],
            sms_opt_in=bool(data.get("sms_opt_in")),
            push_opt_in=bool(data.get("push_opt_in", True)),
            consent_at=timezone.now(),
        )
        CommunityChampion.objects.filter(id=champ.id).update(
            enrollments_count=F("enrollments_count") + 1
        )
        return Response({"id": enrollment.id}, status=201)


def _passed_modules(champ: CommunityChampion) -> set[str]:
    return set(
        champ.training.filter(passed=True).values_list("module", flat=True)
    )


def _issue_certificate_if_ready(champ: CommunityChampion) -> bool:
    """Issue branded certificate + promote trainee when path complete. Returns issued_now."""
    passed = _passed_modules(champ)
    if len(passed) < len(TRAINING_MODULES):
        return False
    issued_now = False
    if not champ.certificate_code:
        champ.certificate_code = f"CW-CHAMP-{champ.id}-{secrets.token_hex(3).upper()}"
        champ.certificate_issued_at = timezone.now()
        issued_now = True
    if not champ.trained_at:
        champ.trained_at = timezone.now()
    if champ.status == "active" and champ.tier == "trainee":
        champ.tier = "active"
        champ.apply_tier_radius()
    champ.save()
    if issued_now:
        notify_user(
            champ.user,
            f"Certificate earned: Community Champion — {champ.certificate_code}",
            "champion",
            {
                "champion_id": champ.id,
                "certificate_code": champ.certificate_code,
            },
        )
    return issued_now


def _format_champion_territory(champ: CommunityChampion) -> str:
    """Build location line without duplicated country/city fragments."""
    parts = []
    for raw in (champ.ward, champ.city, champ.region, champ.country):
        text = (raw or "").strip()
        if not text:
            continue
        joined = ", ".join(parts).lower()
        key = text.lower()
        if key in joined:
            continue
        # Avoid "Nairobi, Kenya" + "Kenya"
        if parts and any(key == p.lower() or key.endswith(", " + p.lower()) for p in parts):
            continue
        parts.append(text)
    return ", ".join(parts)


def serialize_certificate(champ: CommunityChampion, *, public=False) -> dict | None:
    if not champ.certificate_code:
        return None
    code = champ.certificate_code
    verify_path = f"/verify/champion/{code}"
    data = {
        "certificate_id": code,
        "certificate_code": code,
        "kind": "champion",
        "holder_name": champ.display_name
        or getattr(champ.user, "get_full_name", lambda: "")()
        or getattr(champ.user, "username", ""),
        "program": "Community Champion Certification",
        "issuer": "Climate Wavers",
        "org": "FlowOps Africa",
        "city": "Nairobi, Kenya",
        "tier": champ.tier,
        "affiliation": champ.affiliation or "",
        "ward": champ.ward or "",
        "city_name": champ.city or "",
        "region": champ.region or "",
        "country": champ.country or "",
        "territory": _format_champion_territory(champ),
        "modules_completed": len(TRAINING_MODULES),
        "modules_total": len(TRAINING_MODULES),
        "issued_at": champ.certificate_issued_at.isoformat()
        if champ.certificate_issued_at
        else None,
        "trained_at": champ.trained_at.isoformat() if champ.trained_at else None,
        "verify_path": verify_path,
        "verify_hint": f"Verify at {verify_path}",
        "valid": True,
    }
    if public:
        # Public verify payload — no internal IDs beyond certificate code
        return {
            "valid": True,
            "kind": "champion",
            "certificate_code": code,
            "holder_name": data["holder_name"],
            "program": data["program"],
            "issuer": data["issuer"],
            "org": data["org"],
            "tier": data["tier"],
            "affiliation": data["affiliation"],
            "territory": data["territory"],
            "modules_completed": data["modules_completed"],
            "modules_total": data["modules_total"],
            "issued_at": data["issued_at"],
            "verify_path": verify_path,
        }
    return data


class ChampionTrainingView(APIView):
    """Champion training path: list modules (locked until previous passed)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ = get_champion(request.user)
        if not champ:
            return Response({"detail": "No champion profile"}, status=404)
        passed = _passed_modules(champ)
        progress_map = {
            p.module: p for p in champ.training.all()
        }
        modules = []
        for i, mod in enumerate(CURRICULUM):
            locked = i > 0 and CURRICULUM[i - 1]["id"] not in passed
            completed = mod["id"] in passed
            card = public_module_card(
                mod, completed=completed, locked=locked, index=i
            )
            prog = progress_map.get(mod["id"])
            if prog:
                card["quiz_score"] = prog.quiz_score
                card["attempts"] = prog.attempts
            else:
                card["quiz_score"] = 0
                card["attempts"] = 0
            modules.append(card)
        return Response(
            {
                "style": "champion_path",
                "modules": modules,
                "completed_count": len(passed),
                "total": len(TRAINING_MODULES),
                "certificate": serialize_certificate(champ),
                "path_complete": len(passed) >= len(TRAINING_MODULES),
            }
        )


class ChampionTrainingModuleView(APIView):
    """GET lesson + quiz prompts for one unlocked module."""

    permission_classes = [IsAuthenticated]

    def get(self, request, module_id):
        champ = get_champion(request.user)
        if not champ:
            return Response({"detail": "No champion profile"}, status=404)
        module = module_by_id(module_id)
        if not module:
            return Response({"detail": "Unknown module"}, status=404)
        idx = TRAINING_MODULES.index(module_id)
        passed = _passed_modules(champ)
        if idx > 0 and TRAINING_MODULES[idx - 1] not in passed:
            return Response(
                {"detail": "Complete the previous module quiz first."},
                status=403,
            )
        prog = ChampionTrainingProgress.objects.filter(
            champion=champ, module=module_id
        ).first()
        payload = lesson_payload(module)
        payload["completed"] = bool(prog and prog.passed)
        payload["attempts"] = prog.attempts if prog else 0
        payload["best_score"] = prog.quiz_score if prog else 0
        return Response(payload)


class ChampionTrainingQuizView(APIView):
    """POST answers — must pass to mark module complete."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, module_id):
        champ = get_champion(request.user)
        if not champ:
            return Response({"detail": "No champion profile"}, status=404)
        module = module_by_id(module_id)
        if not module:
            return Response({"detail": "Unknown module"}, status=404)
        idx = TRAINING_MODULES.index(module_id)
        passed_set = _passed_modules(champ)
        if idx > 0 and TRAINING_MODULES[idx - 1] not in passed_set:
            return Response(
                {"detail": "Complete the previous module quiz first."},
                status=403,
            )
        answers = request.data.get("answers") or {}
        if not isinstance(answers, dict):
            return Response({"detail": "answers must be an object"}, status=400)
        result = grade_quiz(module, answers)
        prog, _ = ChampionTrainingProgress.objects.get_or_create(
            champion=champ,
            module=module_id,
            defaults={"passed": False},
        )
        prog.attempts = (prog.attempts or 0) + 1
        if result["score"] >= prog.quiz_score:
            prog.quiz_score = result["score"]
        if result["passed"]:
            prog.passed = True
            if not prog.completed_at:
                prog.completed_at = timezone.now()
        prog.save()

        certificate_issued = False
        if result["passed"]:
            certificate_issued = _issue_certificate_if_ready(champ)
            champ.refresh_from_db()

        return Response(
            {
                "module_id": module_id,
                "result": result,
                "attempts": prog.attempts,
                "module_completed": prog.passed,
                "path_complete": len(_passed_modules(champ)) >= len(TRAINING_MODULES),
                "certificate_issued": certificate_issued,
                "certificate": serialize_certificate(champ),
                "champion": serialize_champion(champ),
            }
        )


class ChampionCertificateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ = get_champion(request.user)
        if not champ:
            return Response({"detail": "No champion profile"}, status=404)
        # Ensure certificate if somehow path done without code
        if len(_passed_modules(champ)) >= len(TRAINING_MODULES):
            _issue_certificate_if_ready(champ)
            champ.refresh_from_db()
        cert = serialize_certificate(champ)
        if not cert:
            return Response(
                {
                    "detail": "Finish all training module quizzes to earn your certificate.",
                    "completed_count": len(_passed_modules(champ)),
                    "total": len(TRAINING_MODULES),
                },
                status=404,
            )
        return Response({"certificate": cert})


class ChampionCertificateVerifyView(APIView):
    """Public lookup — anyone can verify a Community Champion certificate ID."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, code=None):
        raw = (code or request.query_params.get("code") or "").strip().upper()
        if not raw:
            return Response(
                {"valid": False, "detail": "Provide a certificate code."},
                status=400,
            )
        champ = (
            CommunityChampion.objects.filter(certificate_code__iexact=raw)
            .select_related("user")
            .first()
        )
        if not champ or not champ.certificate_code:
            return Response(
                {
                    "valid": False,
                    "detail": "No Community Champion certificate matches that code.",
                    "certificate_code": raw,
                },
                status=404,
            )
        return Response({"certificate": serialize_certificate(champ, public=True)})


class PartnerCameraNearbyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        disaster_id = request.query_params.get("disaster_id")
        lat = lng = None
        if disaster_id:
            d = Disaster.objects.filter(id=disaster_id).first()
            if d and d.latitude is not None:
                lat, lng = float(d.latitude), float(d.longitude)
        if lat is None:
            lat = _parse_float(request.query_params.get("latitude"))
            lng = _parse_float(request.query_params.get("longitude"))
        if lat is None or lng is None:
            if champ.latitude is not None:
                lat, lng = float(champ.latitude), float(champ.longitude)
            else:
                return Response({"results": [], "partner_count": 0, "public_count": 0})
        cams = PartnerCamera.objects.filter(status="active")
        results = []
        for cam in cams:
            dist = haversine_km(lat, lng, cam.latitude, cam.longitude)
            if dist * 1000 <= float(cam.coverage_radius_m or 200) + 3000:
                results.append(
                    {
                        "id": cam.id,
                        "public": False,
                        "source": "partner",
                        "name": cam.name,
                        "latitude": float(cam.latitude),
                        "longitude": float(cam.longitude),
                        "coverage_radius_m": cam.coverage_radius_m,
                        "stream_type": cam.stream_type,
                        "status": cam.status,
                        "distance_km": round(dist, 2),
                        "has_stream": bool(cam.stream_url),
                        "preview_url": cam.stream_url if cam.stream_type in ("hls", "mjpeg") else "",
                    }
                )
        partner_count = len(results)

        # Fallback / supplement: publicly listed OSM webcams near the hazard
        include_public = str(request.query_params.get("include_public") or "1") not in (
            "0",
            "false",
            "no",
        )
        public_count = 0
        if include_public:
            try:
                from .public_cctv import fetch_public_webcams

                radius_m = int(request.query_params.get("public_radius_m") or 15000)
                public_cams = fetch_public_webcams(lat, lng, radius_m=radius_m)
                public_count = len(public_cams)
                # Prefer partner cams first, then public
                results.extend(public_cams)
            except Exception as exc:
                logger.warning("Public CCTV lookup failed: %s", exc)

        results.sort(
            key=lambda x: (
                0 if not x.get("public") else 1,
                not x.get("has_stream"),
                x.get("distance_km") or 999,
            )
        )
        return Response(
            {
                "results": results[:40],
                "partner_count": partner_count,
                "public_count": public_count,
                "public_fallback": partner_count == 0 and public_count > 0,
            }
        )


class PartnerCameraRegisterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        lat = _parse_float(data.get("latitude"))
        lng = _parse_float(data.get("longitude"))
        name = (data.get("name") or "").strip()
        if not name or lat is None or lng is None:
            return Response(
                {"detail": "name, latitude, longitude required"}, status=400
            )
        champ = get_champion(request.user)
        cam = PartnerCamera.objects.create(
            name=name[:200],
            latitude=lat,
            longitude=lng,
            coverage_radius_m=int(data.get("coverage_radius_m") or 200),
            stream_type=(data.get("stream_type") or "hls")[:20],
            stream_url=(data.get("stream_url") or "").strip()[:1000],
            status="pending"
            if not (request.user.is_staff or request.user.is_superuser)
            else "active",
            consent_note=(data.get("consent_note") or "").strip()[:2000],
            retention_days=int(data.get("retention_days") or 14),
            nvr_sync_enabled=bool(data.get("nvr_sync_enabled")),
            champion=champ,
            created_by=request.user,
        )
        return Response(
            {"id": cam.id, "status": cam.status, "name": cam.name},
            status=201,
        )


class PartnerCameraPlaybackTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, camera_id):
        # Public OSM cams use string ids like public-osm-node-123
        cam_key = str(camera_id)
        if cam_key.startswith("public-"):
            from .public_cctv import fetch_public_webcams

            lat = _parse_float(request.data.get("latitude"))
            lng = _parse_float(request.data.get("longitude"))
            champ = get_champion(request.user)
            if lat is None and champ and champ.latitude is not None:
                lat, lng = float(champ.latitude), float(champ.longitude)
            if lat is None or lng is None:
                return Response(
                    {"detail": "latitude/longitude required for public camera playback"},
                    status=400,
                )
            match = next(
                (c for c in fetch_public_webcams(lat, lng) if str(c["id"]) == cam_key),
                None,
            )
            if not match:
                return Response({"detail": "Public camera not found nearby"}, status=404)
            return Response(
                {
                    "camera_id": match["id"],
                    "public": True,
                    "stream_type": match.get("stream_type"),
                    "playback_url": match.get("stream_url") or match.get("preview_url"),
                    "expires_in": 300,
                    "note": match.get("note"),
                }
            )

        cam = PartnerCamera.objects.filter(id=camera_id, status="active").first()
        if not cam:
            return Response({"detail": "Camera not found"}, status=404)
        CameraAccessLog.objects.create(
            camera=cam, user=request.user, action="playback_token"
        )
        return Response(
            {
                "camera_id": cam.id,
                "public": False,
                "stream_type": cam.stream_type,
                "playback_url": cam.stream_url if cam.stream_type == "hls" else cam.stream_url,
                "expires_in": 120,
                "note": "RTSP streams require server-side proxy in production.",
            }
        )


class PartnerCameraRecordMomentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, camera_id):
        data = request.data or {}
        cam_key = str(camera_id)

        # Public webcam: capture reachable public still/stream URL into evidence
        if cam_key.startswith("public-"):
            from .public_cctv import capture_public_snapshot, fetch_public_webcams

            lat = _parse_float(data.get("latitude"))
            lng = _parse_float(data.get("longitude"))
            champ = get_champion(request.user)
            if lat is None and champ and champ.latitude is not None:
                lat, lng = float(champ.latitude), float(champ.longitude)
            if lat is None or lng is None:
                return Response(
                    {"detail": "latitude/longitude required for public capture"},
                    status=400,
                )
            match = next(
                (c for c in fetch_public_webcams(lat, lng) if str(c["id"]) == cam_key),
                None,
            )
            if not match:
                return Response({"detail": "Public camera not found nearby"}, status=404)
            url = match.get("stream_url") or match.get("preview_url") or ""
            if not url:
                return Response(
                    {
                        "detail": "This public camera has no open stream URL in OpenStreetMap."
                    },
                    status=400,
                )
            snap = capture_public_snapshot(url)
            if not snap.get("ok"):
                return Response(
                    {"detail": snap.get("detail") or "Could not fetch public feed"},
                    status=502,
                )
            verification = None
            if data.get("verification_id"):
                verification = ChampionVerification.objects.filter(
                    id=data.get("verification_id")
                ).first()
            evidence_item = {
                "kind": "cctv_snapshot",
                "public": True,
                "source": "openstreetmap",
                "camera_id": cam_key,
                "camera_name": match.get("name"),
                "url": snap["url"],
                "fingerprint": snap.get("fingerprint"),
                "content_type": snap.get("content_type"),
                "captured_at": timezone.now().isoformat(),
            }
            if verification:
                evidence = list(verification.evidence or [])
                evidence.append(evidence_item)
                verification.evidence = evidence
                verification.save(update_fields=["evidence", "updated_at"])
            return Response(
                {
                    "clip_id": None,
                    "public": True,
                    "sync_status": "synced",
                    "storage_url": snap["url"],
                    "evidence": evidence_item,
                    "duration_s": 0,
                },
                status=201,
            )

        cam = PartnerCamera.objects.filter(id=camera_id, status="active").first()
        if not cam:
            return Response({"detail": "Camera not found"}, status=404)
        duration = min(int(data.get("duration_s") or 60), 180)
        disaster = None
        verification = None
        if data.get("disaster_id"):
            disaster = Disaster.objects.filter(id=data.get("disaster_id")).first()
        if data.get("verification_id"):
            verification = ChampionVerification.objects.filter(
                id=data.get("verification_id")
            ).first()
        clip = CameraClip.objects.create(
            camera=cam,
            disaster=disaster,
            verification=verification,
            started_at=timezone.now(),
            duration_s=duration,
            storage_url="",
            sync_status="recording",
            source="snapshot" if data.get("snapshot") else "live_record",
        )
        CameraAccessLog.objects.create(
            camera=cam, user=request.user, action="record"
        )
        clip.sync_status = "synced"
        clip.storage_url = f"/media/camera-clips/{clip.id}.placeholder"
        clip.save(update_fields=["sync_status", "storage_url"])
        if verification:
            evidence = list(verification.evidence or [])
            evidence.append(
                {
                    "kind": "cctv_snapshot" if clip.source == "snapshot" else "cctv_clip",
                    "camera_id": cam.id,
                    "url": clip.storage_url,
                    "clip_id": clip.id,
                }
            )
            verification.evidence = evidence
            verification.save(update_fields=["evidence", "updated_at"])
        return Response(
            {
                "clip_id": clip.id,
                "public": False,
                "sync_status": clip.sync_status,
                "storage_url": clip.storage_url,
                "duration_s": clip.duration_s,
            },
            status=201,
        )


class DevicePushTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        platform = (request.data.get("platform") or "web").strip().lower()
        if not token:
            return Response({"detail": "token required"}, status=400)
        if platform not in ("web", "android", "ios"):
            platform = "web"
        obj, _ = DevicePushToken.objects.update_or_create(
            user=request.user,
            token=token[:512],
            defaults={"platform": platform},
        )
        return Response({"id": obj.id, "platform": obj.platform})


class DeviceLocationPingView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lat = _parse_float(request.data.get("latitude"))
        lng = _parse_float(request.data.get("longitude"))
        if lat is None or lng is None:
            return Response({"detail": "latitude and longitude required"}, status=400)
        opt_in = bool(request.data.get("proximity_alerts_opt_in", True))
        ping = (
            DeviceLocationPing.objects.filter(user=request.user)
            .order_by("-updated_at")
            .first()
        )
        if ping:
            ping.latitude = lat
            ping.longitude = lng
            ping.accuracy_m = _parse_float(request.data.get("accuracy_m"))
            ping.proximity_alerts_opt_in = opt_in
            ping.save()
        else:
            ping = DeviceLocationPing.objects.create(
                user=request.user,
                latitude=lat,
                longitude=lng,
                accuracy_m=_parse_float(request.data.get("accuracy_m")),
                proximity_alerts_opt_in=opt_in,
            )
        return Response({"updated_at": ping.updated_at.isoformat()})


def _devices_in_radius(lat, lng, radius_m, ttl_minutes=90):
    cutoff = timezone.now() - timedelta(minutes=ttl_minutes)
    radius_km = float(radius_m) / 1000.0
    # Latest ping per user (simple approach)
    latest_ids = {}
    for ping in DeviceLocationPing.objects.filter(
        updated_at__gte=cutoff, proximity_alerts_opt_in=True
    ).order_by("-updated_at")[:2000]:
        if ping.user_id not in latest_ids:
            latest_ids[ping.user_id] = ping
    matched = []
    for user_id, ping in latest_ids.items():
        dist = haversine_km(lat, lng, ping.latitude, ping.longitude)
        if dist <= radius_km:
            matched.append((user_id, ping, dist))
    return matched


class WarnNearbyPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        lat = _parse_float(request.query_params.get("latitude"))
        lng = _parse_float(request.query_params.get("longitude"))
        radius_m = int(request.query_params.get("radius_m") or 1000)
        disaster_id = request.query_params.get("disaster_id")
        if (lat is None or lng is None) and disaster_id:
            d = Disaster.objects.filter(id=disaster_id).first()
            if d and d.latitude is not None:
                lat, lng = float(d.latitude), float(d.longitude)
        if lat is None or lng is None:
            if champ.latitude is not None:
                lat, lng = float(champ.latitude), float(champ.longitude)
            else:
                return Response({"detail": "latitude/longitude required"}, status=400)
        max_m = { "trainee": 1000, "active": 3000, "trusted": 5000 }.get(champ.tier, 1000)
        radius_m = min(radius_m, max_m)
        matched = _devices_in_radius(lat, lng, radius_m)
        return Response(
            {
                "count": len(matched),
                "radius_m": radius_m,
                "center": {"latitude": lat, "longitude": lng},
            }
        )


class WarnNearbyCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        champ, err = require_active_champion(request.user)
        if err:
            return err
        data = request.data or {}
        lat = _parse_float(data.get("latitude"))
        lng = _parse_float(data.get("longitude"))
        radius_m = int(data.get("radius_m") or 1000)
        disaster = None
        if data.get("disaster_id"):
            disaster = Disaster.objects.filter(id=data.get("disaster_id")).first()
            if disaster and disaster.latitude is not None and (lat is None or lng is None):
                lat, lng = float(disaster.latitude), float(disaster.longitude)
        if lat is None or lng is None:
            return Response({"detail": "latitude/longitude required"}, status=400)

        # Rate limit
        recent = ProximityBlast.objects.filter(
            champion=champ,
            created_at__gte=timezone.now() - timedelta(minutes=10),
        )
        if disaster:
            recent = recent.filter(disaster=disaster)
        if recent.exists() and not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "Wait before sending another warn nearby for this hazard."},
                status=429,
            )

        max_m = {"trainee": 1000, "active": 3000, "trusted": 5000}.get(champ.tier, 1000)
        radius_m = min(max(radius_m, 200), max_m)
        template = (data.get("message_template") or WARN_TEMPLATES[0]).strip()[:200]
        note = (data.get("note") or "").strip()[:120]

        matched = _devices_in_radius(lat, lng, radius_m)
        # Never alert the champion themselves as only target noise
        matched = [(uid, p, d) for uid, p, d in matched if uid != request.user.id]

        blast = ProximityBlast.objects.create(
            champion=champ,
            disaster=disaster,
            center_lat=lat,
            center_lng=lng,
            radius_m=radius_m,
            message_template=template,
            note=note,
            status="sending",
            targeted_count=len(matched),
        )
        delivered = 0
        for user_id, _ping, _dist in matched:
            user = User.objects.filter(id=user_id).first()
            if not user:
                continue
            ProximityBlastReceipt.objects.create(
                blast=blast,
                user=user,
                push_status="sent",
            )
            notify_user(
                user,
                f"⚠️ {template}" + (f" — {note}" if note else ""),
                "proximity_alert",
                {
                    "blast_id": blast.id,
                    "disaster_id": disaster.id if disaster else None,
                    "radius_m": radius_m,
                    "siren": True,
                },
            )
            delivered += 1

        blast.delivered_count = delivered
        blast.status = "sent"
        blast.save(update_fields=["delivered_count", "status"])
        CommunityChampion.objects.filter(id=champ.id).update(
            proximity_blasts_count=F("proximity_blasts_count") + 1
        )
        return Response(
            {
                "blast_id": blast.id,
                "targeted_count": blast.targeted_count,
                "delivered_count": blast.delivered_count,
                "radius_m": radius_m,
                "status": blast.status,
            },
            status=201,
        )


class WarnNearbyAckView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, blast_id):
        blast = ProximityBlast.objects.filter(id=blast_id).first()
        if not blast:
            return Response({"detail": "Not found"}, status=404)
        receipt = ProximityBlastReceipt.objects.filter(
            blast=blast, user=request.user
        ).first()
        if not receipt:
            receipt = ProximityBlastReceipt.objects.create(
                blast=blast, user=request.user, push_status="opened"
            )
        ack = (request.data.get("ack") or "got_it").strip().lower()
        if ack not in ("got_it", "need_help", "false_alarm"):
            return Response({"detail": "Invalid ack"}, status=400)
        if not receipt.opened_at:
            receipt.opened_at = timezone.now()
            receipt.push_status = "opened"
            ProximityBlast.objects.filter(id=blast.id).update(
                opened_count=F("opened_count") + 1
            )
        if not receipt.ack:
            receipt.ack = ack
            receipt.acked_at = timezone.now()
            ProximityBlast.objects.filter(id=blast.id).update(
                acked_count=F("acked_count") + 1
            )
            if ack == "need_help":
                ProximityBlast.objects.filter(id=blast.id).update(
                    need_help_count=F("need_help_count") + 1
                )
        else:
            receipt.ack = ack
            receipt.acked_at = timezone.now()
        receipt.save()
        return Response({"ack": receipt.ack, "blast_id": blast.id})


class WarnNearbyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, blast_id):
        blast = ProximityBlast.objects.filter(id=blast_id).first()
        if not blast:
            return Response({"detail": "Not found"}, status=404)
        champ = get_champion(request.user)
        if not (
            request.user.is_staff
            or request.user.is_superuser
            or (champ and champ.id == blast.champion_id)
        ):
            return Response({"detail": "Forbidden"}, status=403)
        return Response(
            {
                "id": blast.id,
                "status": blast.status,
                "radius_m": blast.radius_m,
                "message_template": blast.message_template,
                "note": blast.note,
                "targeted_count": blast.targeted_count,
                "delivered_count": blast.delivered_count,
                "opened_count": blast.opened_count,
                "acked_count": blast.acked_count,
                "need_help_count": blast.need_help_count,
                "created_at": blast.created_at.isoformat(),
            }
        )


def user_is_active_champion(user) -> bool:
    return CommunityChampion.objects.filter(user=user, status="active").exists()
