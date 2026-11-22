"""Tree gift survival check-ins: 30 / 90 / 180-day geotagged follow-ups."""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.contenttypes.models import ContentType

from .models import (
    Notification,
    TreeProjectDonation,
    TreeProjectUpdate,
    TreeSurvivalCheckIn,
    WaversPointsAccount,
    WaversPointsLedger,
)
from .tree_admin import primary_tree_admin_membership, user_can_manage_tree_project

logger = logging.getLogger(__name__)

MILESTONES = (30, 90, 180)
POINTS_BY_MILESTONE = {30: 15, 90: 25, 180: 40}
STATUS_RANK = {
    "funded": 0,
    "planted": 1,
    "surviving_30": 2,
    "surviving_90": 3,
    "surviving_180": 4,
    "failed": -1,
}


def serialize_checkin(c: TreeSurvivalCheckIn) -> dict:
    return {
        "id": c.id,
        "donation_id": c.donation_id,
        "milestone_days": c.milestone_days,
        "due_at": c.due_at.isoformat() if c.due_at else None,
        "window_ends_at": c.window_ends_at.isoformat() if c.window_ends_at else None,
        "status": c.status,
        "reminder_sent_at": c.reminder_sent_at.isoformat() if c.reminder_sent_at else None,
        "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
        "verified_at": c.verified_at.isoformat() if c.verified_at else None,
        "images": c.images or [],
        "videos": c.videos or [],
        "latitude": float(c.latitude) if c.latitude is not None else None,
        "longitude": float(c.longitude) if c.longitude is not None else None,
        "location_label": c.location_label or "",
        "note": c.note or "",
        "points_awarded": c.points_awarded,
        "client_uuid": str(c.client_uuid) if c.client_uuid else None,
        "project_id": c.donation.project_id if c.donation_id else None,
        "project_name": getattr(getattr(c.donation, "project", None), "name", "") or "",
        "trees_purchased": getattr(c.donation, "trees_purchased", 0) or 0,
    }


def schedule_survival_checkins(donation: TreeProjectDonation) -> list[TreeSurvivalCheckIn]:
    """Create 30/90/180 milestones once a gift is marked planted."""
    if not donation or not donation.planted_at:
        return []
    created = []
    base = donation.planted_at
    for days in MILESTONES:
        due = base + timedelta(days=days)
        obj, was_created = TreeSurvivalCheckIn.objects.get_or_create(
            donation=donation,
            milestone_days=days,
            defaults={
                "due_at": due,
                "window_ends_at": due + timedelta(days=14),
                "status": "scheduled",
            },
        )
        if was_created:
            created.append(obj)
    return created


def _award_survival_points(user, milestone: int, checkin_id: int) -> int:
    if not user:
        return 0
    pts = POINTS_BY_MILESTONE.get(int(milestone), 10)
    try:
        acct, _ = WaversPointsAccount.objects.get_or_create(user=user)
        acct.balance = int(acct.balance or 0) + pts
        acct.lifetime_earned = int(acct.lifetime_earned or 0) + pts
        acct.save(update_fields=["balance", "lifetime_earned", "updated_at"])
        WaversPointsLedger.objects.create(
            user=user,
            delta=pts,
            balance_after=acct.balance,
            reason="adjustment",
            note=f"Tree survival {milestone}d check-in #{checkin_id}",
            donation_id=None,
        )
        return pts
    except Exception as exc:
        logger.warning("Survival points failed: %s", exc)
        return 0


def _bump_donation_survival(donation: TreeProjectDonation, milestone: int, alive: bool):
    if not alive:
        donation.planting_status = "failed"
        donation.save(update_fields=["planting_status"])
        return
    target = {30: "surviving_30", 90: "surviving_90", 180: "surviving_180"}.get(milestone)
    if not target:
        return
    current = donation.planting_status or "planted"
    if STATUS_RANK.get(current, 0) < STATUS_RANK.get(target, 0):
        donation.planting_status = target
        donation.save(update_fields=["planting_status"])


def mark_due_checkins(now=None) -> int:
    now = now or timezone.now()
    qs = TreeSurvivalCheckIn.objects.filter(status="scheduled", due_at__lte=now)
    return qs.update(status="due")


def mark_missed_checkins(now=None) -> int:
    now = now or timezone.now()
    qs = TreeSurvivalCheckIn.objects.filter(
        status__in=["scheduled", "due"],
        window_ends_at__isnull=False,
        window_ends_at__lt=now,
    )
    return qs.update(status="missed")


def send_due_reminders(limit: int = 200) -> int:
    """In-app (+ optional email) reminders for due survival check-ins."""
    now = timezone.now()
    mark_due_checkins(now)
    due = (
        TreeSurvivalCheckIn.objects.select_related(
            "donation", "donation__project", "donation__project__tree_admin_org"
        )
        .filter(status="due", reminder_sent_at__isnull=True)
        .order_by("due_at")[:limit]
    )
    sent = 0
    for checkin in due:
        donation = checkin.donation
        recipients = set()
        if donation.donor_id:
            recipients.add(donation.donor_id)
        org = getattr(donation.project, "tree_admin_org", None)
        if org and org.created_by_id:
            recipients.add(org.created_by_id)
        title = f"Tree survival check-in due ({checkin.milestone_days} days)"
        body = (
            f"Submit a geotagged photo for gift #{donation.id} on "
            f"{getattr(donation.project, 'name', 'your grove')}."
        )
        ct = ContentType.objects.get_for_model(TreeSurvivalCheckIn)
        for uid in recipients:
            try:
                Notification.objects.create(
                    user_id=uid,
                    notification_type="tree",
                    content_type=ct,
                    object_id=checkin.id,
                    message=f"{title}. {body}",
                )
            except Exception as exc:
                logger.debug("Survival notification skipped: %s", exc)
        checkin.reminder_sent_at = now
        checkin.save(update_fields=["reminder_sent_at", "updated_at"])
        sent += 1
    return sent


