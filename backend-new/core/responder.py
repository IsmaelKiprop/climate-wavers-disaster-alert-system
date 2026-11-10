"""Responder org onboarding + RapidBrief dispatch desk APIs."""

import re

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ResponderDispatch, ResponderMembership, ResponderOrganization
from .pricing import PLANS, normalize_plan, plan_meta
from .rapid_brief import generate_rapid_brief

User = get_user_model()

ORG_TYPES = [c[0] for c in ResponderOrganization.ORG_TYPES]
DISPATCH_STATUSES = [c[0] for c in ResponderDispatch.STATUS_CHOICES]
ACTIVE_ROLES = ("owner", "dispatcher", "viewer")
WRITE_ROLES = ("owner", "dispatcher")


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

    try:
        radius = int(data.get("coverage_radius_km") or 150)
    except (TypeError, ValueError):
        radius = 150
    radius = max(10, min(radius, 2000))

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
        "plan": normalize_plan(
            data.get("plan") or data.get("requested_plan"),
            (data.get("org_type") or "ngo"),
        ),
        "plan_status": "pending",
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


class ResponderMembershipSerializer(serializers.ModelSerializer):
    org = ResponderOrgSerializer(read_only=True)

    class Meta:
        model = ResponderMembership
        fields = ("id", "role", "created_at", "org")


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


class ResponderMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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
                        "trial_days": meta["trial_days"],
                        "detail": meta["detail"],
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
            try:
                org.coverage_radius_km = max(10, min(int(data.get("coverage_radius_km")), 2000))
            except (TypeError, ValueError):
                pass

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
