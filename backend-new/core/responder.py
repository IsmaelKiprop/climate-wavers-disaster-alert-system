"""Responder org onboarding + RapidBrief dispatch desk APIs."""

import re
import secrets

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ResponderDispatch,
    ResponderMembership,
    ResponderOrganization,
    ResponderSeatInvite,
)
from .pricing import (
    PLANS,
    can_add_seat,
    clamp_coverage_km,
    is_billable_plan,
    max_coverage_km,
    normalize_plan,
    plan_meta,
    seat_count,
    seats_remaining,
    verification_priority,
)
from .rapid_brief import generate_rapid_brief

User = get_user_model()

ORG_TYPES = [c[0] for c in ResponderOrganization.ORG_TYPES]
DISPATCH_STATUSES = [c[0] for c in ResponderDispatch.STATUS_CHOICES]
ACTIVE_ROLES = ("owner", "dispatcher", "viewer")
WRITE_ROLES = ("owner", "dispatcher")
INVITE_ROLES = ("owner", "dispatcher", "viewer")


def _parse_disaster_types(raw):
    if isinstance(raw, str):
        return [t.strip() for t in raw.split(",") if t.strip()]
    if isinstance(raw, list):
        return raw
    return []


def _parse_org_apply_fields(data):
    """Validate shared org fields for authenticated + public apply."""
    name = (data.get("name") or "").strip()
    if not name:
        return None, Response({"detail": "Organization name is required"}, status=400)

    org_type = (data.get("org_type") or "other").strip()
    if org_type not in ORG_TYPES:
        return None, Response({"detail": "invalid org_type"}, status=400)

    try:
        lat = float(data.get("latitude"))
        lng = float(data.get("longitude"))
    except (TypeError, ValueError):
        return None, Response(
            {"detail": "latitude and longitude are required"}, status=400
        )

    plan = normalize_plan(
        data.get("plan") or data.get("requested_plan"),
        org_type,
    )
    meta = plan_meta(plan)
    try:
        radius = int(data.get("coverage_radius_km") or meta.get("default_coverage_km") or 150)
    except (TypeError, ValueError):
        radius = int(meta.get("default_coverage_km") or 150)
    radius = clamp_coverage_km(plan, radius)

    return {
        "name": name[:200],
        "org_type": org_type,
        "website": (data.get("website") or "").strip() or None,
        "logo": (data.get("logo") or "").strip() or None,
        "country": (data.get("country") or "Kenya").strip()[:100] or "Kenya",
        "city": (data.get("city") or "").strip()[:100] or None,
        "latitude": lat,
        "longitude": lng,
        "coverage_radius_km": radius,
        "disaster_types": _parse_disaster_types(data.get("disaster_types")),
        "contact_email": (data.get("contact_email") or "").strip() or None,
        "contact_phone": (data.get("contact_phone") or "").strip() or None,
        "whatsapp_opt_in": bool(data.get("whatsapp_opt_in")),
        "plan": plan,
        "plan_status": "pending",
        "max_seats": int(meta.get("max_seats") or 5),
    }, None


def _unique_username(base):
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "", (base or "responder").lower())[:18] or "responder"
    candidate = cleaned
    n = 1
    while User.objects.filter(username__iexact=candidate).exists():
        n += 1
        candidate = f"{cleaned}{n}"[:100]
    return candidate


def _create_pending_org(user, fields):
    org = ResponderOrganization.objects.create(
        **fields,
        verification_status="pending",
        created_by=user,
    )
    membership = ResponderMembership.objects.create(
        org=org, user=user, role="owner"
    )
    return org, membership


