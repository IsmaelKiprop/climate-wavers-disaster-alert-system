"""CBO / school / chapter leaderboards, badges, and seasonal county challenges."""

from __future__ import annotations

import secrets
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ChallengeParticipation,
    GroupImpactBadge,
    SeasonalChallenge,
    SocialGroup,
    SocialGroupMembership,
)


def serialize_badge(b: GroupImpactBadge) -> dict:
    return {
        "id": b.id,
        "badge_type": b.badge_type,
        "label": b.label or b.get_badge_type_display(),
        "challenge_id": b.challenge_id,
        "awarded_at": b.awarded_at.isoformat() if b.awarded_at else None,
    }


def serialize_group(g: SocialGroup, *, include_badges=True) -> dict:
    data = {
        "id": g.id,
        "name": g.name,
        "slug": g.slug,
        "description": g.description or "",
        "cover_image": g.cover_image,
        "group_type": g.group_type,
        "county": g.county or "",
        "ward": g.ward or "",
        "country": g.country or "Kenya",
        "is_verified": g.is_verified,
        "verified_badge": g.verified_badge or "",
        "verified_at": g.verified_at.isoformat() if g.verified_at else None,
        "trees_planted_total": int(g.trees_planted_total or 0),
        "plastic_kg_total": float(g.plastic_kg_total or 0),
        "alerts_verified_total": int(g.alerts_verified_total or 0),
        "member_count": g.memberships.count() if hasattr(g, "memberships") else None,
        "impact_score": round(
            float(g.trees_planted_total or 0)
            + float(g.plastic_kg_total or 0) * 2
            + float(g.alerts_verified_total or 0) * 5,
            2,
        ),
    }
    if include_badges:
        data["badges"] = [
            serialize_badge(b) for b in g.impact_badges.all()[:12]
        ]
    return data


def serialize_challenge(c: SeasonalChallenge) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "slug": c.slug,
        "description": c.description or "",
        "county": c.county or "",
        "country": c.country or "Kenya",
        "metric": c.metric,
        "status": c.status,
        "starts_at": c.starts_at.isoformat() if c.starts_at else None,
        "ends_at": c.ends_at.isoformat() if c.ends_at else None,
        "cover_image": c.cover_image,
    }


def serialize_participation(p: ChallengeParticipation) -> dict:
    return {
        "id": p.id,
        "challenge_id": p.challenge_id,
        "group": serialize_group(p.group, include_badges=False),
        "trees_count": p.trees_count,
        "plastic_kg": float(p.plastic_kg or 0),
        "alerts_count": p.alerts_count,
        "score": float(p.score or 0),
        "rank": p.rank,
        "certificate_id": p.certificate_id or "",
        "certificate_issued_at": (
            p.certificate_issued_at.isoformat() if p.certificate_issued_at else None
        ),
        "joined_at": p.joined_at.isoformat() if p.joined_at else None,
    }


def compute_score(metric: str, trees: int, plastic_kg, alerts: int) -> Decimal:
    t = Decimal(trees or 0)
    p = Decimal(str(plastic_kg or 0))
    a = Decimal(alerts or 0)
    if metric == "trees":
        return t
    if metric == "plastic_kg":
        return p
    if metric == "alerts":
        return a
    return t + (p * Decimal("2")) + (a * Decimal("5"))


def refresh_challenge_ranks(challenge: SeasonalChallenge) -> None:
    rows = list(
        ChallengeParticipation.objects.filter(challenge=challenge)
        .select_related("group")
        .order_by("-score", "joined_at")
    )
    for idx, row in enumerate(rows, start=1):
        if row.rank != idx:
            row.rank = idx
            row.save(update_fields=["rank", "updated_at"])


class GroupLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = SocialGroup.objects.prefetch_related("impact_badges").all()
        county = (request.query_params.get("county") or "").strip()
        group_type = (request.query_params.get("group_type") or "").strip()
        if county:
            qs = qs.filter(county__iexact=county)
        if group_type:
            qs = qs.filter(group_type=group_type)
        rows = list(qs)
        rows.sort(
            key=lambda g: (
                float(g.trees_planted_total or 0)
                + float(g.plastic_kg_total or 0) * 2
                + float(g.alerts_verified_total or 0) * 5
            ),
            reverse=True,
        )
        return Response(
            {
                "results": [serialize_group(g) for g in rows[:100]],
                "count": min(len(rows), 100),
            }
        )


class GroupProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, group_id=None, slug=None):
        g = None
        if group_id:
            g = (
                SocialGroup.objects.prefetch_related("impact_badges", "memberships")
                .filter(pk=group_id)
                .first()
            )
        elif slug:
            g = (
                SocialGroup.objects.prefetch_related("impact_badges", "memberships")
                .filter(slug=slug)
                .first()
            )
        if not g:
            return Response({"detail": "Group not found"}, status=404)
        data = serialize_group(g)
        data["member_count"] = g.memberships.count()
        data["participations"] = [
            serialize_participation(p)
            for p in ChallengeParticipation.objects.filter(group=g)
            .select_related("challenge", "group")
            .order_by("-joined_at")[:20]
        ]
        return Response(data)

    def patch(self, request, group_id=None, slug=None):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=401)
        g = SocialGroup.objects.filter(pk=group_id).first() if group_id else None
        if not g and slug:
            g = SocialGroup.objects.filter(slug=slug).first()
        if not g:
            return Response({"detail": "Not found"}, status=404)
        membership = SocialGroupMembership.objects.filter(
            group=g, user=request.user, role__in=["owner", "admin"]
        ).first()
        if not membership and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=403)
        data = request.data or {}
        for field in ("description", "county", "ward", "country", "cover_image"):
            if field in data:
                setattr(g, field, str(data.get(field) or "")[:500] if field != "description" else str(data.get(field) or ""))
        if "group_type" in data and data["group_type"] in dict(SocialGroup.GROUP_TYPES):
            g.group_type = data["group_type"]
        if request.user.is_staff and "is_verified" in data:
            g.is_verified = bool(data.get("is_verified"))
            if g.is_verified:
                g.verified_badge = str(data.get("verified_badge") or "verified_chapter")[:40]
                g.verified_at = timezone.now()
                GroupImpactBadge.objects.get_or_create(
                    group=g,
                    badge_type="verified_chapter",
                    defaults={
                        "label": "Verified chapter",
                        "awarded_by": request.user,
                    },
                )
        g.save()
        return Response(serialize_group(g))


class SeasonalChallengeListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        qs = SeasonalChallenge.objects.all()
        status_f = (request.query_params.get("status") or "active").strip()
        if status_f and status_f != "all":
            qs = qs.filter(status=status_f)
        county = (request.query_params.get("county") or "").strip()
        if county:
            qs = qs.filter(county__iexact=county)
        return Response(
            {"results": [serialize_challenge(c) for c in qs[:50]], "count": qs.count()}
        )

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"detail": "Staff only"}, status=403)
        title = (request.data.get("title") or "").strip()
        if not title:
            return Response({"detail": "title required"}, status=400)
        base_slug = slugify(title)[:180] or "challenge"
        slug = base_slug
        n = 1
        while SeasonalChallenge.objects.filter(slug=slug).exists():
            n += 1
            slug = f"{base_slug}-{n}"
        try:
            starts = timezone.datetime.fromisoformat(
                str(request.data.get("starts_at")).replace("Z", "+00:00")
            )
            ends = timezone.datetime.fromisoformat(
                str(request.data.get("ends_at")).replace("Z", "+00:00")
            )
            if timezone.is_naive(starts):
                starts = timezone.make_aware(starts)
            if timezone.is_naive(ends):
                ends = timezone.make_aware(ends)
        except Exception:
            return Response({"detail": "starts_at and ends_at ISO datetimes required"}, status=400)
        metric = (request.data.get("metric") or "combined").strip()
        if metric not in dict(SeasonalChallenge.METRIC_CHOICES):
            metric = "combined"
        c = SeasonalChallenge.objects.create(
            title=title[:200],
            slug=slug,
            description=(request.data.get("description") or "").strip(),
            county=(request.data.get("county") or "").strip()[:100],
            country=(request.data.get("country") or "Kenya").strip()[:100],
            metric=metric,
            status=(request.data.get("status") or "active"),
            starts_at=starts,
            ends_at=ends,
            cover_image=(request.data.get("cover_image") or None),
            created_by=request.user,
        )
        return Response(serialize_challenge(c), status=201)


class ChallengeJoinView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, challenge_id):
        challenge = SeasonalChallenge.objects.filter(pk=challenge_id).first()
        if not challenge:
            return Response({"detail": "Not found"}, status=404)
        if challenge.status != "active":
            return Response({"detail": "Challenge is not active"}, status=400)
        group_id = request.data.get("group_id")
        group = SocialGroup.objects.filter(pk=group_id).first()
        if not group:
            return Response({"detail": "group_id required"}, status=400)
        membership = SocialGroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership and not request.user.is_staff:
            return Response({"detail": "Join the group first"}, status=403)
        p, created = ChallengeParticipation.objects.get_or_create(
            challenge=challenge,
            group=group,
            defaults={
                "trees_count": int(group.trees_planted_total or 0),
                "plastic_kg": group.plastic_kg_total or 0,
                "alerts_count": int(group.alerts_verified_total or 0),
                "score": compute_score(
                    challenge.metric,
                    group.trees_planted_total,
                    group.plastic_kg_total,
                    group.alerts_verified_total,
                ),
            },
        )
        if not created:
            p.trees_count = int(group.trees_planted_total or 0)
            p.plastic_kg = group.plastic_kg_total or 0
            p.alerts_count = int(group.alerts_verified_total or 0)
            p.score = compute_score(
                challenge.metric,
                p.trees_count,
                p.plastic_kg,
                p.alerts_count,
            )
            p.save()
        refresh_challenge_ranks(challenge)
        p.refresh_from_db()
        return Response(serialize_participation(p), status=201 if created else 200)


