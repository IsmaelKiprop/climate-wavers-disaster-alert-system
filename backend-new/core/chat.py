"""Community + responder + DM chat REST APIs."""

from datetime import datetime

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ChatMessage,
    Conversation,
    ConversationMember,
    ResponderMembership,
    SocialGroupMembership,
    UserChatPresence,
)

User = get_user_model()

COMMUNITY_ROOM_KEY = "community:global"
COMMUNITY_NAME = "Climate Wavers Community"


def user_public_dict(user):
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "profile_picture": getattr(user, "profile_picture", None),
    }


def message_dict(msg, current_user_id=None):
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "body": "" if msg.is_deleted else msg.body,
        "is_deleted": msg.is_deleted,
        "client_id": msg.client_id or None,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "sender": user_public_dict(msg.sender),
        "is_mine": bool(current_user_id and msg.sender_id == current_user_id),
    }


def dm_room_key(user_a_id, user_b_id):
    low, high = sorted((int(user_a_id), int(user_b_id)))
    return f"dm:{low}:{high}"


def responder_room_key(org_id):
    return f"responder:{int(org_id)}"


def group_room_key(group_id):
    return f"group:{int(group_id)}"


def ensure_community_conversation(user):
    conv, _ = Conversation.objects.get_or_create(
        room_key=COMMUNITY_ROOM_KEY,
        defaults={
            "conversation_type": "community",
            "name": COMMUNITY_NAME,
            "created_by": user,
        },
    )
    ConversationMember.objects.get_or_create(conversation=conv, user=user)
    return conv


def ensure_responder_conversations(user):
    memberships = (
        ResponderMembership.objects.filter(user=user, org__verification_status="approved")
        .select_related("org")
    )
    rooms = []
    for membership in memberships:
        org = membership.org
        key = responder_room_key(org.id)
        conv, _ = Conversation.objects.get_or_create(
            room_key=key,
            defaults={
                "conversation_type": "responder",
                "name": f"{org.name} Responders",
                "responder_org_id": org.id,
                "created_by": user,
            },
        )
        if not conv.responder_org_id:
            conv.responder_org_id = org.id
            conv.name = conv.name or f"{org.name} Responders"
            conv.save(update_fields=["responder_org_id", "name", "updated_at"])
        ConversationMember.objects.get_or_create(conversation=conv, user=user)
        # Ensure other org members are members of the room
        peer_ids = ResponderMembership.objects.filter(
            org_id=org.id, org__verification_status="approved"
        ).values_list("user_id", flat=True)
        existing = set(
            ConversationMember.objects.filter(conversation=conv).values_list(
                "user_id", flat=True
            )
        )
        to_add = [
            ConversationMember(conversation=conv, user_id=uid)
            for uid in peer_ids
            if uid not in existing
        ]
        if to_add:
            ConversationMember.objects.bulk_create(to_add, ignore_conflicts=True)
        rooms.append(conv)
    return rooms


def ensure_group_conversation(user, group):
    """Create/join the chat room for a SocialGroup. Sync all current members."""
    key = group_room_key(group.id)
    with transaction.atomic():
        conv, _ = Conversation.objects.get_or_create(
            room_key=key,
            defaults={
                "conversation_type": "group",
                "name": group.name,
                "social_group_id": group.id,
                "created_by": user,
            },
        )
        updates = []
        if conv.conversation_type != "group":
            conv.conversation_type = "group"
            updates.append("conversation_type")
        if not conv.social_group_id:
            conv.social_group_id = group.id
            updates.append("social_group_id")
        if conv.name != group.name:
            conv.name = group.name
            updates.append("name")
        if updates:
            updates.append("updated_at")
            conv.save(update_fields=updates)

        ConversationMember.objects.get_or_create(conversation=conv, user=user)
        peer_ids = SocialGroupMembership.objects.filter(group_id=group.id).values_list(
            "user_id", flat=True
        )
        existing = set(
            ConversationMember.objects.filter(conversation=conv).values_list(
                "user_id", flat=True
            )
        )
        to_add = [
            ConversationMember(conversation=conv, user_id=uid)
            for uid in peer_ids
            if uid not in existing
        ]
        if to_add:
            ConversationMember.objects.bulk_create(to_add, ignore_conflicts=True)
    return conv


def ensure_user_group_conversations(user):
    """Ensure every SocialGroup the user belongs to has a chat room in their list."""
    memberships = SocialGroupMembership.objects.filter(user=user).select_related("group")
    rooms = []
    for membership in memberships:
        rooms.append(ensure_group_conversation(user, membership.group))
    return rooms