class ResponderOrgSerializer(serializers.ModelSerializer):
    has_rapidbrief_access = serializers.SerializerMethodField()
    plan_label = serializers.SerializerMethodField()
    plan_price_label = serializers.SerializerMethodField()
    price_kes_month = serializers.SerializerMethodField()
    max_coverage_km = serializers.SerializerMethodField()
    seats_used = serializers.SerializerMethodField()
    seats_remaining = serializers.SerializerMethodField()
    billable = serializers.SerializerMethodField()
    verification_priority = serializers.SerializerMethodField()

    class Meta:
        model = ResponderOrganization
        fields = (
            "id",
            "name",
            "org_type",
            "logo",
            "website",
            "country",
            "city",
            "latitude",
            "longitude",
            "coverage_radius_km",
            "disaster_types",
            "contact_email",
            "contact_phone",
            "whatsapp_opt_in",
            "verification_status",
            "verified_at",
            "plan",
            "plan_status",
            "plan_started_at",
            "plan_ends_at",
            "max_seats",
            "seats_used",
            "seats_remaining",
            "max_coverage_km",
            "price_kes_month",
            "billable",
            "verification_priority",
            "has_rapidbrief_access",
            "plan_label",
            "plan_price_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "verification_status",
            "verified_at",
            "plan_status",
            "plan_started_at",
            "plan_ends_at",
            "max_seats",
            "seats_used",
            "seats_remaining",
            "max_coverage_km",
            "price_kes_month",
            "billable",
            "verification_priority",
            "has_rapidbrief_access",
            "plan_label",
            "plan_price_label",
            "created_at",
            "updated_at",
        )

    def get_has_rapidbrief_access(self, obj):
        return bool(getattr(obj, "has_rapidbrief_access", False))

    def get_plan_label(self, obj):
        return plan_meta(obj.plan).get("name")

    def get_plan_price_label(self, obj):
        return plan_meta(obj.plan).get("price_label")

    def get_price_kes_month(self, obj):
        return plan_meta(obj.plan).get("price_kes_month")

    def get_max_coverage_km(self, obj):
        return max_coverage_km(obj.plan)

    def get_seats_used(self, obj):
        return seat_count(obj)

    def get_seats_remaining(self, obj):
        return seats_remaining(obj)

    def get_billable(self, obj):
        return is_billable_plan(obj.plan)

    def get_verification_priority(self, obj):
        return verification_priority(obj.plan)


class ResponderMembershipSerializer(serializers.ModelSerializer):
    org = ResponderOrgSerializer(read_only=True)

    class Meta:
        model = ResponderMembership
        fields = ("id", "role", "created_at", "org")


class ResponderTeamMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = ResponderMembership
        fields = (
            "id",
            "role",
            "created_at",
            "email",
            "username",
            "first_name",
            "last_name",
            "user_id",
        )


class ResponderSeatInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResponderSeatInvite
        fields = ("id", "email", "role", "status", "created_at", "accepted_at")