class TreeSurvivalDueListView(APIView):
    """Tree Admin / planter desk: check-ins that need photos."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        mark_due_checkins()
        m = primary_tree_admin_membership(request.user)
        qs = TreeSurvivalCheckIn.objects.select_related(
            "donation", "donation__project"
        ).filter(status__in=["due", "scheduled", "submitted"])
        if m and m.org_id:
            qs = qs.filter(donation__project__tree_admin_org_id=m.org_id)
        else:
            qs = qs.filter(donation__project__organization=request.user)
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            qs = qs.filter(status=status_filter)
        rows = [serialize_checkin(c) for c in qs.order_by("due_at")[:200]]
        return Response({"results": rows, "count": len(rows)})


class TreeSurvivalSubmitView(APIView):
    """Submit geotagged survival proof (supports offline client_uuid)."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, checkin_id):
        checkin = (
            TreeSurvivalCheckIn.objects.select_related("donation", "donation__project")
            .select_for_update()
            .filter(pk=checkin_id)
            .first()
        )
        if not checkin:
            return Response({"detail": "Check-in not found"}, status=404)
        donation = checkin.donation
        project = donation.project
        if not user_can_manage_tree_project(request.user, project):
            # Donors / giftees can also submit for their own gift
            if request.user.id not in {
                donation.donor_id,
                donation.gifted_to_id,
            }:
                return Response({"detail": "Not allowed"}, status=403)

        if checkin.status in ("verified", "failed"):
            return Response({"detail": "Check-in already closed"}, status=400)

        images = request.data.get("images") or []
        videos = request.data.get("videos") or []
        if not isinstance(images, list):
            images = [images] if images else []
        if not isinstance(videos, list):
            videos = [videos] if videos else []
        images = [str(u).strip() for u in images if str(u or "").strip()]
        videos = [str(u).strip() for u in videos if str(u or "").strip()]
        if not images and not videos:
            return Response(
                {"detail": "Add at least one geotagged photo or video."}, status=400
            )

        try:
            lat = float(request.data.get("latitude"))
            lng = float(request.data.get("longitude"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Pinned GPS latitude/longitude are required."}, status=400
            )

        alive = str(request.data.get("alive", "true")).lower() not in {
            "0",
            "false",
            "no",
            "dead",
        }
        note = (request.data.get("note") or "").strip()
        location_label = (request.data.get("location_label") or "").strip()[:255]
        client_uuid = request.data.get("client_uuid") or None
        was_offline = bool(
            request.data.get("was_offline")
            or request.data.get("offline")
            or request.data.get("queued_offline_at")
        )

        now = timezone.now()
        checkin.images = images[:12]
        checkin.videos = videos[:6]
        checkin.latitude = Decimal(str(round(lat, 6)))
        checkin.longitude = Decimal(str(round(lng, 6)))
        checkin.location_label = location_label
        checkin.note = note
        checkin.submitted_by = request.user
        checkin.submitted_at = now
        checkin.status = "verified" if alive else "failed"
        checkin.verified_at = now
        if client_uuid:
            checkin.client_uuid = client_uuid
        if was_offline:
            checkin.offline_queued_at = now
        pts = 0
        if alive:
            pts = _award_survival_points(request.user, checkin.milestone_days, checkin.id)
            checkin.points_awarded = pts
        checkin.save()

        TreeProjectUpdate.objects.create(
            project=project,
            donation=donation,
            created_by=request.user,
            update_type="survival_checkin",
            title=f"{checkin.milestone_days}-day survival check-in",
            content=note
            or (
                f"{'Alive' if alive else 'Did not survive'} at day "
                f"{checkin.milestone_days}."
            ),
            images=images[:12],
            videos=videos[:6],
            latitude=checkin.latitude,
            longitude=checkin.longitude,
            location_label=location_label,
            trees_planted_this_update=0,
        )

        if donation.survival_lat is None:
            donation.survival_lat = checkin.latitude
            donation.survival_lng = checkin.longitude
            donation.survival_location_label = location_label
            donation.save(
                update_fields=[
                    "survival_lat",
                    "survival_lng",
                    "survival_location_label",
                ]
            )
        _bump_donation_survival(donation, checkin.milestone_days, alive)

        return Response(
            {"ok": True, "checkin": serialize_checkin(checkin), "points_awarded": pts},
            status=201,
        )


class TreeSurvivalPublicMapView(APIView):
    """Public geotagged planted / surviving gifts for the impact map."""

    permission_classes = [AllowAny]

    def get(self, request):
        from .impact_map import CommunityImpactMapView

        county = (request.query_params.get("county") or "").strip()
        features, _skipped = CommunityImpactMapView()._tree_features(county)
        results = []
        for f in features:
            meta = f.get("meta") or {}
            results.append(
                {
                    "type": "tree_gift",
                    "donation_id": meta.get("donation_id"),
                    "project_id": meta.get("project_id"),
                    "project_name": f.get("title") or "",
                    "county": f.get("county") or "",
                    "country": "",
                    "trees": meta.get("trees") or 1,
                    "status": meta.get("status") or "",
                    "planted_at": None,
                    "latitude": f.get("latitude"),
                    "longitude": f.get("longitude"),
                    "location_label": f.get("ward") or "",
                }
            )
        return Response({"results": results, "count": len(results)})