def leave_group_conversation(user, group):
    """Remove the user from the group chat room (room itself stays for others)."""
    key = group_room_key(group.id)
    conv = Conversation.objects.filter(room_key=key).first()
    if not conv:
        return None
    ConversationMember.objects.filter(conversation=conv, user=user).delete()
    return conv


def ensure_dm_conversation(user, other_user):
    if user.id == other_user.id:
        raise ValueError("Cannot DM yourself")
    key = dm_room_key(user.id, other_user.id)
    with transaction.atomic():
        conv, created = Conversation.objects.get_or_create(
            room_key=key,
            defaults={
                "conversation_type": "dm",
                "name": "",
                "created_by": user,
            },
        )
        ConversationMember.objects.get_or_create(conversation=conv, user=user)
        ConversationMember.objects.get_or_create(conversation=conv, user=other_user)
    return conv


def user_can_access(user, conversation):
    if conversation.conversation_type == "community":
        return True
    if ConversationMember.objects.filter(conversation=conversation, user=user).exists():
        return True
    if conversation.conversation_type == "responder" and conversation.responder_org_id:
        return ResponderMembership.objects.filter(
            org_id=conversation.responder_org_id,
            user=user,
            org__verification_status="approved",
        ).exists()
    if conversation.conversation_type == "group" and conversation.social_group_id:
        return SocialGroupMembership.objects.filter(
            group_id=conversation.social_group_id,
            user=user,
        ).exists()
    return False


def conversation_title(conv, current_user, members_by_conv=None):
    if conv.conversation_type == "community":
        return conv.name or COMMUNITY_NAME
    if conv.conversation_type == "group":
        if conv.social_group_id and getattr(conv, "social_group", None):
            return conv.name or conv.social_group.name
        return conv.name or "Group chat"
    if conv.conversation_type == "responder":
        if conv.responder_org_id and getattr(conv, "responder_org", None):
            return conv.name or f"{conv.responder_org.name} Responders"
        return conv.name or "Responder chat"
    # DM: show other person's name
    members = None
    if members_by_conv is not None:
        members = members_by_conv.get(conv.id)
    if members is None:
        members = list(conv.memberships.select_related("user").all())
    other = next((m.user for m in members if m.user_id != current_user.id), None)
    if other:
        full = f"{other.first_name or ''} {other.last_name or ''}".strip()
        return full or other.username
    return "Direct message"


def conversation_dict(conv, current_user, *, last_message=None, unread=0, members=None, online_ids=None):
    members = members or list(conv.memberships.select_related("user").all())
    peer = None
    if conv.conversation_type == "dm":
        peer_user = next((m.user for m in members if m.user_id != current_user.id), None)
        peer = user_public_dict(peer_user)
        if peer and online_ids is not None:
            peer["is_online"] = peer_user.id in online_ids if peer_user else False
            presence = getattr(peer_user, "chat_presence", None) if peer_user else None
            peer["last_seen"] = (
                presence.last_seen.isoformat() if presence and presence.last_seen else None
            )

    online_members = []
    if online_ids is not None and conv.conversation_type != "dm":
        online_members = [
            user_public_dict(m.user)
            for m in members
            if m.user_id in online_ids and m.user_id != current_user.id
        ][:20]

    avatar = None
    description = ""
    if conv.conversation_type == "group" and getattr(conv, "social_group", None):
        avatar = conv.social_group.cover_image or None
        description = conv.social_group.description or ""

    return {
        "id": conv.id,
        "conversation_type": conv.conversation_type,
        "room_key": conv.room_key,
        "name": conversation_title(conv, current_user, {conv.id: members}),
        "avatar": avatar,
        "description": description,
        "responder_org_id": conv.responder_org_id,
        "social_group_id": conv.social_group_id,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "member_count": len(members),
        "unread_count": unread,
        "last_message": last_message,
        "peer": peer,
        "online_members": online_members,
        "online_count": len(online_members) if conv.conversation_type != "dm" else (
            1 if peer and peer.get("is_online") else 0
        ),
    }


def broadcast_chat_event(conversation_id, event_type, payload, *, member_user_ids=None):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    event = {
        "type": "chat.event",
        "event": event_type,
        "payload": payload,
    }
    # Typing/read use the conversation room.
    # Messages: personal hubs for DMs/responder; community also hits the room
    # so every connected chat client hears it even before first open.
    if event_type == "message":
        conv = Conversation.objects.filter(id=conversation_id).only(
            "conversation_type"
        ).first()
        ids = member_user_ids
        if ids is None:
            ids = list(
                ConversationMember.objects.filter(
                    conversation_id=conversation_id
                ).values_list("user_id", flat=True)
            )
        for uid in ids or []:
            async_to_sync(channel_layer.group_send)(f"chat_user_{uid}", event)
        if conv and conv.conversation_type == "community":
            async_to_sync(channel_layer.group_send)(
                f"chat_{conversation_id}", event
            )
        return
    async_to_sync(channel_layer.group_send)(f"chat_{conversation_id}", event)


