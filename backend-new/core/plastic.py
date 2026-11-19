"""
Wavers Plastic Pulse — projects, hotspots, recoveries, recycler intake,
sponsor-a-kilo, certificates, flood hotspot feed.
"""

from __future__ import annotations

import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.db import IntegrityError, transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Notification,
    PlasticCertificate,
    PlasticHotspot,
    PlasticProject,
    PlasticRecovery,
    PlasticRecyclerPartner,
    PlasticSponsorship,
    TreeAdminMembership,
)
from .tree_admin import primary_tree_admin_membership, user_has_tree_admin_access
from .tree_pricing import resolve_platform_fee_rate, split_tree_payment


def _dec(value, default="0") -> Decimal:
    try:
        return Decimal(str(value if value is not None else default))
    except Exception:
        return Decimal(default)


def _money(value) -> Decimal:
    return _dec(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _notify(user, message: str, obj=None):
    if not user:
        return
    kwargs = {
        "user": user,
        "notification_type": "plastic",
        "message": message,
    }
    if obj is not None:
        from django.contrib.contenttypes.models import ContentType

        kwargs["content_type"] = ContentType.objects.get_for_model(obj)
        kwargs["object_id"] = obj.pk
    try:
        Notification.objects.create(**kwargs)
    except Exception:
        pass


def _org_membership(user) -> Optional[TreeAdminMembership]:
    return primary_tree_admin_membership(user)


def _can_manage_project(user, project: PlasticProject) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_staff:
        return True
    if project.organization_id == user.id:
        return True
    if not project.tree_admin_org_id:
        return False
    m = TreeAdminMembership.objects.filter(
        user=user, org_id=project.tree_admin_org_id, role__in=("owner", "manager")
    ).select_related("org").first()
    return bool(m and m.org.has_tree_admin_access)


def _issue_certificate(
    *,
    project: PlasticProject,
    kg,
    holder_name="",
    holder_email="",
    recovery: PlasticRecovery | None = None,
    sponsorship: PlasticSponsorship | None = None,
) -> PlasticCertificate:
    code = f"CW-PL-{uuid.uuid4().hex[:12].upper()}"
    cert = PlasticCertificate.objects.create(
        code=code,
        project=project,
        recovery=recovery,
        sponsorship=sponsorship,
        kg=_money(kg),
        holder_name=(holder_name or "")[:200],
        holder_email=(holder_email or "")[:254],
    )
    if sponsorship is not None:
        sponsorship.certificate_id = code
        sponsorship.certificate_issued_at = timezone.now()
        sponsorship.save(
            update_fields=["certificate_id", "certificate_issued_at"]
        )
    return cert


# ---------- serializers ----------


class PlasticHotspotSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlasticHotspot
        fields = [
            "id",
            "project",
            "created_by",
            "claimed_by",
            "title",
            "notes",
            "photo",
            "latitude",
            "longitude",
            "location_label",
            "severity",
            "drain_related",
            "status",
            "claimed_at",
            "cleared_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "created_by",
            "claimed_by",
            "claimed_at",
            "cleared_at",
            "created_at",
            "status",
        ]


class PlasticRecoverySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlasticRecovery
        fields = [
            "id",
            "project",
            "hotspot",
            "submitted_by",
            "verified_by",
            "recycler",
            "client_uuid",
            "bag_id",
            "polymer_type",
            "kg_claimed",
            "kg_verified",
            "images",
            "videos",
            "latitude",
            "longitude",
            "location_label",
            "notes",
            "status",
            "reject_reason",
            "offline_queued_at",
            "synced_at",
            "verified_at",
            "intake_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "submitted_by",
            "verified_by",
            "recycler",
            "kg_verified",
            "status",
            "reject_reason",
            "synced_at",
            "verified_at",
            "intake_at",
            "created_at",
        ]


class PlasticRecyclerSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlasticRecyclerPartner
        fields = [
            "id",
            "name",
            "organization",
            "contact_email",
            "contact_phone",
            "city",
            "latitude",
            "longitude",
            "buy_rates",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PlasticProjectSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.FloatField(read_only=True)
    hotspots = PlasticHotspotSerializer(many=True, read_only=True)
    recent_recoveries = serializers.SerializerMethodField()

    class Meta:
        model = PlasticProject
        fields = [
            "id",
            "name",
            "description",
            "short_description",
            "organization",
            "tree_admin_org",
            "organization_name",
            "country",
            "region",
            "city",
            "latitude",
            "longitude",
            "address",
            "status",
            "goal_kg",
            "recovered_kg",
            "sponsor_price_usd_per_kg",
            "scrap_pet_kes_per_kg",
            "scrap_hdpe_kes_per_kg",
            "cover_image",
            "gallery",
            "flood_zone_flag",
            "contact_person",
            "contact_email",
            "contact_phone",
            "progress_percentage",
            "hotspots",
            "recent_recoveries",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "organization",
            "tree_admin_org",
            "recovered_kg",
            "progress_percentage",
            "hotspots",
            "recent_recoveries",
            "created_at",
            "updated_at",
        ]

    def get_recent_recoveries(self, obj):
        qs = obj.recoveries.all()[:12]
        return PlasticRecoverySerializer(qs, many=True).data


class PlasticCertificateSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    organization_name = serializers.CharField(
        source="project.organization_name", read_only=True
    )

    class Meta:
        model = PlasticCertificate
        fields = [
            "code",
            "kg",
            "holder_name",
            "holder_email",
            "issued_at",
            "project",
            "project_name",
            "organization_name",
            "recovery",
            "sponsorship",
        ]


# ---------- views ----------


class PlasticProjectListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = PlasticProject.objects.filter(status="active").select_related(
            "tree_admin_org", "organization"
        )
        mine = str(request.query_params.get("mine") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        if mine and request.user.is_authenticated:
            m = _org_membership(request.user)
            org_ids = []
            if m:
                org_ids.append(m.org_id)
            qs = PlasticProject.objects.filter(
                Q(organization=request.user) | Q(tree_admin_org_id__in=org_ids)
            ).distinct()
        return Response(PlasticProjectSerializer(qs[:100], many=True).data)

    def post(self, request):
        if not user_has_tree_admin_access(request.user):
            return Response(
                {"detail": "Approved Tree Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        m = _org_membership(request.user)
        ser = PlasticProjectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org_name = (
            ser.validated_data.get("organization_name")
            or (m.org.name if m else "")
            or request.user.get_username()
        )
        project = ser.save(
            organization=request.user,
            tree_admin_org=m.org if m else None,
            organization_name=org_name,
        )
        return Response(
            PlasticProjectSerializer(project).data, status=status.HTTP_201_CREATED
        )


class PlasticProjectDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, project_id):
        try:
            project = PlasticProject.objects.prefetch_related(
                "hotspots", "recoveries"
            ).get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        return Response(PlasticProjectSerializer(project).data)

    def patch(self, request, project_id):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required."}, status=401)
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, project):
            return Response({"detail": "Forbidden."}, status=403)
        ser = PlasticProjectSerializer(project, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(PlasticProjectSerializer(project).data)


class PlasticHotspotCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = PlasticProject.objects.get(pk=project_id)
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        ser = PlasticHotspotSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        lat = ser.validated_data.get("latitude")
        lng = ser.validated_data.get("longitude")
        if lat is None or lng is None:
            return Response(
                {"detail": "latitude and longitude are required."}, status=400
            )
        hotspot = ser.save(
            project=project,
            created_by=request.user,
            status="open",
        )
        for m in TreeAdminMembership.objects.filter(
            org_id=project.tree_admin_org_id
        ).select_related("user")[:20]:
            _notify(
                m.user,
                f"New plastic hotspot on {project.name}",
                hotspot,
            )
        return Response(
            PlasticHotspotSerializer(hotspot).data, status=status.HTTP_201_CREATED
        )


class PlasticHotspotClaimView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, hotspot_id):
        try:
            hotspot = PlasticHotspot.objects.select_related("project").get(pk=hotspot_id)
        except PlasticHotspot.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if hotspot.status not in ("open", "claimed"):
            return Response({"detail": "Hotspot is not claimable."}, status=400)
        if hotspot.status == "claimed" and hotspot.claimed_by_id not in (
            None,
            request.user.id,
        ):
            return Response({"detail": "Already claimed by someone else."}, status=409)
        hotspot.status = "claimed"
        hotspot.claimed_by = request.user
        hotspot.claimed_at = timezone.now()
        hotspot.save(
            update_fields=["status", "claimed_by", "claimed_at", "updated_at"]
        )
        return Response(PlasticHotspotSerializer(hotspot).data)


class PlasticRecoveryCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        project_id = data.get("project") or data.get("project_id")
        try:
            project = PlasticProject.objects.get(pk=int(project_id))
        except (TypeError, ValueError, PlasticProject.DoesNotExist):
            return Response({"detail": "Valid project required."}, status=400)

        client_uuid = str(data.get("client_uuid") or "").strip()
        if client_uuid:
            existing = PlasticRecovery.objects.filter(
                project=project, client_uuid=client_uuid
            ).first()
            if existing:
                return Response(PlasticRecoverySerializer(existing).data)

        bag_id = str(data.get("bag_id") or "").strip() or f"BAG-{uuid.uuid4().hex[:10].upper()}"
        images = data.get("images") or []
        videos = data.get("videos") or []
        if isinstance(images, str):
            images = [images]
        if isinstance(videos, str):
            videos = [videos]
        lat = data.get("latitude")
        lng = data.get("longitude")
        if lat in (None, "") or lng in (None, ""):
            return Response(
                {"detail": "GPS latitude and longitude are required."}, status=400
            )
        if not images and not videos:
            return Response(
                {"detail": "At least one photo or video is required."}, status=400
            )

        offline = str(data.get("offline") or data.get("was_offline") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        hotspot = None
        hotspot_id = data.get("hotspot") or data.get("hotspot_id")
        if hotspot_id:
            hotspot = PlasticHotspot.objects.filter(
                pk=hotspot_id, project=project
            ).first()

        recovery = PlasticRecovery.objects.create(
            project=project,
            hotspot=hotspot,
            submitted_by=request.user,
            client_uuid=client_uuid,
            bag_id=bag_id[:64],
            polymer_type=str(data.get("polymer_type") or "mixed")[:20],
            kg_claimed=_money(data.get("kg_claimed") or data.get("kg") or 0),
            images=list(images)[:12],
            videos=list(videos)[:6],
            latitude=_dec(lat),
            longitude=_dec(lng),
            location_label=str(data.get("location_label") or "")[:255],
            notes=str(data.get("notes") or "")[:2000],
            status="queued_offline" if offline else "submitted",
            offline_queued_at=timezone.now() if offline else None,
            synced_at=timezone.now(),
        )
        if offline:
            recovery.status = "submitted"
            recovery.save(update_fields=["status", "updated_at"])

        if project.tree_admin_org_id:
            for m in TreeAdminMembership.objects.filter(
                org_id=project.tree_admin_org_id, role__in=("owner", "manager")
            ).select_related("user")[:10]:
                _notify(
                    m.user,
                    f"New plastic recovery proof on {project.name} ({recovery.bag_id})",
                    recovery,
                )
        return Response(
            PlasticRecoverySerializer(recovery).data, status=status.HTTP_201_CREATED
        )


class PlasticRecoveryVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, recovery_id):
        try:
            recovery = PlasticRecovery.objects.select_related("project", "hotspot").get(
                pk=recovery_id
            )
        except PlasticRecovery.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if not _can_manage_project(request.user, recovery.project):
            return Response({"detail": "Forbidden."}, status=403)
        if recovery.status not in ("submitted", "rejected", "queued_offline"):
            return Response(
                {"detail": f"Cannot verify from status {recovery.status}."}, status=400
            )

        action = str(request.data.get("action") or "approve").strip().lower()
        if action in ("reject", "rejected"):
            recovery.status = "rejected"
            recovery.reject_reason = str(request.data.get("reason") or "")[:255]
            recovery.verified_by = request.user
            recovery.verified_at = timezone.now()
            recovery.save(
                update_fields=[
                    "status",
                    "reject_reason",
                    "verified_by",
                    "verified_at",
                    "updated_at",
                ]
            )
            _notify(
                recovery.submitted_by,
                f"Plastic recovery {recovery.bag_id} was rejected.",
                recovery,
            )
            return Response(PlasticRecoverySerializer(recovery).data)

        if recovery.latitude is None or recovery.longitude is None:
            return Response({"detail": "GPS required before verify."}, status=400)
        if not (recovery.images or recovery.videos):
            return Response({"detail": "Media required before verify."}, status=400)

        kg = request.data.get("kg_verified")
        if kg in (None, ""):
            kg = recovery.kg_claimed
        kg = _money(kg)
        if kg <= 0:
            return Response({"detail": "kg_verified must be > 0."}, status=400)

        recovery.status = "cbo_verified"
        recovery.kg_verified = kg
        recovery.verified_by = request.user
        recovery.verified_at = timezone.now()
        recovery.reject_reason = ""
        recovery.save(
            update_fields=[
                "status",
                "kg_verified",
                "verified_by",
                "verified_at",
                "reject_reason",
                "updated_at",
            ]
        )
        _notify(
            recovery.submitted_by,
            f"Plastic recovery {recovery.bag_id} verified by CBO. Await recycler intake.",
            recovery,
        )
        return Response(PlasticRecoverySerializer(recovery).data)


class PlasticIntakeScanView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        bag_id = str(request.data.get("bag_id") or "").strip()
        if not bag_id:
            return Response({"detail": "bag_id required."}, status=400)
        recovery = (
            PlasticRecovery.objects.select_for_update()
            .select_related("project")
            .filter(bag_id=bag_id)
            .order_by("-created_at")
            .first()
        )
        if not recovery:
            return Response({"detail": "Bag not found."}, status=404)
        if recovery.status == "intake_confirmed":
            return Response(PlasticRecoverySerializer(recovery).data)
        if recovery.status not in ("cbo_verified", "submitted"):
            return Response(
                {"detail": f"Recovery status {recovery.status} cannot be intaken."},
                status=400,
            )
        # Allow CBO or staff to intake; recyclers may also if authenticated admin
        if not (
            _can_manage_project(request.user, recovery.project) or request.user.is_staff
        ):
            return Response({"detail": "Forbidden."}, status=403)

        kg = request.data.get("kg_verified")
        if kg in (None, ""):
            kg = recovery.kg_verified or recovery.kg_claimed
        kg = _money(kg)
        if kg <= 0:
            return Response({"detail": "Confirmed kg must be > 0."}, status=400)

        recycler = None
        recycler_id = request.data.get("recycler_id") or request.data.get("recycler")
        if recycler_id:
            recycler = PlasticRecyclerPartner.objects.filter(pk=recycler_id).first()

        already_intaken = False
        prev_status = recovery.status
        recovery.kg_verified = kg
        recovery.status = "intake_confirmed"
        recovery.recycler = recycler
        recovery.intake_at = timezone.now()
        if prev_status == "cbo_verified" or not recovery.verified_at:
            recovery.verified_by = recovery.verified_by or request.user
            recovery.verified_at = recovery.verified_at or timezone.now()
        recovery.save()

        project = PlasticProject.objects.select_for_update().get(pk=recovery.project_id)
        if not already_intaken:
            project.recovered_kg = _money(_dec(project.recovered_kg) + kg)
            project.save(update_fields=["recovered_kg", "updated_at"])

        if recovery.hotspot_id:
            PlasticHotspot.objects.filter(pk=recovery.hotspot_id).update(
                status="cleared", cleared_at=timezone.now()
            )

        cert = None
        if not recovery.certificates.exists():
            holder = ""
            email = ""
            if recovery.submitted_by_id:
                holder = (
                    recovery.submitted_by.get_full_name()
                    or recovery.submitted_by.username
                )
                email = recovery.submitted_by.email or ""
            cert = _issue_certificate(
                project=project,
                kg=kg,
                holder_name=holder,
                holder_email=email,
                recovery=recovery,
            )

        points_earned = 0
        try:
            from .points import credit_recovery_points

            points_earned = credit_recovery_points(recovery) or 0
        except Exception:
            points_earned = 0

        _notify(
            recovery.submitted_by,
            f"Recycler intake confirmed for {recovery.bag_id}: {kg} kg.",
            recovery,
        )
        payload = PlasticRecoverySerializer(recovery).data
        payload["certificate_code"] = cert.code if cert else (
            recovery.certificates.first().code if recovery.certificates.exists() else ""
        )
        payload["points_earned"] = points_earned
        payload["project_recovered_kg"] = float(project.recovered_kg)
        return Response(payload)


class PlasticRecyclerListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = PlasticRecyclerPartner.objects.filter(is_active=True)
        return Response(PlasticRecyclerSerializer(qs, many=True).data)

    def post(self, request):
        if not user_has_tree_admin_access(request.user):
            return Response({"detail": "Tree Admin required."}, status=403)
        m = _org_membership(request.user)
        ser = PlasticRecyclerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        partner = ser.save(
            created_by=request.user,
            organization=m.org if m else None,
        )
        return Response(
            PlasticRecyclerSerializer(partner).data, status=status.HTTP_201_CREATED
        )


class PlasticCertificateVerifyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, code=None):
        code = (code or request.query_params.get("code") or "").strip()
        if not code:
            return Response({"detail": "code required."}, status=400)
        try:
            cert = PlasticCertificate.objects.select_related("project", "recovery").get(
                code__iexact=code
            )
        except PlasticCertificate.DoesNotExist:
            return Response({"detail": "Certificate not found."}, status=404)
        data = PlasticCertificateSerializer(cert).data
        if cert.recovery_id:
            data["recovery"] = PlasticRecoverySerializer(cert.recovery).data
        return Response({"valid": True, "certificate": data})


class PlasticFloodHotspotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            PlasticHotspot.objects.filter(
                drain_related=True, status__in=("open", "claimed")
            )
            .select_related("project")
            .order_by("-created_at")[:200]
        )
        return Response(
            [
                {
                    "id": h.id,
                    "project_id": h.project_id,
                    "project_name": h.project.name,
                    "title": h.title or h.location_label or f"Hotspot {h.id}",
                    "latitude": float(h.latitude),
                    "longitude": float(h.longitude),
                    "severity": h.severity,
                    "status": h.status,
                    "drain_related": h.drain_related,
                    "photo": h.photo,
                }
                for h in qs
            ]
        )


class PlasticSponsorCheckoutView(APIView):
    """
    Prepare sponsor-a-kilo quote. Frontend opens Paystack with metadata product=plastic.
    Completion handled in paystack_payment.record_plastic_sponsorship.
    """

    permission_classes = [AllowAny]

    def post(self, request, project_id):
        try:
            project = PlasticProject.objects.select_related("tree_admin_org").get(
                pk=project_id
            )
        except PlasticProject.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        kg = _money(request.data.get("kg") or request.data.get("kg_sponsored") or 0)
        if kg <= 0:
            return Response({"detail": "kg must be > 0."}, status=400)
        if kg > 5000:
            return Response({"detail": "Max 5000 kg per sponsorship."}, status=400)

        price = _money(project.sponsor_price_usd_per_kg)
        amount_usd = _money(price * kg)
        org = project.tree_admin_org
        platform_fee, admin_share, fee_rate = split_tree_payment(amount_usd, org=org)

        redeem_points = str(request.data.get("redeem_points") or "").lower() in {
            "1",
            "true",
            "yes",
        }
        if redeem_points:
            if not request.user.is_authenticated:
                return Response({"detail": "Login required to redeem points."}, status=401)
            try:
                from .points import redeem_plastic_with_points

                result = redeem_plastic_with_points(
                    user=request.user,
                    project=project,
                    kg=kg,
                    dedication_message=str(request.data.get("dedication_message") or ""),
                )
                return Response({"success": True, "redeemed": True, **result})
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)

        reference = f"PLASTIC-{uuid.uuid4().hex[:16].upper()}"
        return Response(
            {
                "success": True,
                "reference": reference,
                "project_id": project.id,
                "kg_sponsored": float(kg),
                "amount_usd": float(amount_usd),
                "sponsor_price_usd_per_kg": float(price),
                "platform_fee_usd": float(platform_fee),
                "admin_share_usd": float(admin_share),
                "fee_rate": float(fee_rate),
                "product": "plastic",
                "metadata": {
                    "product": "plastic",
                    "plastic_project_id": str(project.id),
                    "kg_sponsored": str(kg),
                    "amount_usd": str(amount_usd),
                    "dedication_message": str(
                        request.data.get("dedication_message") or ""
                    )[:500],
                    "sponsor_name": str(request.data.get("sponsor_name") or "")[:200],
                },
            }
        )


class PlasticAdminQueueView(APIView):
    """Recoveries awaiting CBO review for the caller's org projects."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_has_tree_admin_access(request.user):
            return Response({"detail": "Tree Admin required."}, status=403)
        m = _org_membership(request.user)
        org_id = m.org_id if m else None
        qs = PlasticRecovery.objects.filter(
            status="submitted"
        ).select_related("project", "hotspot", "submitted_by")
        if org_id:
            qs = qs.filter(
                Q(project__tree_admin_org_id=org_id)
                | Q(project__organization=request.user)
            )
        else:
            qs = qs.filter(project__organization=request.user)
        return Response(PlasticRecoverySerializer(qs[:100], many=True).data)
