"""Social Groups APIs for Climate Wavers community."""

from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .chat import (
    conversation_dict,
    ensure_group_conversation,
    leave_group_conversation,
    online_user_ids,
)
from .models import Conversation, SocialGroup, SocialGroupMembership


class SocialGroupSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    conversation_id = serializers.SerializerMethodField()

    class Meta:
        model = SocialGroup
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "cover_image",
            "member_count",
            "is_member",
            "my_role",
            "conversation_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_member_count(self, obj):
        return int(getattr(obj, "_member_count", None) or obj.memberships.count())

    def get_is_member(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return False
        return obj.memberships.filter(user=user).exists()

    def get_my_role(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=user).first()
        return membership.role if membership else None

    def get_conversation_id(self, obj):
        user = self.context.get("request").user if self.context.get("request") else None
        if not user or not user.is_authenticated:
            return None
        if not obj.memberships.filter(user=user).exists():
            return None
        conv = (
            Conversation.objects.filter(
                social_group_id=obj.id, conversation_type="group"
            )
            .only("id")
            .first()
        )
        return conv.id if conv else None


def _unique_slug(name: str) -> str:
    base = slugify(name)[:120] or "group"
    candidate = base
    n = 1
    while SocialGroup.objects.filter(slug=candidate).exists():
        n += 1
        candidate = f"{base}-{n}"[:140]
    return candidate


def _group_chat_payload(user, group):
    conv = ensure_group_conversation(user, group)
    members = list(conv.memberships.select_related("user", "user__chat_presence"))
    return conversation_dict(
        conv,
        user,
        members=members,
        online_ids=online_user_ids(),
    )


class SocialGroupListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SocialGroup.objects.all().order_by("name")
        mine = (request.query_params.get("mine") or "").lower() in {"1", "true", "yes"}
        if mine:
            qs = qs.filter(memberships__user=request.user).distinct()
        data = SocialGroupSerializer(qs, many=True, context={"request": request}).data
        return Response({"groups": data})

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if len(name) < 3:
            return Response({"detail": "Group name must be at least 3 characters"}, status=400)
        description = (request.data.get("description") or "").strip()
        if len(description) > 512:
            return Response(
                {"detail": "Short description must be 512 characters or fewer"},
                status=400,
            )
        # Accept cover_image or logo (WhatsApp-style group photo URL).
        cover = (
            request.data.get("cover_image")
            or request.data.get("logo")
            or ""
        )
        cover = str(cover).strip() or None
        if cover and len(cover) > 500:
            return Response({"detail": "Logo URL is too long"}, status=400)
        with transaction.atomic():
            group = SocialGroup.objects.create(
                name=name[:120],
                slug=_unique_slug(name),
                description=description[:512],
                cover_image=cover,
                created_by=request.user,
            )
            SocialGroupMembership.objects.create(
                group=group, user=request.user, role="owner"
            )
            conversation = _group_chat_payload(request.user, group)
        return Response(
            {
                **SocialGroupSerializer(group, context={"request": request}).data,
                "conversation_id": conversation["id"],
                "conversation": conversation,
                "chat_path": f"/app/chat?c={conversation['id']}",
            },
            status=201,
        )


def _can_manage_group(user, group):
    membership = SocialGroupMembership.objects.filter(group=group, user=user).first()
    return bool(membership and membership.role in {"owner", "admin"})


class SocialGroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        try:
            group = SocialGroup.objects.get(id=group_id)
        except SocialGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(SocialGroupSerializer(group, context={"request": request}).data)

    def patch(self, request, group_id):
        try:
            group = SocialGroup.objects.get(id=group_id)
        except SocialGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if not _can_manage_group(request.user, group):
            return Response(
                {"detail": "Only group owners or admins can edit this group"},
                status=403,
            )

        data = request.data or {}
        updates = []

        if "name" in data:
            name = (data.get("name") or "").strip()
            if len(name) < 3:
                return Response(
                    {"detail": "Group name must be at least 3 characters"},
                    status=400,
                )
            group.name = name[:120]
            updates.append("name")

        if "description" in data:
            description = (data.get("description") or "").strip()
            if len(description) > 512:
                return Response(
                    {"detail": "Short description must be 512 characters or fewer"},
                    status=400,
                )
            group.description = description[:512]
            updates.append("description")

        if "cover_image" in data or "logo" in data:
            cover = data.get("cover_image")
            if cover is None:
                cover = data.get("logo")
            cover = (str(cover).strip() if cover is not None else "") or None
            if cover and len(cover) > 500:
                return Response({"detail": "Logo URL is too long"}, status=400)
            group.cover_image = cover
            updates.append("cover_image")

        if not updates:
            return Response({"detail": "No changes provided"}, status=400)

        updates.append("updated_at")
        with transaction.atomic():
            group.save(update_fields=updates)
            if "name" in updates:
                Conversation.objects.filter(
                    social_group_id=group.id, conversation_type="group"
                ).update(name=group.name)

        return Response(SocialGroupSerializer(group, context={"request": request}).data)


class SocialGroupJoinView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = SocialGroup.objects.get(id=group_id)
        except SocialGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        membership, created = SocialGroupMembership.objects.get_or_create(
            group=group, user=request.user, defaults={"role": "member"}
        )
        conversation = _group_chat_payload(request.user, group)
        return Response(
            {
                "joined": True,
                "created": created,
                "role": membership.role,
                "group": SocialGroupSerializer(group, context={"request": request}).data,
                "conversation_id": conversation["id"],
                "conversation": conversation,
                "chat_path": f"/app/chat?c={conversation['id']}",
            }
        )


class SocialGroupLeaveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = SocialGroup.objects.get(id=group_id)
        except SocialGroup.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        membership = SocialGroupMembership.objects.filter(
            group=group, user=request.user
        ).first()
        if not membership:
            return Response({"detail": "You are not a member"}, status=400)
        if membership.role == "owner":
            owners = group.memberships.filter(role="owner").count()
            if owners <= 1:
                return Response(
                    {"detail": "Transfer ownership before leaving as the only owner"},
                    status=400,
                )
        membership.delete()
        leave_group_conversation(request.user, group)
        return Response({"left": True})