class ResponderDispatchSerializer(serializers.ModelSerializer):
    org_name = serializers.CharField(source="org.name", read_only=True)

    class Meta:
        model = ResponderDispatch
        fields = (
            "id",
            "org",
            "org_name",
            "event_key",
            "source",
            "disaster_type",
            "place",
            "city",
            "country",
            "latitude",
            "longitude",
            "magnitude",
            "is_official",
            "confidence",
            "ai_summary",
            "ai_brief",
            "distance_km",
            "status",
            "notified_at",
            "acknowledged_at",
            "acknowledged_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


def _memberships_for(user):
    return (
        ResponderMembership.objects.select_related("org")
        .filter(user=user)
        .order_by("-created_at")
    )


def _primary_membership(user, require_approved=False):
    qs = _memberships_for(user)
    if require_approved:
        qs = qs.filter(org__verification_status="approved")
    return qs.first()


def _get_membership(user, org_id=None):
    qs = _memberships_for(user)
    if org_id:
        qs = qs.filter(org_id=org_id)
    return qs.first()


class ResponderApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        fields, error = _parse_org_apply_fields(data)
        if error:
            return error

        if not fields["contact_email"]:
            fields["contact_email"] = request.user.email

        existing = ResponderMembership.objects.filter(
            user=request.user,
            org__verification_status__in=["pending", "approved"],
        ).select_related("org").first()
        if existing:
            return Response(
                {
                    "detail": "You already have a responder organization.",
                    "membership": ResponderMembershipSerializer(existing).data,
                },
                status=400,
            )

        with transaction.atomic():
            _org, membership = _create_pending_org(request.user, fields)

        return Response(
            {
                "membership": ResponderMembershipSerializer(membership).data,
                "message": "Application submitted. An admin will verify your organization.",
            },
            status=201,
        )


class ResponderPublicApplyView(APIView):
    """
    Org-first RapidBrief apply for teams that do not have a personal account yet.
    Creates an organization workspace owner account + pending ResponderOrganization.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data or {}
        fields, error = _parse_org_apply_fields(data)
        if error:
            return error

        contact_email = (
            fields["contact_email"]
            or (data.get("email") or "").strip()
            or ""
        ).lower()
        if not contact_email:
            return Response(
                {"detail": "Organization contact email is required"}, status=400
            )
        fields["contact_email"] = contact_email

        password = data.get("password") or ""
        if len(str(password)) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters"}, status=400
            )

        if User.objects.filter(email__iexact=contact_email).exists():
            return Response(
                {
                    "detail": (
                        "An account with this email already exists. "
                        "Sign in, then open Apply as Responder in the app."
                    ),
                    "login_path": "/login?redirect=/app/responder/apply",
                },
                status=400,
            )

        contact_first = (data.get("contact_first_name") or data.get("first_name") or "").strip()
        contact_last = (data.get("contact_last_name") or data.get("last_name") or "").strip()
        if not contact_first:
            contact_first = fields["name"].split(" ")[0][:100]
        if not contact_last:
            contact_last = "Responder"

        username_base = (data.get("username") or "").strip() or re.sub(
            r"[^a-zA-Z0-9_]", "", fields["name"].lower()
        )[:18]
        username = _unique_username(username_base)

        with transaction.atomic():
            user = User.objects.create_user(
                email=contact_email,
                first_name=contact_first[:100],
                last_name=contact_last[:100],
                country=fields["country"],
                state=(fields["city"] or fields["country"])[:100],
                password=password,
                username=username,
                profession="Responder organization",
                is_onboarded=True,
                is_verified=False,
            )
            _org, membership = _create_pending_org(user, fields)

        try:
            from api.tasks import send_activation_email

            send_activation_email(user.email)
            mail_note = " Check your email for a verification code."
        except Exception:
            mail_note = " You can sign in and verify your email from the app."

        return Response(
            {
                "membership": ResponderMembershipSerializer(membership).data,
                "email": user.email,
                "username": user.username,
                "message": (
                    "Organization application submitted and workspace account created. "
                    "An admin will verify your organization before live dispatches start."
                    + mail_note
                ),
                "next": "/emailcode",
            },
            status=201,
        )


def _accept_pending_invites_for(user):
    """Attach any pending seat invites matching the user's email."""
    email = (getattr(user, "email", "") or "").strip().lower()
    if not email:
        return []
    accepted = []
    invites = (
        ResponderSeatInvite.objects.select_related("org")
        .filter(email__iexact=email, status="pending")
        .order_by("created_at")
    )
    for invite in invites:
        org = invite.org
        if ResponderMembership.objects.filter(org=org, user=user).exists():
            invite.status = "accepted"
            invite.accepted_by = user
            invite.accepted_at = timezone.now()
            invite.save(
                update_fields=["status", "accepted_by", "accepted_at"]
            )
            continue
        # Pending invite already reserved a seat; convert without re-checking capacity.
        membership = ResponderMembership.objects.create(
            org=org, user=user, role=invite.role or "dispatcher"
        )
        invite.status = "accepted"
        invite.accepted_by = user
        invite.accepted_at = timezone.now()
        invite.save(update_fields=["status", "accepted_by", "accepted_at"])
        accepted.append(membership)
    return accepted


class ResponderMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _accept_pending_invites_for(request.user)
        memberships = list(_memberships_for(request.user))
        approved = [
            m for m in memberships if m.org.verification_status == "approved"
        ]
        rapidbrief = [m for m in approved if m.org.has_rapidbrief_access]
        return Response(
            {
                "memberships": ResponderMembershipSerializer(memberships, many=True).data,
                "has_approved": bool(approved),
                "has_pending": any(
                    m.org.verification_status == "pending" for m in memberships
                ),
                "has_rapidbrief": bool(rapidbrief),
                "plans": {
                    key: {
                        "key": meta["key"],
                        "name": meta["name"],
                        "price_label": meta["price_label"],
                        "price_kes_month": meta["price_kes_month"],
                        "max_seats": meta["max_seats"],
                        "max_coverage_km": meta["max_coverage_km"],
                        "billable": bool(meta.get("billable")),
                        "trial_days": meta["trial_days"],
                        "detail": meta["detail"],
                        "verification_priority": verification_priority(key),
                    }
                    for key, meta in PLANS.items()
                },
            }
        )


class ResponderOrgView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _primary_membership(request.user)
        if not membership:
            return Response({"detail": "No responder organization"}, status=404)
        return Response(
            {
                "membership": ResponderMembershipSerializer(membership).data,
                "org": ResponderOrgSerializer(membership.org).data,
            }
        )

    def patch(self, request):
        membership = _primary_membership(request.user)
        if not membership:
            return Response({"detail": "No responder organization"}, status=404)
        if membership.role != "owner":
            return Response({"detail": "Only owners can update the organization"}, status=403)
        if membership.org.verification_status != "approved":
            return Response(
                {"detail": "Organization must be approved before editing coverage"},
                status=400,
            )

        org = membership.org
        data = request.data or {}
        for field in (
            "website",
            "logo",
            "country",
            "city",
            "contact_email",
            "contact_phone",
        ):
            if field in data:
                value = data.get(field)
                setattr(org, field, (str(value).strip() if value is not None else "") or None)

        if "whatsapp_opt_in" in data:
            org.whatsapp_opt_in = bool(data.get("whatsapp_opt_in"))

        if "coverage_radius_km" in data:
            org.coverage_radius_km = clamp_coverage_km(
                org.plan, data.get("coverage_radius_km")
            )

        if "latitude" in data and "longitude" in data:
            try:
                org.latitude = float(data.get("latitude"))
                org.longitude = float(data.get("longitude"))
            except (TypeError, ValueError):
                return Response({"detail": "invalid coordinates"}, status=400)

        if "disaster_types" in data:
            types = data.get("disaster_types") or []
            if isinstance(types, str):
                types = [t.strip() for t in types.split(",") if t.strip()]
            if isinstance(types, list):
                org.disaster_types = types

        if "org_type" in data and data.get("org_type") in ORG_TYPES:
            org.org_type = data.get("org_type")

        if "name" in data and str(data.get("name") or "").strip():
            org.name = str(data.get("name")).strip()[:200]

        # Keep coverage within the current plan ceiling even if only other fields changed.
        org.coverage_radius_km = clamp_coverage_km(org.plan, org.coverage_radius_km)
        org.save()
        return Response(ResponderOrgSerializer(org).data)


class ResponderDispatchListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _primary_membership(request.user, require_approved=True)
        if not membership:
            pending = _primary_membership(request.user)
            if pending and pending.org.verification_status == "pending":
                return Response(
                    {"detail": "Organization pending verification", "dispatches": []},
                    status=200,
                )
            return Response({"detail": "No approved responder organization"}, status=403)

        org = membership.org
        qs = ResponderDispatch.objects.filter(org=org).order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter and status_filter in DISPATCH_STATUSES:
            qs = qs.filter(status=status_filter)
        limit = min(int(request.query_params.get("limit") or 50), 100)
        qs = qs[:limit]
        return Response(
            {
                "org": ResponderOrgSerializer(org).data,
                "role": membership.role,
                "has_rapidbrief": bool(org.has_rapidbrief_access),
                "dispatches": ResponderDispatchSerializer(qs, many=True).data,
            }
        )


class ResponderDispatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, dispatch_id):
        membership = _primary_membership(request.user, require_approved=True)
        if not membership:
            return Response({"detail": "No approved responder organization"}, status=403)
        try:
            dispatch = ResponderDispatch.objects.get(
                id=dispatch_id, org=membership.org
            )
        except ResponderDispatch.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(ResponderDispatchSerializer(dispatch).data)


class ResponderDispatchStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, dispatch_id):
        membership = _primary_membership(request.user, require_approved=True)
        if not membership:
            return Response({"detail": "No approved responder organization"}, status=403)
        if membership.role not in WRITE_ROLES:
            return Response(
                {"detail": "Viewers cannot change dispatch status"}, status=403
            )

        new_status = (request.data.get("status") or "").strip()
        if new_status not in DISPATCH_STATUSES:
            return Response({"detail": "invalid status"}, status=400)

        try:
            dispatch = ResponderDispatch.objects.get(
                id=dispatch_id, org=membership.org
            )
        except ResponderDispatch.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        dispatch.status = new_status
        if new_status in ("acknowledged", "mobilizing", "on_scene") and not dispatch.acknowledged_at:
            dispatch.acknowledged_at = timezone.now()
            dispatch.acknowledged_by = request.user
        dispatch.save(
            update_fields=[
                "status",
                "acknowledged_at",
                "acknowledged_by",
                "updated_at",
            ]
        )
        return Response(ResponderDispatchSerializer(dispatch).data)


class ResponderBriefView(APIView):
    """Regenerate AI RapidBrief for a dispatch the user can access."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        membership = _primary_membership(request.user, require_approved=True)
        if not membership:
            return Response({"detail": "No approved responder organization"}, status=403)
        if membership.role not in WRITE_ROLES:
            return Response({"detail": "Insufficient role"}, status=403)

        dispatch_id = request.data.get("dispatch_id")
        try:
            dispatch = ResponderDispatch.objects.get(
                id=dispatch_id, org=membership.org
            )
        except (ResponderDispatch.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "dispatch not found"}, status=404)

        event = {
            "place": dispatch.place,
            "city": dispatch.city,
            "country": dispatch.country,
            "disaster_type": dispatch.disaster_type,
            "is_official": dispatch.is_official,
            "magnitude": float(dispatch.magnitude) if dispatch.magnitude is not None else None,
        }
        distance = float(dispatch.distance_km) if dispatch.distance_km is not None else None
        brief = generate_rapid_brief(membership.org, event, distance_km=distance)
        dispatch.ai_brief = brief
        dispatch.save(update_fields=["ai_brief", "updated_at"])
        return Response({"ai_brief": brief, "dispatch": ResponderDispatchSerializer(dispatch).data})


def _owner_membership(user):
    membership = _primary_membership(user, require_approved=True)
    if not membership:
        return None, Response({"detail": "No approved responder organization"}, status=403)
    if membership.role != "owner":
        return None, Response({"detail": "Only owners can manage seats and billing"}, status=403)
    return membership, None


def _team_payload(org):
    members = (
        ResponderMembership.objects.select_related("user")
        .filter(org=org)
        .order_by("created_at")
    )
    invites = ResponderSeatInvite.objects.filter(org=org, status="pending").order_by(
        "-created_at"
    )
    return {
        "org": ResponderOrgSerializer(org).data,
        "max_seats": org.max_seats,
        "seats_used": seat_count(org),
        "seats_remaining": seats_remaining(org),
        "members": ResponderTeamMemberSerializer(members, many=True).data,
        "invites": ResponderSeatInviteSerializer(invites, many=True).data,
    }


class ResponderTeamView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _primary_membership(request.user, require_approved=True)
        if not membership:
            return Response({"detail": "No approved responder organization"}, status=403)
        return Response(_team_payload(membership.org))

    def post(self, request):
        """Invite a teammate by email. Occupies a seat until revoked or accepted."""
        membership, error = _owner_membership(request.user)
        if error:
            return error

        org = membership.org
        if not can_add_seat(org):
            return Response(
                {
                    "detail": (
                        f"Seat limit reached ({org.max_seats}). "
                        "Upgrade your RapidBrief plan for more seats."
                    ),
                    "max_seats": org.max_seats,
                    "seats_used": seat_count(org),
                },
                status=400,
            )

        email = (request.data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return Response({"detail": "A valid teammate email is required"}, status=400)

        role = (request.data.get("role") or "dispatcher").strip().lower()
        if role not in INVITE_ROLES:
            return Response({"detail": "invalid role"}, status=400)
        if role == "owner" and membership.role != "owner":
            return Response({"detail": "Only owners can grant owner role"}, status=403)

        if ResponderMembership.objects.filter(org=org, user__email__iexact=email).exists():
            return Response({"detail": "That user is already on this team"}, status=400)
        if ResponderSeatInvite.objects.filter(
            org=org, email__iexact=email, status="pending"
        ).exists():
            return Response({"detail": "An invite is already pending for that email"}, status=400)

        existing_user = User.objects.filter(email__iexact=email).first()
        with transaction.atomic():
            if existing_user:
                ResponderMembership.objects.create(
                    org=org, user=existing_user, role=role
                )
                ResponderSeatInvite.objects.create(
                    org=org,
                    email=email,
                    role=role,
                    invited_by=request.user,
                    status="accepted",
                    accepted_by=existing_user,
                    accepted_at=timezone.now(),
                )
                try:
                    from django.core.mail import send_mail
                    from django.conf import settings as dj_settings

                    send_mail(
                        subject=f"Added to {org.name} RapidBrief desk",
                        message=(
                            f"You were added to {org.name} as {role} on Climate Wavers RapidBrief.\n"
                            f"Open the app → RapidBrief Desk to view dispatches."
                        ),
                        from_email=getattr(dj_settings, "DEFAULT_FROM_EMAIL", None),
                        recipient_list=[email],
                        fail_silently=True,
                    )
                except Exception:
                    pass
            else:
                ResponderSeatInvite.objects.create(
                    org=org,
                    email=email,
                    role=role,
                    invited_by=request.user,
                    status="pending",
                )
                try:
                    from django.core.mail import send_mail
                    from django.conf import settings as dj_settings

                    send_mail(
                        subject=f"Join {org.name} on Climate Wavers RapidBrief",
                        message=(
                            f"You were invited to {org.name} as {role}.\n"
                            f"Create or sign in to a Climate Wavers account with {email} "
                            f"to join the RapidBrief desk."
                        ),
                        from_email=getattr(dj_settings, "DEFAULT_FROM_EMAIL", None),
                        recipient_list=[email],
                        fail_silently=True,
                    )
                except Exception:
                    pass

        return Response(_team_payload(org), status=201)


class ResponderTeamMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, membership_id):
        owner, error = _owner_membership(request.user)
        if error:
            return error
        org = owner.org
        try:
            member = ResponderMembership.objects.select_related("user").get(
                id=membership_id, org=org
            )
        except ResponderMembership.DoesNotExist:
            return Response({"detail": "Member not found"}, status=404)

        role = (request.data.get("role") or "").strip().lower()
        if role not in INVITE_ROLES:
            return Response({"detail": "invalid role"}, status=400)
        if member.role == "owner" and role != "owner":
            owners = org.memberships.filter(role="owner").count()
            if owners <= 1:
                return Response(
                    {"detail": "Keep at least one owner on the organization"},
                    status=400,
                )
        member.role = role
        member.save(update_fields=["role"])
        return Response(_team_payload(org))

    def delete(self, request, membership_id):
        owner, error = _owner_membership(request.user)
        if error:
            return error
        org = owner.org
        try:
            member = ResponderMembership.objects.get(id=membership_id, org=org)
        except ResponderMembership.DoesNotExist:
            return Response({"detail": "Member not found"}, status=404)

        if member.user_id == request.user.id:
            return Response(
                {"detail": "Owners cannot remove themselves. Transfer ownership first."},
                status=400,
            )
        if member.role == "owner" and org.memberships.filter(role="owner").count() <= 1:
            return Response(
                {"detail": "Keep at least one owner on the organization"},
                status=400,
            )
        member.delete()
        return Response(_team_payload(org))


class ResponderSeatInviteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, invite_id):
        owner, error = _owner_membership(request.user)
        if error:
            return error
        org = owner.org
        try:
            invite = ResponderSeatInvite.objects.get(id=invite_id, org=org)
        except ResponderSeatInvite.DoesNotExist:
            return Response({"detail": "Invite not found"}, status=404)
        if invite.status == "pending":
            invite.status = "revoked"
            invite.save(update_fields=["status"])
        return Response(_team_payload(org))


class ResponderBillingCheckoutView(APIView):
    """Return Paystack checkout details for NGO / Org monthly billing."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        membership, error = _owner_membership(request.user)
        if error:
            return error

        org = membership.org
        plan = normalize_plan(
            request.data.get("plan") or org.plan,
            org.org_type,
        )
        if not is_billable_plan(plan):
            return Response(
                {
                    "detail": (
                        "Pilot is free. Choose NGO or Org to pay with Paystack, "
                        "or contact FlowOps for Partner."
                    )
                },
                status=400,
            )

        try:
            months = max(1, min(int(request.data.get("months") or 1), 12))
        except (TypeError, ValueError):
            months = 1

        meta = plan_meta(plan)
        amount_kes = int(meta["price_kes_month"]) * months
        email = (
            (request.data.get("email") or "").strip()
            or (org.contact_email or "").strip()
            or (request.user.email or "").strip()
        )
        if not email:
            return Response({"detail": "Billing email is required"}, status=400)

        reference = f"rb-{org.id}-{plan}-{secrets.token_hex(8)}"
        return Response(
            {
                "reference": reference,
                "email": email,
                "amount_kes": amount_kes,
                "amount_cents": amount_kes * 100,
                "currency": "KES",
                "plan": plan,
                "plan_label": meta["name"],
                "months": months,
                "max_seats": meta["max_seats"],
                "max_coverage_km": meta["max_coverage_km"],
                "metadata": {
                    "product": "rapidbrief",
                    "org_id": str(org.id),
                    "plan": plan,
                    "months": str(months),
                },
            }
        )


class ResponderBillingVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        membership, error = _owner_membership(request.user)
        if error:
            return error

        reference = (request.data.get("reference") or "").strip()
        if not reference:
            return Response({"detail": "payment reference is required"}, status=400)

        from .paystack_payment import PaymentRecordError, record_rapidbrief_payment

        try:
            payload = record_rapidbrief_payment(
                reference,
                request_user=request.user,
                client_data={
                    "product": "rapidbrief",
                    "org_id": membership.org_id,
                    "plan": request.data.get("plan") or membership.org.plan,
                    "months": request.data.get("months") or 1,
                    "email": request.user.email,
                },
            )
        except PaymentRecordError as exc:
            return Response({"detail": str(exc)}, status=exc.status)

        org = ResponderOrganization.objects.get(id=membership.org_id)
        payload["org"] = ResponderOrgSerializer(org).data
        return Response(payload)
