"""Tree Admin org onboarding + desk APIs."""

import re

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TreeAdminMembership, TreeAdminOrganization
from .tree_pricing import PLANS, normalize_plan, plan_meta

User = get_user_model()

ORG_TYPES = [c[0] for c in TreeAdminOrganization.ORG_TYPES]


def _unique_username(base):
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "", (base or "treeadmin").lower())[:18] or "treeadmin"
    candidate = cleaned
    n = 1
    while User.objects.filter(username__iexact=candidate).exists():
        n += 1
        candidate = f"{cleaned}{n}"[:100]
    return candidate


def _parse_apply_fields(data):
    name = (data.get("name") or "").strip()
    if not name:
        return None, Response({"detail": "Organization name is required"}, status=400)

    org_type = (data.get("org_type") or "cbo").strip()
    if org_type not in ORG_TYPES:
        return None, Response({"detail": "invalid org_type"}, status=400)

    return {
        "name": name[:200],
        "org_type": org_type,
        "website": (data.get("website") or "").strip() or None,
        "country": (data.get("country") or "Kenya").strip()[:100] or "Kenya",
        "city": (data.get("city") or "").strip()[:100] or None,
        "contact_email": (data.get("contact_email") or "").strip() or None,
        "contact_phone": (data.get("contact_phone") or "").strip() or None,
        "planting_sites_note": (data.get("planting_sites_note") or "").strip() or None,
        "plan": normalize_plan(data.get("plan") or data.get("requested_plan")),
        "plan_status": "pending",
    }, None


def _create_pending_org(user, fields):
    org = TreeAdminOrganization.objects.create(
        **fields,
        verification_status="pending",
        created_by=user,
    )
    membership = TreeAdminMembership.objects.create(org=org, user=user, role="owner")
    return org, membership


def _memberships_for(user):
    return (
        TreeAdminMembership.objects.filter(user=user)
        .select_related("org")
        .order_by("-created_at")
    )


def primary_tree_admin_membership(user):
    memberships = list(_memberships_for(user))
    for m in memberships:
        if m.org.verification_status == "approved" and m.org.has_tree_admin_access:
            return m
    for m in memberships:
        if m.org.verification_status == "approved":
            return m
    return memberships[0] if memberships else None


def user_has_tree_admin_access(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    for m in _memberships_for(user):
        if m.org.has_tree_admin_access and m.role in ("owner", "manager"):
            return True
    # Legacy staff tree admins (pre-org model)
    if user.is_staff:
        return True
    return False


def active_tree_admin_org_for(user):
    m = primary_tree_admin_membership(user)
    if m and m.org.has_tree_admin_access:
        return m.org
    return None


class TreeAdminOrgSerializer(serializers.ModelSerializer):
    has_tree_admin_access = serializers.SerializerMethodField()
    plan_label = serializers.SerializerMethodField()
    plan_price_label = serializers.SerializerMethodField()
    max_active_projects = serializers.SerializerMethodField()

    class Meta:
        model = TreeAdminOrganization
        fields = (
            "id",
            "name",
            "org_type",
            "website",
            "country",
            "city",
            "contact_email",
            "contact_phone",
            "planting_sites_note",
            "verification_status",
            "verified_at",
            "plan",
            "plan_status",
            "plan_started_at",
            "plan_ends_at",
            "has_tree_admin_access",
            "plan_label",
            "plan_price_label",
            "max_active_projects",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_has_tree_admin_access(self, obj):
        return obj.has_tree_admin_access

    def get_plan_label(self, obj):
        return plan_meta(obj.plan).get("name")

    def get_plan_price_label(self, obj):
        return plan_meta(obj.plan).get("price_label")

    def get_max_active_projects(self, obj):
        return plan_meta(obj.plan).get("max_active_projects")


class TreeAdminMembershipSerializer(serializers.ModelSerializer):
    org = TreeAdminOrgSerializer(read_only=True)

    class Meta:
        model = TreeAdminMembership
        fields = ("id", "role", "created_at", "org")
        read_only_fields = fields


class TreeAdminPublicApplyView(APIView):
    """Create workspace account + pending Tree Admin organization."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data = request.data or {}
        fields, error = _parse_apply_fields(data)
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
                        "Sign in, then open Tree Admin in the app."
                    ),
                    "login_path": "/login?redirect=/app/admin/tree-projects",
                },
                status=400,
            )

        contact_first = (data.get("contact_first_name") or data.get("first_name") or "").strip()
        contact_last = (data.get("contact_last_name") or data.get("last_name") or "").strip()
        if not contact_first:
            contact_first = fields["name"].split(" ")[0][:100]
        if not contact_last:
            contact_last = "TreeAdmin"

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
                profession="Tree Admin organization",
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
                "membership": TreeAdminMembershipSerializer(membership).data,
                "email": user.email,
                "username": user.username,
                "message": (
                    "Tree Admin application submitted and workspace account created. "
                    "An admin will verify your organization before you can publish projects."
                    + mail_note
                ),
                "next": "/emailcode",
            },
            status=201,
        )


class TreeAdminApplyView(APIView):
    """Authenticated user applies as Tree Admin without creating a new account."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        fields, error = _parse_apply_fields(request.data or {})
        if error:
            return error
        fields["contact_email"] = (
            fields["contact_email"] or request.user.email or ""
        ).strip().lower() or None

        existing = TreeAdminMembership.objects.filter(user=request.user).first()
        if existing:
            return Response(
                {
                    "detail": "You already have a Tree Admin organization.",
                    "membership": TreeAdminMembershipSerializer(existing).data,
                },
                status=400,
            )

        with transaction.atomic():
            _org, membership = _create_pending_org(request.user, fields)

        return Response(
            {
                "membership": TreeAdminMembershipSerializer(membership).data,
                "message": "Application submitted. An admin will verify your organization.",
            },
            status=201,
        )


class TreeAdminMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = list(_memberships_for(request.user))
        approved = [
            m for m in memberships if m.org.verification_status == "approved"
        ]
        access = [m for m in approved if m.org.has_tree_admin_access]
        return Response(
            {
                "memberships": TreeAdminMembershipSerializer(memberships, many=True).data,
                "has_approved": bool(approved),
                "has_pending": any(
                    m.org.verification_status == "pending" for m in memberships
                ),
                "has_tree_admin_access": bool(access) or bool(request.user.is_staff),
                "is_legacy_staff": bool(request.user.is_staff or request.user.is_superuser),
                "plans": {
                    key: {
                        "key": meta["key"],
                        "name": meta["name"],
                        "price_label": meta["price_label"],
                        "price_kes_month": meta["price_kes_month"],
                        "max_active_projects": meta["max_active_projects"],
                        "trial_days": meta["trial_days"],
                        "detail": meta["detail"],
                    }
                    for key, meta in PLANS.items()
                },
                "platform_fee_rate": "0.18",
            }
        )