class ChallengeLeaderboardView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, challenge_id):
        challenge = SeasonalChallenge.objects.filter(pk=challenge_id).first()
        if not challenge:
            return Response({"detail": "Not found"}, status=404)
        refresh_challenge_ranks(challenge)
        rows = (
            ChallengeParticipation.objects.filter(challenge=challenge)
            .select_related("group")
            .prefetch_related("group__impact_badges")
            .order_by("rank", "-score")[:100]
        )
        return Response(
            {
                "challenge": serialize_challenge(challenge),
                "results": [serialize_participation(p) for p in rows],
                "count": rows.count() if hasattr(rows, "count") else len(list(rows)),
            }
        )


class ChallengeCertificateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code=None, challenge_id=None, **kwargs):
        code = code or kwargs.get("code") or request.query_params.get("code")
        if not code:
            return Response({"detail": "certificate code required"}, status=400)
        p = (
            ChallengeParticipation.objects.select_related("challenge", "group")
            .filter(certificate_id__iexact=code)
            .first()
        )
        if not p:
            return Response({"detail": "Certificate not found"}, status=404)
        return Response(
            {
                "certificate_id": p.certificate_id,
                "issued_at": p.certificate_issued_at.isoformat()
                if p.certificate_issued_at
                else None,
                "participation": serialize_participation(p),
                "challenge": serialize_challenge(p.challenge),
            }
        )

    def post(self, request, challenge_id=None, code=None, **kwargs):
        """Issue downloadable impact certificates for participants (staff or group admin)."""
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=401)
        challenge_id = challenge_id or kwargs.get("challenge_id")
        challenge = SeasonalChallenge.objects.filter(pk=challenge_id).first()
        if not challenge:
            return Response({"detail": "Not found"}, status=404)
        group_id = request.data.get("group_id")
        p = (
            ChallengeParticipation.objects.select_related("group", "challenge")
            .filter(challenge=challenge, group_id=group_id)
            .first()
        )
        if not p:
            return Response({"detail": "Participation not found"}, status=404)
        is_admin = SocialGroupMembership.objects.filter(
            group_id=group_id, user=request.user, role__in=["owner", "admin"]
        ).exists()
        if not (is_admin or request.user.is_staff):
            return Response({"detail": "Forbidden"}, status=403)
        if not p.certificate_id:
            p.certificate_id = f"CW-CHAL-{secrets.token_hex(4).upper()}"
            p.certificate_issued_at = timezone.now()
            p.save(update_fields=["certificate_id", "certificate_issued_at", "updated_at"])
            if p.rank and p.rank <= 3:
                badge_type = "season_winner"
                GroupImpactBadge.objects.get_or_create(
                    group=p.group,
                    badge_type=badge_type,
                    challenge=challenge,
                    defaults={
                        "label": f"Season #{p.rank} — {challenge.title}"[:120],
                        "awarded_by": request.user,
                    },
                )
        return Response(serialize_participation(p))


class GroupStatsSyncView(APIView):
    """Staff helper to bump group totals (used after verified recoveries / plantings)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        if not request.user.is_staff:
            return Response({"detail": "Staff only"}, status=403)
        g = SocialGroup.objects.filter(pk=group_id).first()
        if not g:
            return Response({"detail": "Not found"}, status=404)
        trees = request.data.get("trees_delta")
        plastic = request.data.get("plastic_kg_delta")
        alerts = request.data.get("alerts_delta")
        if trees is not None:
            g.trees_planted_total = max(0, int(g.trees_planted_total or 0) + int(trees))
        if plastic is not None:
            g.plastic_kg_total = max(
                Decimal("0"),
                Decimal(str(g.plastic_kg_total or 0)) + Decimal(str(plastic)),
            )
        if alerts is not None:
            g.alerts_verified_total = max(
                0, int(g.alerts_verified_total or 0) + int(alerts)
            )
        g.save()
        # Refresh open challenge scores for this group
        for p in ChallengeParticipation.objects.filter(
            group=g, challenge__status="active"
        ).select_related("challenge"):
            p.trees_count = int(g.trees_planted_total or 0)
            p.plastic_kg = g.plastic_kg_total or 0
            p.alerts_count = int(g.alerts_verified_total or 0)
            p.score = compute_score(
                p.challenge.metric, p.trees_count, p.plastic_kg, p.alerts_count
            )
            p.save()
            refresh_challenge_ranks(p.challenge)
        return Response(serialize_group(g))
