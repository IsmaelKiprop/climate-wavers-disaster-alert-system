"""Staff-only Platform Admin REST API — replaces day-to-day Django Admin ops."""

from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from django.conf import settings as dj_settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CalendarObservance,
    ClimateEvent,
    Comment,
    CommunityChampion,
    Disaster,
    DisasterAlert,
    NewsletterSubscriber,
    Notification,
    PartnerCamera,
    PlatformAdminInvite,
    Post,
    ResponderOrganization,
    ResponderPlanPayment,
    TreeAdminOrganization,
    TreeProject,
    TreeProjectDonation,
)
from .signals import send_to_websocket
from .tree_admin import approve_tree_admin_org

logger = logging.getLogger(__name__)

User = get_user_model()

MODULES = [
    {"id": "overview", "label": "Overview", "path": "/app/platform-admin"},
    {"id": "users", "label": "Users", "path": "/app/platform-admin/users"},
    {"id": "content", "label": "Content", "path": "/app/platform-admin/content"},
    {"id": "disasters", "label": "Disasters", "path": "/app/platform-admin/disasters"},
    {"id": "trees", "label": "Trees & payments", "path": "/app/platform-admin/trees"},
    {"id": "champions", "label": "Champions", "path": "/app/platform-admin/champions"},
    {"id": "responders", "label": "Responders", "path": "/app/platform-admin/responders"},
    {"id": "calendar", "label": "Calendar", "path": "/app/platform-admin/calendar"},
    {"id": "newsletter", "label": "Newsletter", "path": "/app/platform-admin/newsletter"},
]


