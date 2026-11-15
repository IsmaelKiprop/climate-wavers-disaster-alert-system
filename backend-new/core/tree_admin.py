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


def _default_apply_fields_for_user(user, data=None):
    """Build pending-org fields from a signed-in user (+ optional form overrides)."""
    data = data or {}
    name = (
        (data.get("name") or "").strip()
        or f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
        or (user.username or "").strip()
        or (user.email or "Tree Admin").split("@")[0]
    )
    org_type = (data.get("org_type") or "cbo").strip()
    if org_type not in ORG_TYPES:
        org_type = "cbo"
    return {
        "name": name[:200],
        "org_type": org_type,
        "website": (data.get("website") or "").strip() or None,
        "country": (
            (data.get("country") or getattr(user, "country", None) or "Kenya")
        ).strip()[:100]
        or "Kenya",
        "city": (
            (data.get("city") or getattr(user, "state", None) or getattr(user, "location", None) or "")
        ).strip()[:100]
        or None,
        "contact_email": (
            (data.get("contact_email") or data.get("email") or user.email or "")
            .strip()
            .lower()
            or None
        ),
        "contact_phone": (
            (data.get("contact_phone") or getattr(user, "phone", None) or "")
            .strip()
            or None
        ),
        "planting_sites_note": (data.get("planting_sites_note") or "").strip() or None,
        "plan": normalize_plan(data.get("plan") or data.get("requested_plan")),
        "plan_status": "pending",
    }


@transaction.atomic
def ensure_pending_tree_admin_application(user, data=None):
    """
    Idempotent: every signed-in applicant gets a pending org that appears in
    Django admin for one-click approve. No CLI needed for future users.
    """
    existing = (
        TreeAdminMembership.objects.filter(user=user)
        .select_related("org")
        .order_by("-created_at")
        .first()
    )
    if existing:
        return existing.org, existing, False
    fields = _default_apply_fields_for_user(user, data)
    org, membership = _create_pending_org(user, fields)
    return org, membership, True


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
    # Legacy: Climate Wavers platform staff (not Tree Admin org operators)
    if user.is_staff and not TreeAdminMembership.objects.filter(user=user).exists():
        return True
    return False


def tree_admin_org_ids_for(user):
    """Org IDs the user belongs to (any verification status)."""
    if not user or not user.is_authenticated:
        return []
    return list(_memberships_for(user).values_list("org_id", flat=True))


def user_can_manage_tree_project(user, project) -> bool:
    """Tree Admins manage only their org's projects; platform staff manage all."""
    if not user or not user.is_authenticated or project is None:
        return False
    if user.is_superuser:
        return True
    # Platform Climate Wavers staff (no Tree Admin membership) can manage all
    if user.is_staff and not TreeAdminMembership.objects.filter(user=user).exists():
        return True
    org_ids = tree_admin_org_ids_for(user)
    if project.tree_admin_org_id and project.tree_admin_org_id in org_ids:
        return user_has_tree_admin_access(user)
    if project.organization_id == user.id and user_has_tree_admin_access(user):
        return True
    return False