def broadcast_presence(user_id, is_online, last_seen=None):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        "chat_presence",
        {
            "type": "presence.event",
            "payload": {
                "user_id": user_id,
                "is_online": is_online,
                "last_seen": last_seen,
            },
        },
    )


def online_user_ids(window_seconds=120):
    """Union of live chat sockets and recent app heartbeats (User.last_seen)."""
    from datetime import timedelta

    ids = set(
        UserChatPresence.objects.filter(is_online=True).values_list("user_id", flat=True)
    )
    cutoff = timezone.now() - timedelta(seconds=max(30, int(window_seconds or 120)))
    ids.update(
        User.objects.filter(is_active=True, last_seen__gte=cutoff).values_list(
            "id", flat=True
        )
    )
    return ids


class ChatBootstrapView(APIView):
    """Ensure community + responder rooms exist, return conversation list."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        ensure_community_conversation(user)
        ensure_responder_conversations(user)
        ensure_user_group_conversations(user)

        memberships = (
            ConversationMember.objects.filter(user=user)
            .select_related(
                "conversation",
                "conversation__responder_org",
                "conversation__social_group",
            )
        )
        conv_ids = [m.conversation_id for m in memberships]
        # Also include community even if membership somehow missing
        community = Conversation.objects.filter(room_key=COMMUNITY_ROOM_KEY).first()
        if community and community.id not in conv_ids:
            ConversationMember.objects.get_or_create(conversation=community, user=user)
            conv_ids.append(community.id)

        conversations = list(
            Conversation.objects.filter(id__in=conv_ids)
            .select_related("responder_org", "social_group")
            .annotate(member_total=Count("memberships", distinct=True))
            .order_by("-updated_at")
        )

        last_msgs = {}
        for msg in (
            ChatMessage.objects.filter(conversation_id__in=conv_ids, is_deleted=False)
            .select_related("sender")
            .order_by("conversation_id", "-created_at")
        ):
            if msg.conversation_id not in last_msgs:
                last_msgs[msg.conversation_id] = msg

        member_map = {}
        for mem in ConversationMember.objects.filter(
            conversation_id__in=conv_ids
        ).select_related("user", "user__chat_presence"):
            member_map.setdefault(mem.conversation_id, []).append(mem)

        my_membership = {m.conversation_id: m for m in memberships}
        online = online_user_ids()

        payload = []
        for conv in conversations:
            members = member_map.get(conv.id, [])
            last = last_msgs.get(conv.id)
            last_payload = message_dict(last, user.id) if last else None
            mine = my_membership.get(conv.id)
            unread = 0
            if mine and last:
                if mine.last_read_at is None or last.created_at > mine.last_read_at:
                    unread = ChatMessage.objects.filter(
                        conversation=conv,
                        is_deleted=False,
                        created_at__gt=mine.last_read_at or mine.joined_at,
                    ).exclude(sender=user).count()
            item = conversation_dict(
                conv,
                user,
                last_message=last_payload,
                unread=unread,
                members=members,
                online_ids=online,
            )
            item["member_count"] = getattr(conv, "member_total", None) or len(members)
            payload.append(item)

        # Sort: unread first, then most recently updated
        def sort_key(c):
            ts = 0
            raw = c.get("updated_at")
            if raw:
                try:
                    ts = datetime.fromisoformat(
                        str(raw).replace("Z", "+00:00")
                    ).timestamp()
                except (TypeError, ValueError):
                    ts = 0
            return (0 if c.get("unread_count") else 1, -ts)

        payload.sort(key=sort_key)

        return Response(
            {
                "conversations": payload,
                "online_user_ids": list(online),
                "me": user_public_dict(user),
            }
        )


class ChatDirectMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        other_id = request.data.get("user_id")
        try:
            other_id = int(other_id)
        except (TypeError, ValueError):
            return Response({"detail": "user_id is required"}, status=400)
        try:
            other = User.objects.get(id=other_id, is_active=True)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)
        try:
            conv = ensure_dm_conversation(request.user, other)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        members = list(conv.memberships.select_related("user", "user__chat_presence"))
        return Response(
            conversation_dict(
                conv,
                request.user,
                members=members,
                online_ids=online_user_ids(),
            )
        )


class ChatMessageListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if not user_can_access(request.user, conv):
            return Response({"detail": "Forbidden"}, status=403)
        ConversationMember.objects.get_or_create(conversation=conv, user=request.user)

        before = request.query_params.get("before")
        try:
            limit = min(int(request.query_params.get("limit") or 50), 100)
        except (TypeError, ValueError):
            limit = 50

        qs = ChatMessage.objects.filter(conversation=conv).select_related("sender")
        if before:
            try:
                qs = qs.filter(id__lt=int(before))
            except (TypeError, ValueError):
                pass
        messages = list(qs.order_by("-created_at")[:limit])
        messages.reverse()
        return Response(
            {
                "conversation_id": conv.id,
                "messages": [message_dict(m, request.user.id) for m in messages],
                "has_more": len(messages) == limit,
            }
        )

    def post(self, request, conversation_id):
        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if not user_can_access(request.user, conv):
            return Response({"detail": "Forbidden"}, status=403)

        body = (request.data.get("body") or "").strip()
        if not body:
            return Response({"detail": "Message body is required"}, status=400)
        if len(body) > 4000:
            return Response({"detail": "Message too long"}, status=400)

        client_id = (request.data.get("client_id") or "")[:64]
        if client_id:
            existing = ChatMessage.objects.filter(
                conversation=conv, sender=request.user, client_id=client_id
            ).select_related("sender").first()
            if existing:
                return Response(message_dict(existing, request.user.id))

        ConversationMember.objects.get_or_create(conversation=conv, user=request.user)
        msg = ChatMessage.objects.create(
            conversation=conv,
            sender=request.user,
            body=body,
            client_id=client_id,
        )
        Conversation.objects.filter(id=conv.id).update(updated_at=timezone.now())
        ConversationMember.objects.filter(
            conversation=conv, user=request.user
        ).update(last_read_at=timezone.now(), last_read_message_id=msg.id)

        payload = message_dict(msg, request.user.id)
        broadcast_chat_event(conv.id, "message", payload)
        return Response(payload, status=201)


class ChatMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        if not user_can_access(request.user, conv):
            return Response({"detail": "Forbidden"}, status=403)

        message_id = request.data.get("message_id")
        now = timezone.now()
        member, _ = ConversationMember.objects.get_or_create(
            conversation=conv, user=request.user
        )
        member.last_read_at = now
        if message_id:
            try:
                member.last_read_message_id = int(message_id)
            except (TypeError, ValueError):
                pass
        else:
            last = (
                ChatMessage.objects.filter(conversation=conv)
                .order_by("-id")
                .values_list("id", flat=True)
                .first()
            )
            if last:
                member.last_read_message_id = last
        member.save(
            update_fields=["last_read_at", "last_read_message_id"]
        )

        broadcast_chat_event(
            conv.id,
            "read",
            {
                "conversation_id": conv.id,
                "user_id": request.user.id,
                "message_id": member.last_read_message_id,
                "read_at": now.isoformat(),
            },
        )
        return Response({"ok": True, "message_id": member.last_read_message_id})


class ChatPresenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        online = list(
            UserChatPresence.objects.filter(is_online=True).values(
                "user_id", "last_seen", "is_online"
            )
        )
        for row in online:
            if row.get("last_seen"):
                row["last_seen"] = row["last_seen"].isoformat()
        return Response({"online": online})


class ChatDirectoryView(APIView):
    """People you can start a DM with: followers + responder peers."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Follow

        user = request.user
        q = (request.query_params.get("q") or "").strip()
        following_ids = Follow.objects.filter(follower=user).values_list(
            "following_id", flat=True
        )
        follower_ids = Follow.objects.filter(following=user).values_list(
            "follower_id", flat=True
        )
        org_ids = ResponderMembership.objects.filter(
            user=user, org__verification_status="approved"
        ).values_list("org_id", flat=True)
        peer_ids = ResponderMembership.objects.filter(
            org_id__in=org_ids
        ).exclude(user=user).values_list("user_id", flat=True)

        ids = set(following_ids) | set(follower_ids) | set(peer_ids)
        qs = User.objects.filter(id__in=ids, is_active=True)
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
        users = list(qs.select_related("chat_presence").order_by("first_name", "username")[:40])
        online = online_user_ids()
        results = []
        for u in users:
            item = user_public_dict(u)
            item["is_online"] = u.id in online
            presence = getattr(u, "chat_presence", None)
            item["last_seen"] = (
                presence.last_seen.isoformat() if presence and presence.last_seen else None
            )
            results.append(item)
        results.sort(key=lambda x: (0 if x["is_online"] else 1, (x.get("first_name") or "").lower()))
        return Response({"users": results})