class IsPlatformStaff(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(
            u
            and u.is_authenticated
            and (u.is_staff or u.is_superuser)
        )


def _paginate(qs, request, *, default=25):
    try:
        limit = min(max(int(request.query_params.get("limit", default)), 1), 50)
    except (TypeError, ValueError):
        limit = default
    try:
        offset = max(int(request.query_params.get("offset", 0)), 0)
    except (TypeError, ValueError):
        offset = 0
    total = qs.count()
    rows = list(qs[offset : offset + limit])
    return rows, {
        "count": total,
        "limit": limit,
        "offset": offset,
        "next_offset": offset + limit if offset + limit < total else None,
    }


def _badge_counts():
    return {
        "pending_champions": CommunityChampion.objects.filter(status="pending").count(),
        "pending_tree_orgs": TreeAdminOrganization.objects.filter(
            verification_status="pending"
        ).count(),
        "pending_responder_orgs": ResponderOrganization.objects.filter(
            verification_status="pending"
        ).count(),
        "pending_cameras": PartnerCamera.objects.filter(status="pending").count(),
        "unverified_projects": TreeProject.objects.filter(is_verified=False).count(),
        "pending_donation_posts": Post.objects.filter(
            is_donation=True, donation_approved=False
        ).count(),
        "open_disasters": Disaster.objects.exclude(
            status__in=["resolved", "contained"]
        ).count(),
        "pending_admin_invites": PlatformAdminInvite.objects.filter(
            status="pending"
        ).count(),
    }


def _frontend_base() -> str:
    return str(
        getattr(dj_settings, "FRONTEND_URL", None)
        or getattr(dj_settings, "SITE_URL", None)
        or "https://alerts.flowops.africa"
    ).rstrip("/")


def _notify_platform(user, message: str, content=None):
    if not user:
        return
    notice = Notification.objects.create(
        user=user,
        notification_type="platform_admin",
        message=message,
    )
    try:
        send_to_websocket(
            notice.id,
            user.username,
            message,
            user,
            "platform_admin",
            content=content or {},
        )
    except Exception:
        pass


def _send_admin_invite_email(*, to_email: str, invite_url: str, invited_by_name: str):
    email = str(to_email or "").strip().lower()
    if not email or "@" not in email or email.endswith("@example.com"):
        return False
    subject = "You're invited to Climate Wavers Platform Admin"
    body = (
        f"{invited_by_name} invited you to become a Platform Admin on Climate Wavers.\n\n"
        f"Accept the invite (sign in with this email first if needed):\n"
        f"{invite_url}\n\n"
        f"This link expires in 7 days."
    )
    try:
        from api.tasks import _send_resend

        _send_resend(
            "custom_mail",
            {
                "email": email,
                "data": {
                    "subject": subject,
                    "headline": "You're invited to Platform Admin.",
                    "content": body,
                    "cta_text": "Accept invite",
                    "cta_url": invite_url,
                    "link": invite_url,
                    "reply_hint": (
                        "Prefer some help getting set up? Reply to this email "
                        "and we'll walk you through it."
                    ),
                },
            },
        )
        return True
    except Exception:
        logger.exception("Failed to send platform admin invite email to %s", email)
        return False


def serialize_admin_invite(inv: PlatformAdminInvite):
    return {
        "id": inv.id,
        "email": inv.email,
        "status": inv.status,
        "note": inv.note or "",
        "invited_by": getattr(inv.invited_by, "email", None) or getattr(inv.invited_by, "username", ""),
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "accepted_at": inv.accepted_at.isoformat() if inv.accepted_at else None,
        "accept_path": f"/app/platform-admin/accept-invite?token={inv.token}",
        "is_expired": inv.status == "pending" and inv.is_expired,
    }


def serialize_user(u, *, detail=False):
    data = {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "first_name": u.first_name or "",
        "last_name": u.last_name or "",
        "is_active": u.is_active,
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "is_verified": bool(getattr(u, "is_verified", False)),
        "country": getattr(u, "country", None) or "",
        "state": getattr(u, "state", None) or "",
        "date_joined": u.date_joined.isoformat() if u.date_joined else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }
    if detail:
        data.update(
            {
                "phone": getattr(u, "phone", None) or "",
                "bio": getattr(u, "bio", None) or "",
                "profession": getattr(u, "profession", None) or "",
            }
        )
    return data


def serialize_post(p):
    return {
        "id": p.id,
        "user_id": p.user_id,
        "username": getattr(p.user, "username", ""),
        "content": (p.content or "")[:280],
        "visibility": p.visibility,
        "is_donation": p.is_donation,
        "donation_approved": p.donation_approved,
        "hidden": p.visibility != "Everyone",
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def serialize_comment(c):
    return {
        "id": c.id,
        "user_id": c.user_id,
        "username": getattr(c.user, "username", ""),
        "post_id": c.post_id,
        "content": (c.content or "")[:280],
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def serialize_disaster(d):
    return {
        "id": d.id,
        "title": d.title,
        "disaster_type": d.disaster_type,
        "severity": d.severity,
        "status": d.status,
        "country": d.country,
        "region": d.region,
        "city": d.city or "",
        "is_verified": d.is_verified,
        "start_date": d.start_date.isoformat() if d.start_date else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def serialize_champion(c):
    training_passed = c.training.filter(passed=True).count()
    u = c.user
    return {
        "id": c.id,
        "display_name": c.display_name or getattr(u, "username", ""),
        "user_id": c.user_id,
        "email": getattr(u, "email", "") or "",
        "username": getattr(u, "username", "") or "",
        "user_phone": getattr(u, "phone", None) or "",
        "status": c.status,
        "tier": c.tier,
        "bio": c.bio or "",
        "phone": c.phone or "",
        "affiliation": c.affiliation or "",
        "languages": c.languages or "",
        "country": c.country or "",
        "region": c.region or "",
        "city": c.city or "",
        "ward": c.ward or "",
        "latitude": float(c.latitude) if c.latitude is not None else None,
        "longitude": float(c.longitude) if c.longitude is not None else None,
        "radius_km": c.radius_km,
        "relay_nodes": c.relay_nodes or [],
        "sponsor_name": c.sponsor_name or "",
        "impact_score": c.impact_score or 0,
        "rating_avg": float(c.rating_avg or 0),
        "rating_count": c.rating_count or 0,
        "verifications_count": c.verifications_count or 0,
        "enrollments_count": c.enrollments_count or 0,
        "proximity_blasts_count": c.proximity_blasts_count or 0,
        "certificate_code": c.certificate_code or "",
        "certificate_issued_at": c.certificate_issued_at.isoformat()
        if c.certificate_issued_at
        else None,
        "training_passed": training_passed,
        "trained_at": c.trained_at.isoformat() if c.trained_at else None,
        "approved_at": c.approved_at.isoformat() if c.approved_at else None,
        "last_check_in_at": c.last_check_in_at.isoformat() if c.last_check_in_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def serialize_camera(cam):
    champ = cam.champion
    return {
        "id": cam.id,
        "name": cam.name,
        "status": cam.status,
        "latitude": float(cam.latitude) if cam.latitude is not None else None,
        "longitude": float(cam.longitude) if cam.longitude is not None else None,
        "coverage_radius_m": cam.coverage_radius_m,
        "stream_type": cam.stream_type,
        "stream_url": cam.stream_url or "",
        "consent_note": cam.consent_note or "",
        "retention_days": cam.retention_days,
        "nvr_sync_enabled": bool(cam.nvr_sync_enabled),
        "champion_id": cam.champion_id,
        "champion_name": (champ.display_name if champ else "")
        or (getattr(champ.user, "email", "") if champ else ""),
        "responder_org_id": cam.responder_org_id,
        "responder_org_name": getattr(cam.responder_org, "name", "") if cam.responder_org_id else "",
        "created_by_id": cam.created_by_id,
        "created_by_email": getattr(cam.created_by, "email", "") if cam.created_by_id else "",
        "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
        "created_at": cam.created_at.isoformat() if cam.created_at else None,
        "updated_at": cam.updated_at.isoformat() if cam.updated_at else None,
    }


def serialize_tree_project(p):
    return {
        "id": p.id,
        "name": p.name,
        "city": p.city or "",
        "country": p.country or "",
        "description": (p.short_description or "")[:400]
        if getattr(p, "short_description", None)
        else ((p.description or "")[:400] if getattr(p, "description", None) else ""),
        "project_type": getattr(p, "project_type", "") or "",
        "status": getattr(p, "status", "") or "",
        "organization_name": getattr(p, "organization_name", "") or "",
        "organization_website": getattr(p, "organization_website", "") or "",
        "latitude": float(p.latitude) if getattr(p, "latitude", None) is not None else None,
        "longitude": float(p.longitude) if getattr(p, "longitude", None) is not None else None,
        "is_verified": p.is_verified,
        "is_active": getattr(p, "is_active", True),
        "target_trees": getattr(p, "target_trees", None),
        "trees_planted": getattr(p, "trees_planted", None),
        "contact_person": getattr(p, "contact_person", "") or "",
        "contact_email": getattr(p, "contact_email", "") or "",
        "contact_phone": getattr(p, "contact_phone", "") or "",
        "start_date": p.start_date.isoformat() if getattr(p, "start_date", None) else None,
        "expected_completion": p.expected_completion.isoformat()
        if getattr(p, "expected_completion", None)
        else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def serialize_donation(d):
    from .tree_certificate import serialize_donation_rich

    return serialize_donation_rich(d)


def _user_display_name(u):
    if not u:
        return ""
    try:
        full = (u.get_full_name() or "").strip()
    except Exception:
        full = ""
    if full:
        return full
    return " ".join(filter(None, [u.first_name, u.last_name])).strip()


def serialize_tree_org(o):
    owner = None
    memberships = list(
        o.memberships.select_related("user").order_by("created_at")[:12]
    )
    for m in memberships:
        if m.role == "owner" and m.user_id:
            u = m.user
            owner = {
                "id": u.id,
                "email": u.email or "",
                "username": u.username or "",
                "name": _user_display_name(u),
                "phone": getattr(u, "phone", None) or "",
            }
            break
    if owner is None and o.created_by_id:
        u = o.created_by
        owner = {
            "id": u.id,
            "email": u.email or "",
            "username": u.username or "",
            "name": _user_display_name(u),
            "phone": getattr(u, "phone", None) or "",
        }
    return {
        "id": o.id,
        "name": o.name,
        "org_type": o.org_type,
        "website": o.website or "",
        "city": o.city or "",
        "country": o.country or "",
        "contact_email": o.contact_email or "",
        "contact_phone": o.contact_phone or "",
        "planting_sites_note": o.planting_sites_note or "",
        "verification_status": o.verification_status,
        "verified_at": o.verified_at.isoformat() if o.verified_at else None,
        "plan": o.plan,
        "plan_status": o.plan_status,
        "plan_started_at": o.plan_started_at.isoformat() if o.plan_started_at else None,
        "plan_ends_at": o.plan_ends_at.isoformat() if o.plan_ends_at else None,
        "seats_used": o.memberships.count(),
        "owner": owner,
        "members": [
            {
                "role": m.role,
                "email": getattr(m.user, "email", "") or "",
                "username": getattr(m.user, "username", "") or "",
            }
            for m in memberships
            if m.user_id
        ],
        "created_by_id": o.created_by_id,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def serialize_responder_org(o):
    owner = None
    memberships = list(
        o.memberships.select_related("user").order_by("created_at")[:12]
    )
    for m in memberships:
        if m.role == "owner" and m.user_id:
            u = m.user
            owner = {
                "id": u.id,
                "email": u.email or "",
                "username": u.username or "",
                "name": _user_display_name(u),
                "phone": getattr(u, "phone", None) or "",
            }
            break
    if owner is None and o.created_by_id:
        u = o.created_by
        owner = {
            "id": u.id,
            "email": u.email or "",
            "username": u.username or "",
            "name": _user_display_name(u),
            "phone": getattr(u, "phone", None) or "",
        }
    return {
        "id": o.id,
        "name": o.name,
        "org_type": o.org_type,
        "logo": o.logo or "",
        "website": o.website or "",
        "city": o.city or "",
        "country": o.country or "",
        "latitude": float(o.latitude) if o.latitude is not None else None,
        "longitude": float(o.longitude) if o.longitude is not None else None,
        "coverage_radius_km": o.coverage_radius_km,
        "disaster_types": o.disaster_types or [],
        "contact_email": o.contact_email or "",
        "contact_phone": o.contact_phone or "",
        "whatsapp_opt_in": bool(o.whatsapp_opt_in),
        "verification_status": o.verification_status,
        "verified_at": o.verified_at.isoformat() if o.verified_at else None,
        "plan": o.plan,
        "plan_status": o.plan_status,
        "plan_started_at": o.plan_started_at.isoformat() if o.plan_started_at else None,
        "plan_ends_at": o.plan_ends_at.isoformat() if o.plan_ends_at else None,
        "max_seats": o.max_seats,
        "seats_used": o.memberships.count(),
        "owner": owner,
        "members": [
            {
                "role": m.role,
                "email": getattr(m.user, "email", "") or "",
                "username": getattr(m.user, "username", "") or "",
            }
            for m in memberships
            if m.user_id
        ],
        "created_by_id": o.created_by_id,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def serialize_payment(p):
    return {
        "id": p.id,
        "org_id": p.org_id,
        "org_name": getattr(p.org, "name", "") if p.org_id else "",
        "plan": p.plan,
        "months": p.months,
        "amount": float(p.amount) if p.amount is not None else 0,
        "currency": p.currency,
        "payment_status": p.payment_status,
        "payment_reference": p.payment_reference or "",
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def serialize_event(e):
    return {
        "id": e.id,
        "title": e.title,
        "event_type": getattr(e, "event_type", "") or "",
        "status": e.status,
        "visibility": getattr(e, "visibility", "") or "",
        "starts_at": e.starts_at.isoformat() if getattr(e, "starts_at", None) else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def serialize_observance(o):
    return {
        "id": o.id,
        "title": o.title,
        "month": o.month,
        "day": o.day,
        "category": o.category,
        "is_active": o.is_active,
    }


def serialize_newsletter(s):
    return {
        "id": s.id,
        "email": s.email,
        "source": s.source or "",
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


class PlatformAdminMeView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        counts = _badge_counts()
        return Response(
            {
                "is_platform_admin": True,
                "is_superuser": request.user.is_superuser,
                "user": serialize_user(request.user),
                "modules": MODULES,
                "counts": counts,
            }
        )


class PlatformAdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        counts = _badge_counts()
        failed_payments = ResponderPlanPayment.objects.filter(
            payment_status__in=["failed", "abandoned", "pending"]
        ).count()
        return Response(
            {
                "kpis": {
                    "users_total": User.objects.count(),
                    "users_active": User.objects.filter(is_active=True).count(),
                    "pending_champions": counts["pending_champions"],
                    "pending_tree_orgs": counts["pending_tree_orgs"],
                    "pending_responder_orgs": counts["pending_responder_orgs"],
                    "open_disasters": counts["open_disasters"],
                    "unverified_projects": counts["unverified_projects"],
                    "pending_cameras": counts["pending_cameras"],
                    "pending_donation_posts": counts["pending_donation_posts"],
                    "attention_payments": failed_payments,
                },
                "counts": counts,
            }
        )


class PlatformAdminUsersView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = User.objects.all().order_by("-date_joined")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
        status = (request.query_params.get("status") or "").strip().lower()
        if status == "active":
            qs = qs.filter(is_active=True)
        elif status == "inactive":
            qs = qs.filter(is_active=False)
        elif status == "staff":
            qs = qs.filter(is_staff=True)
        elif status == "unverified":
            qs = qs.filter(is_verified=False)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_user(u) for u in rows], **page})


class PlatformAdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request, user_id):
        u = User.objects.filter(id=user_id).first()
        if not u:
            return Response({"detail": "Not found"}, status=404)
        return Response({"user": serialize_user(u, detail=True)})


class PlatformAdminUserModerateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, user_id):
        u = User.objects.filter(id=user_id).first()
        if not u:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "").strip().lower()
        if action == "verify_email":
            u.is_verified = True
            u.save(update_fields=["is_verified"])
        elif action == "set_active":
            u.is_active = bool(request.data.get("value", True))
            u.save(update_fields=["is_active"])
        elif action == "set_staff":
            if not request.user.is_superuser:
                return Response({"detail": "Superuser only"}, status=403)
            if u.id == request.user.id:
                return Response({"detail": "Cannot change your own staff flag"}, status=400)
            u.is_staff = bool(request.data.get("value", False))
            u.save(update_fields=["is_staff"])
        elif action == "set_email":
            new_email = str(request.data.get("value") or "").strip().lower()
            if not new_email or "@" not in new_email:
                return Response({"detail": "A valid email is required"}, status=400)
            taken = (
                User.objects.filter(email__iexact=new_email).exclude(id=u.id).exists()
            )
            if taken:
                return Response(
                    {"detail": "That email is already used by another account"},
                    status=400,
                )
            with transaction.atomic():
                u.email = new_email
                u.is_verified = True
                u.save(update_fields=["email", "is_verified"])
                # Keep owned org contact emails in sync for alerts / desk.
                ResponderOrganization.objects.filter(
                    memberships__user=u, memberships__role="owner"
                ).update(contact_email=new_email)
                TreeAdminOrganization.objects.filter(
                    memberships__user=u, memberships__role="owner"
                ).update(contact_email=new_email)
        elif action == "delete":
            if u.id == request.user.id:
                return Response({"detail": "Cannot delete your own account"}, status=400)
            if u.is_superuser and not request.user.is_superuser:
                return Response(
                    {"detail": "Only a superuser can delete another superuser"},
                    status=403,
                )
            email = u.email
            with transaction.atomic():
                u.delete()
            return Response({"deleted": True, "email": email})
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response({"user": serialize_user(u, detail=True)})


class PlatformAdminPostsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = Post.objects.select_related("user").order_by("-created_at")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(content__icontains=q) | Q(user__username__icontains=q))
        if request.query_params.get("donation") == "1":
            qs = qs.filter(is_donation=True)
        if request.query_params.get("pending_donation") == "1":
            qs = qs.filter(is_donation=True, donation_approved=False)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_post(p) for p in rows], **page})


class PlatformAdminPostModerateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, post_id):
        p = Post.objects.select_related("user").filter(id=post_id).first()
        if not p:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "").strip().lower()
        if action == "hide":
            p.visibility = "Friends"
            p.save(update_fields=["visibility", "updated_at"])
        elif action == "restore":
            p.visibility = "Everyone"
            p.save(update_fields=["visibility", "updated_at"])
        elif action == "approve_donation":
            p.is_donation = True
            p.donation_approved = True
            p.save(update_fields=["is_donation", "donation_approved", "updated_at"])
        elif action == "delete":
            p.delete()
            return Response({"deleted": True})
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response({"post": serialize_post(p)})


class PlatformAdminCommentsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = Comment.objects.select_related("user").order_by("-created_at")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(content__icontains=q) | Q(user__username__icontains=q))
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_comment(c) for c in rows], **page})


class PlatformAdminCommentModerateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, comment_id):
        c = Comment.objects.filter(id=comment_id).first()
        if not c:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "").strip().lower()
        if action in ("hide", "delete"):
            c.delete()
            return Response({"deleted": True})
        return Response({"detail": "Unknown action"}, status=400)


class PlatformAdminDisastersView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = Disaster.objects.all().order_by("-created_at")
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(status=status)
        severity = (request.query_params.get("severity") or "").strip()
        if severity:
            qs = qs.filter(severity=severity)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(city__icontains=q) | Q(country__icontains=q)
            )
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_disaster(d) for d in rows], **page})

    def post(self, request):
        data = request.data or {}
        title = (data.get("title") or "").strip()
        if not title:
            return Response({"detail": "title required"}, status=400)
        d = Disaster.objects.create(
            title=title,
            description=(data.get("description") or title).strip(),
            disaster_type=(data.get("disaster_type") or "other").strip(),
            severity=(data.get("severity") or "moderate").strip(),
            status=(data.get("status") or "monitoring").strip(),
            country=(data.get("country") or "Kenya").strip(),
            region=(data.get("region") or "").strip() or (data.get("city") or "Unknown"),
            city=(data.get("city") or "").strip() or None,
            start_date=timezone.now(),
            is_verified=True,
            verified_by=request.user,
        )
        return Response({"disaster": serialize_disaster(d)}, status=201)


class PlatformAdminDisasterDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def patch(self, request, disaster_id):
        d = Disaster.objects.filter(id=disaster_id).first()
        if not d:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        for field in ("title", "description", "disaster_type", "severity", "status", "country", "region", "city"):
            if field in data and data[field] is not None:
                setattr(d, field, str(data[field]).strip())
        if "is_verified" in data:
            d.is_verified = bool(data["is_verified"])
            if d.is_verified:
                d.verified_by = request.user
        d.save()
        return Response({"disaster": serialize_disaster(d)})


class PlatformAdminDisasterAlertView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, disaster_id):
        d = Disaster.objects.filter(id=disaster_id).first()
        if not d:
            return Response({"detail": "Not found"}, status=404)
        data = request.data or {}
        title = (data.get("title") or f"Alert: {d.title}").strip()
        message = (data.get("message") or d.description or title).strip()
        alert = DisasterAlert.objects.create(
            disaster=d,
            title=title,
            message=message,
            alert_type=(data.get("alert_type") or "alert").strip(),
            priority=(data.get("priority") or "medium").strip(),
            target_country=d.country,
            target_region=d.region,
            target_city=d.city,
            created_by=request.user,
            is_active=True,
        )
        return Response(
            {
                "alert": {
                    "id": alert.id,
                    "title": alert.title,
                    "alert_type": alert.alert_type,
                    "priority": alert.priority,
                    "is_active": alert.is_active,
                }
            },
            status=201,
        )


class PlatformAdminTreeProjectsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = TreeProject.objects.all().order_by("-created_at")
        if request.query_params.get("unverified") == "1":
            qs = qs.filter(is_verified=False)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q))
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_tree_project(p) for p in rows], **page})


class PlatformAdminTreeProjectVerifyView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, project_id):
        p = TreeProject.objects.filter(id=project_id).first()
        if not p:
            return Response({"detail": "Not found"}, status=404)
        p.is_verified = True
        p.verified_by = request.user
        p.save(update_fields=["is_verified", "verified_by"])
        return Response({"project": serialize_tree_project(p)})


class PlatformAdminTreeDonationsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = TreeProjectDonation.objects.select_related(
            "project", "donor", "gifted_to"
        ).order_by("-created_at")
        status = (request.query_params.get("payment_status") or "").strip()
        if status:
            qs = qs.filter(payment_status=status)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_donation(d) for d in rows], **page})


class PlatformAdminTreeDonationCertificateView(APIView):
    """Issue / re-email a branded tree certificate (staff)."""

    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, donation_id):
        from .tree_certificate import issue_and_email_certificate, render_certificate_png

        donation = (
            TreeProjectDonation.objects.select_related("project", "donor", "gifted_to")
            .filter(id=donation_id)
            .first()
        )
        if not donation:
            return Response({"detail": "Not found"}, status=404)
        force = bool(request.data.get("resend") or request.data.get("force"))
        result = issue_and_email_certificate(donation, force_resend=force)
        donation.refresh_from_db()
        include_png = bool(request.data.get("include_png"))
        payload = {
            "donation": serialize_donation(donation),
            "issued": result.get("issued"),
            "emailed": result.get("emailed"),
            "certificate_id": result.get("certificate_id") or donation.certificate_id,
        }
        if include_png:
            import base64

            payload["png_base64"] = base64.b64encode(
                render_certificate_png(donation)
            ).decode("ascii")
        return Response(payload)


class PlatformAdminTreeOrgsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = (
            TreeAdminOrganization.objects.all()
            .select_related("created_by")
            .prefetch_related("memberships__user")
            .order_by("-created_at")
        )
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(verification_status=status)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_tree_org(o) for o in rows], **page})


class PlatformAdminTreeOrgModerateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, org_id):
        org = TreeAdminOrganization.objects.filter(id=org_id).first()
        if not org:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "").strip().lower()
        if action == "approve":
            approve_tree_admin_org(org)
            org.refresh_from_db()
        elif action == "reject":
            org.verification_status = "rejected"
            org.verified_at = None
            org.plan_status = "pending"
            org.save()
        elif action == "activate_plan":
            if org.verification_status != "approved":
                return Response({"detail": "Approve first"}, status=400)
            from .tree_pricing import activate_paid_plan

            activate_paid_plan(org)
            org.save()
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response({"org": serialize_tree_org(org)})


class PlatformAdminResponderPaymentsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = ResponderPlanPayment.objects.select_related("org").order_by("-created_at")
        status = (request.query_params.get("payment_status") or "").strip()
        if status:
            qs = qs.filter(payment_status=status)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_payment(p) for p in rows], **page})


class PlatformAdminChampionsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = CommunityChampion.objects.select_related("user").order_by("-created_at")
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(status=status)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(display_name__icontains=q)
                | Q(user__email__icontains=q)
                | Q(city__icontains=q)
                | Q(certificate_code__icontains=q)
            )
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_champion(c) for c in rows], **page})


class PlatformAdminChampionModerateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, champion_id):
        champ = CommunityChampion.objects.select_related("user").filter(id=champion_id).first()
        if not champ:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "").strip().lower()
        if action == "approve":
            champ.status = "active"
            champ.approved_at = timezone.now()
            champ.approved_by = request.user
            champ.apply_tier_radius()
            champ.save()
        elif action == "suspend":
            champ.status = "suspended"
            champ.save(update_fields=["status", "updated_at"])
        elif action == "reject":
            champ.status = "rejected"
            champ.save(update_fields=["status", "updated_at"])
        elif action == "set_tier":
            tier = (request.data.get("tier") or "").strip().lower()
            allowed = {c[0] for c in CommunityChampion.TIER_CHOICES}
            if tier not in allowed:
                return Response({"detail": "Invalid tier"}, status=400)
            champ.tier = tier
            champ.apply_tier_radius()
            champ.save()
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response({"champion": serialize_champion(champ)})