def user_can_verify_tree_projects(user) -> bool:
    """
    Only Climate Wavers platform admins verify projects.
    Tree Admins (org members) never verify — including if they were
    historically granted is_staff during approval.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if user.is_staff and not TreeAdminMembership.objects.filter(user=user).exists():
        return True
    return False


def active_tree_admin_org_for(user):
    m = primary_tree_admin_membership(user)
    if m and m.org.has_tree_admin_access:
        return m.org
    return None


@transaction.atomic
def approve_user_as_tree_admin(user, *, org_name: str = "", plan: str = "pilot"):
    """
    Create a Tree Admin org (if needed), approve it, start pilot.
    Does NOT grant Django is_staff — Tree Admins must not self-verify
    or access ClimateWavers Portal as platform admins.
    """
    from django.utils import timezone

    from .tree_pricing import start_tree_pilot

    if not user:
        raise ValueError("user is required")

    membership = (
        TreeAdminMembership.objects.filter(user=user)
        .select_related("org")
        .order_by("-created_at")
        .first()
    )

    created = False
    if membership:
        org = membership.org
    else:
        name = (org_name or "").strip()
        if not name:
            name = (
                f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
                or user.username
                or (user.email or "Tree Admin").split("@")[0]
            )
        org = TreeAdminOrganization.objects.create(
            name=name[:200],
            org_type="cbo",
            country=(getattr(user, "country", None) or "Kenya")[:100] or "Kenya",
            city=(getattr(user, "state", None) or getattr(user, "location", None) or "")[
                :100
            ]
            or None,
            contact_email=user.email,
            contact_phone=(getattr(user, "phone", None) or None),
            plan=normalize_plan(plan),
            plan_status="pending",
            verification_status="pending",
            created_by=user,
        )
        membership = TreeAdminMembership.objects.create(
            org=org, user=user, role="owner"
        )
        created = True

    org.verification_status = "approved"
    org.verified_at = timezone.now()
    start_tree_pilot(org, plan=plan or org.plan)
    org.save()

    # Activate account for publishing — never grant platform is_staff
    user.is_verified = True
    user.is_active = True
    user.save(update_fields=["is_verified", "is_active"])

    return org, membership, created


@transaction.atomic
def approve_tree_admin_org(org):
    """Approve an existing Tree Admin org (no Django is_staff for owners)."""
    from django.utils import timezone

    from .tree_pricing import start_tree_pilot

    if not org:
        raise ValueError("org is required")

    org.verification_status = "approved"
    org.verified_at = timezone.now()
    start_tree_pilot(org)
    org.save()

    owners = org.memberships.filter(role="owner").select_related("user")
    for membership in owners:
        user = membership.user
        if not user:
            continue
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_verified", "is_active"])

    return org


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
                        "Sign in — we'll queue your Tree Admin application for approval."
                    ),
                    "login_path": "/login?redirect=/app/admin/tree-projects?apply=1",
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
        data = request.data or {}
        # Allow minimal payload (ensure from Tree Admin desk) — fill from profile.
        if (data.get("name") or "").strip():
            fields, error = _parse_apply_fields(data)
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
                        "created": False,
                    },
                    status=200,
                )
            with transaction.atomic():
                _org, membership = _create_pending_org(request.user, fields)
            created = True
        else:
            _org, membership, created = ensure_pending_tree_admin_application(
                request.user, data
            )

        return Response(
            {
                "membership": TreeAdminMembershipSerializer(membership).data,
                "created": created,
                "message": (
                    "Application submitted. An admin will verify your organization "
                    "in ClimateWavers Portal → Tree admin organizations."
                    if created
                    else "You already have a Tree Admin application on file."
                ),
            },
            status=201 if created else 200,
        )


class TreeAdminEnsureView(APIView):
    """
    One-tap for signed-in users: queue a pending Tree Admin org for admin approval.
    Idempotent — safe to call when opening Tree Admin.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        org, membership, created = ensure_pending_tree_admin_application(
            request.user, request.data or {}
        )
        return Response(
            {
                "membership": TreeAdminMembershipSerializer(membership).data,
                "created": created,
                "has_pending": org.verification_status == "pending",
                "has_tree_admin_access": bool(org.has_tree_admin_access)
                or bool(request.user.is_staff),
                "message": (
                    "Tree Admin application queued for verification."
                    if created
                    else "Tree Admin application already on file."
                ),
            },
            status=201 if created else 200,
        )


class TreeAdminMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = list(_memberships_for(request.user))
        approved = [
            m for m in memberships if m.org.verification_status == "approved"
        ]
        has_access = user_has_tree_admin_access(request.user)
        can_verify = user_can_verify_tree_projects(request.user)
        return Response(
            {
                "memberships": TreeAdminMembershipSerializer(memberships, many=True).data,
                "has_approved": bool(approved),
                "has_pending": any(
                    m.org.verification_status == "pending" for m in memberships
                ),
                "has_tree_admin_access": has_access,
                "can_verify_projects": can_verify,
                "is_platform_admin": can_verify,
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