class PlatformAdminCamerasView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = (
            PartnerCamera.objects.all()
            .select_related("champion__user", "responder_org", "created_by")
            .order_by("-created_at")
        )
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(status=status)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_camera(c) for c in rows], **page})


class PlatformAdminCameraActivateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, camera_id):
        cam = PartnerCamera.objects.filter(id=camera_id).first()
        if not cam:
            return Response({"detail": "Not found"}, status=404)
        cam.status = "active"
        cam.save(update_fields=["status"])
        return Response({"camera": serialize_camera(cam)})


class PlatformAdminRespondersView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = (
            ResponderOrganization.objects.all()
            .select_related("created_by")
            .prefetch_related("memberships__user")
            .order_by("-created_at")
        )
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(verification_status=status)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q) | Q(contact_email__icontains=q))
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_responder_org(o) for o in rows], **page})


class PlatformAdminResponderModerateView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, org_id):
        org = ResponderOrganization.objects.filter(id=org_id).first()
        if not org:
            return Response({"detail": "Not found"}, status=404)
        action = (request.data.get("action") or "").strip().lower()
        if action in ("approve", "approve_pilot"):
            from .pricing import start_pilot

            org.verification_status = "approved"
            org.verified_at = timezone.now()
            start_pilot(org)
            org.save()
        elif action == "reject":
            org.verification_status = "rejected"
            org.verified_at = None
            org.plan_status = "pending"
            org.save()
        elif action == "activate_plan":
            if org.verification_status != "approved":
                return Response({"detail": "Approve first"}, status=400)
            from .pricing import activate_paid_plan

            activate_paid_plan(org)
            org.save()
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response({"org": serialize_responder_org(org)})


class PlatformAdminEventsView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = ClimateEvent.objects.all().order_by("-created_at")
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(status=status)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_event(e) for e in rows], **page})

    def patch(self, request):
        """Bulk-style single event patch via ?id= or body.id"""
        eid = request.data.get("id") or request.query_params.get("id")
        e = ClimateEvent.objects.filter(id=eid).first()
        if not e:
            return Response({"detail": "Not found"}, status=404)
        if "status" in request.data:
            e.status = str(request.data["status"]).strip()
            e.save(update_fields=["status"])
        return Response({"event": serialize_event(e)})


class PlatformAdminEventStatusView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def patch(self, request, event_id):
        e = ClimateEvent.objects.filter(id=event_id).first()
        if not e:
            return Response({"detail": "Not found"}, status=404)
        if "status" in (request.data or {}):
            e.status = str(request.data["status"]).strip()
            e.save(update_fields=["status"])
        return Response({"event": serialize_event(e)})


class PlatformAdminObservancesView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = CalendarObservance.objects.all().order_by("month", "day")
        rows, page = _paginate(qs, request, default=50)
        return Response({"results": [serialize_observance(o) for o in rows], **page})

    def patch(self, request):
        oid = request.data.get("id")
        o = CalendarObservance.objects.filter(id=oid).first()
        if not o:
            return Response({"detail": "Not found"}, status=404)
        if "is_active" in request.data:
            o.is_active = bool(request.data["is_active"])
            o.save(update_fields=["is_active"])
        return Response({"observance": serialize_observance(o)})


class PlatformAdminNewsletterView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = NewsletterSubscriber.objects.all().order_by("-created_at")
        if request.query_params.get("active") == "1":
            qs = qs.filter(is_active=True)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(email__icontains=q)
        rows, page = _paginate(qs, request)
        return Response({"results": [serialize_newsletter(s) for s in rows], **page})


class PlatformAdminInvitesView(APIView):
    """List + create Platform Admin invites."""

    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def get(self, request):
        qs = PlatformAdminInvite.objects.select_related("invited_by").order_by(
            "-created_at"
        )
        status = (request.query_params.get("status") or "").strip()
        if status:
            qs = qs.filter(status=status)
        rows, page = _paginate(qs, request)
        return Response(
            {"results": [serialize_admin_invite(i) for i in rows], **page}
        )

    @transaction.atomic
    def post(self, request):
        email = str(request.data.get("email") or "").strip().lower()
        note = str(request.data.get("note") or "").strip()[:255]
        grant_now = bool(request.data.get("grant_now"))
        if not email or "@" not in email:
            return Response({"detail": "Valid email required"}, status=400)

        existing = User.objects.filter(email__iexact=email).first()
        if existing and (existing.is_staff or existing.is_superuser):
            return Response(
                {"detail": "That user is already a Platform Admin."},
                status=400,
            )

        # Immediate grant for existing accounts
        if grant_now:
            if not existing:
                return Response(
                    {
                        "detail": "No account with that email. Send an invite instead (they can accept after signup)."
                    },
                    status=400,
                )
            existing.is_staff = True
            existing.is_verified = True
            existing.is_active = True
            existing.save(update_fields=["is_staff", "is_verified", "is_active"])
            PlatformAdminInvite.objects.filter(
                email__iexact=email, status="pending"
            ).update(status="revoked")
            _notify_platform(
                existing,
                f"{request.user.email or request.user.username} granted you Platform Admin access.",
                {"path": "/app/platform-admin"},
            )
            return Response(
                {
                    "granted": True,
                    "user": serialize_user(existing),
                    "detail": "Staff access granted.",
                },
                status=201,
            )

        if PlatformAdminInvite.objects.filter(
            email__iexact=email, status="pending"
        ).exists():
            return Response(
                {"detail": "A pending invite already exists for that email."},
                status=400,
            )

        token = secrets.token_urlsafe(32)
        invite = PlatformAdminInvite.objects.create(
            email=email,
            token=token,
            note=note,
            invited_by=request.user,
            expires_at=timezone.now() + timedelta(days=7),
        )
        accept_path = f"/app/platform-admin/accept-invite?token={token}"
        invite_url = f"{_frontend_base()}{accept_path}"
        invited_by_name = (
            " ".join(
                p
                for p in [
                    getattr(request.user, "first_name", "") or "",
                    getattr(request.user, "last_name", "") or "",
                ]
                if p
            ).strip()
            or request.user.email
            or request.user.username
        )
        emailed = _send_admin_invite_email(
            to_email=email,
            invite_url=invite_url,
            invited_by_name=invited_by_name,
        )
        if existing:
            _notify_platform(
                existing,
                f"{invited_by_name} invited you to Platform Admin. Open the invite to accept.",
                {"path": accept_path, "token": token},
            )

        return Response(
            {
                "invite": serialize_admin_invite(invite),
                "emailed": emailed,
                "user_exists": bool(existing),
            },
            status=201,
        )


class PlatformAdminInviteRevokeView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformStaff]

    def post(self, request, invite_id):
        invite = PlatformAdminInvite.objects.filter(id=invite_id).first()
        if not invite:
            return Response({"detail": "Not found"}, status=404)
        if invite.status != "pending":
            return Response({"detail": "Only pending invites can be revoked"}, status=400)
        invite.status = "revoked"
        invite.save(update_fields=["status"])
        return Response({"invite": serialize_admin_invite(invite)})


class PlatformAdminInviteAcceptView(APIView):
    """Authenticated user accepts an invite for their email → gains is_staff."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        token = str(request.data.get("token") or "").strip()
        if not token:
            return Response({"detail": "token required"}, status=400)
        invite = (
            PlatformAdminInvite.objects.select_for_update()
            .filter(token=token)
            .first()
        )
        if not invite:
            return Response({"detail": "Invite not found"}, status=404)
        if invite.status == "accepted":
            return Response({"detail": "Invite already accepted", "already": True})
        if invite.status != "pending":
            return Response({"detail": f"Invite is {invite.status}"}, status=400)
        if invite.is_expired:
            invite.status = "expired"
            invite.save(update_fields=["status"])
            return Response({"detail": "Invite expired"}, status=400)

        user_email = str(request.user.email or "").strip().lower()
        if user_email != invite.email.lower():
            return Response(
                {
                    "detail": f"Sign in with {invite.email} to accept this invite.",
                    "expected_email": invite.email,
                },
                status=403,
            )

        user = request.user
        user.is_staff = True
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_staff", "is_verified", "is_active"])

        invite.status = "accepted"
        invite.accepted_by = user
        invite.accepted_at = timezone.now()
        invite.save(update_fields=["status", "accepted_by", "accepted_at"])

        _notify_platform(
            user,
            "You are now a Climate Wavers Platform Admin.",
            {"path": "/app/platform-admin"},
        )
        if invite.invited_by_id and invite.invited_by_id != user.id:
            _notify_platform(
                invite.invited_by,
                f"{user.email or user.username} accepted your Platform Admin invite.",
                {"user_id": user.id},
            )

        return Response(
            {
                "accepted": True,
                "user": serialize_user(user),
                "invite": serialize_admin_invite(invite),
            }
        )
