"""Realtime community chat: messages, typing, presence."""

import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Single hub socket per user.
    Clients join conversation groups and exchange live events.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        self.user = user
        self.user_id = user.id
        self.joined_rooms = set()
        self.presence_group = "chat_presence"
        self.user_group = f"chat_user_{self.user_id}"

        await self.channel_layer.group_add(self.presence_group, self.channel_name)
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

        community_id = await self._ensure_community_and_responder_rooms()
        if community_id:
            await self.channel_layer.group_add(
                f"chat_{community_id}", self.channel_name
            )
            self.joined_rooms.add(community_id)

        last_seen = await self._set_presence(online=True)
        await self.channel_layer.group_send(
            self.presence_group,
            {
                "type": "presence.event",
                "payload": {
                    "user_id": self.user_id,
                    "is_online": True,
                    "last_seen": last_seen,
                },
            },
        )
        await self.send_json(
            {
                "event": "connected",
                "payload": {"user_id": self.user_id, "is_online": True},
            }
        )

    async def disconnect(self, close_code):
        for room_id in list(getattr(self, "joined_rooms", set())):
            await self.channel_layer.group_discard(
                f"chat_{room_id}", self.channel_name
            )
        if getattr(self, "presence_group", None):
            await self.channel_layer.group_discard(
                self.presence_group, self.channel_name
            )
        if getattr(self, "user_group", None):
            await self.channel_layer.group_discard(
                self.user_group, self.channel_name
            )

        if getattr(self, "user_id", None):
            last_seen = await self._set_presence(online=False)
            if last_seen is not None:
                await self.channel_layer.group_send(
                    "chat_presence",
                    {
                        "type": "presence.event",
                        "payload": {
                            "user_id": self.user_id,
                            "is_online": False,
                            "last_seen": last_seen,
                        },
                    },
                )

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_json({"event": "error", "payload": {"detail": "Invalid JSON"}})
            return

        action = data.get("action") or data.get("type")
        payload = data.get("payload") or data

        handlers = {
            "ping": self._handle_ping,
            "join": self._handle_join,
            "leave": self._handle_leave,
            "send_message": self._handle_send_message,
            "typing_start": self._handle_typing_start,
            "typing_stop": self._handle_typing_stop,
            "mark_read": self._handle_mark_read,
            "heartbeat": self._handle_ping,
        }
        handler = handlers.get(action)
        if not handler:
            await self.send_json(
                {"event": "error", "payload": {"detail": f"Unknown action: {action}"}}
            )
            return
        try:
            await handler(payload)
        except Exception:
            logger.exception("Chat WS action failed: %s", action)
            await self.send_json(
                {"event": "error", "payload": {"detail": "Action failed"}}
            )

    async def _handle_ping(self, payload):
        last_seen = await self._touch_presence()
        await self.send_json(
            {
                "event": "pong",
                "payload": {
                    "ts": timezone.now().isoformat(),
                    "last_seen": last_seen,
                },
            }
        )

    async def _handle_join(self, payload):
        conversation_id = payload.get("conversation_id")
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            await self.send_json(
                {"event": "error", "payload": {"detail": "conversation_id required"}}
            )
            return

        allowed = await self._can_access(conversation_id)
        if not allowed:
            await self.send_json(
                {"event": "error", "payload": {"detail": "Forbidden"}}
            )
            return

        group = f"chat_{conversation_id}"
        if conversation_id not in self.joined_rooms:
            await self.channel_layer.group_add(group, self.channel_name)
            self.joined_rooms.add(conversation_id)

        await self.send_json(
            {
                "event": "joined",
                "payload": {"conversation_id": conversation_id},
            }
        )

    async def _handle_leave(self, payload):
        conversation_id = payload.get("conversation_id")
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return
        if conversation_id in self.joined_rooms:
            await self.channel_layer.group_discard(
                f"chat_{conversation_id}", self.channel_name
            )
            self.joined_rooms.discard(conversation_id)

    async def _handle_send_message(self, payload):
        conversation_id = payload.get("conversation_id")
        body = (payload.get("body") or "").strip()
        media_url = (payload.get("media_url") or "").strip()
        media_type = (payload.get("media_type") or "").strip().lower()
        mentions = payload.get("mentions") or []
        client_id = (payload.get("client_id") or "")[:64]
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            await self.send_json(
                {"event": "error", "payload": {"detail": "conversation_id required"}}
            )
            return
        if not body and not media_url:
            await self.send_json(
                {"event": "error", "payload": {"detail": "Empty message"}}
            )
            return
        if len(body) > 4000:
            await self.send_json(
                {"event": "error", "payload": {"detail": "Message too long"}}
            )
            return

        msg = await self._create_message(
            conversation_id,
            body,
            client_id,
            media_url=media_url,
            media_type=media_type,
            mentions=mentions,
        )
        if not msg:
            await self.send_json(
                {"event": "error", "payload": {"detail": "Forbidden or not found"}}
            )
            return

        member_ids = await self._member_ids(conversation_id)
        event = {
            "type": "chat.event",
            "event": "message",
            "payload": msg,
        }
        for uid in member_ids:
            await self.channel_layer.group_send(f"chat_user_{uid}", event)
        if await self._is_community(conversation_id):
            await self.channel_layer.group_send(f"chat_{conversation_id}", event)

    async def _handle_typing_start(self, payload):
        await self._broadcast_typing(payload, True)

    async def _handle_typing_stop(self, payload):
        await self._broadcast_typing(payload, False)

    async def _broadcast_typing(self, payload, is_typing):
        conversation_id = payload.get("conversation_id")
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return
        if conversation_id not in self.joined_rooms:
            allowed = await self._can_access(conversation_id)
            if not allowed:
                return
            await self.channel_layer.group_add(
                f"chat_{conversation_id}", self.channel_name
            )
            self.joined_rooms.add(conversation_id)

        user_payload = await self._user_public()
        await self.channel_layer.group_send(
            f"chat_{conversation_id}",
            {
                "type": "chat.event",
                "event": "typing",
                "payload": {
                    "conversation_id": conversation_id,
                    "is_typing": is_typing,
                    "user": user_payload,
                },
                "exclude_user_id": self.user_id,
            },
        )

    async def _handle_mark_read(self, payload):
        conversation_id = payload.get("conversation_id")
        message_id = payload.get("message_id")
        try:
            conversation_id = int(conversation_id)
        except (TypeError, ValueError):
            return
        result = await self._mark_read(conversation_id, message_id)
        if not result:
            return
        await self.channel_layer.group_send(
            f"chat_{conversation_id}",
            {
                "type": "chat.event",
                "event": "read",
                "payload": result,
            },
        )

    async def chat_event(self, event):
        if event.get("exclude_user_id") == self.user_id:
            return
        await self.send_json(
            {
                "event": event.get("event"),
                "payload": event.get("payload"),
            }
        )

    async def presence_event(self, event):
        await self.send_json(
            {
                "event": "presence",
                "payload": event.get("payload"),
            }
        )

    async def send_json(self, content):
        await self.send(text_data=json.dumps(content, default=str))

    @database_sync_to_async
    def _set_presence(self, online):
        from django.contrib.auth import get_user_model

        from .models import UserChatPresence

        User = get_user_model()
        now = timezone.now()
        presence, _ = UserChatPresence.objects.get_or_create(user_id=self.user_id)
        if online:
            presence.connection_count = (presence.connection_count or 0) + 1
            presence.is_online = True
        else:
            presence.connection_count = max((presence.connection_count or 1) - 1, 0)
            presence.is_online = presence.connection_count > 0
        presence.last_seen = now
        presence.save(update_fields=["is_online", "last_seen", "connection_count"])
        User.objects.filter(pk=self.user_id).update(last_seen=now)
        # Only broadcast offline when truly offline
        if online or not presence.is_online:
            return presence.last_seen.isoformat()
        return None

    @database_sync_to_async
    def _touch_presence(self):
        from django.contrib.auth import get_user_model

        from .models import UserChatPresence

        User = get_user_model()
        now = timezone.now()
        presence, _ = UserChatPresence.objects.get_or_create(user_id=self.user_id)
        presence.is_online = True
        presence.last_seen = now
        if presence.connection_count < 1:
            presence.connection_count = 1
        presence.save(update_fields=["is_online", "last_seen", "connection_count"])
        User.objects.filter(pk=self.user_id).update(last_seen=now)
        return presence.last_seen.isoformat()

    @database_sync_to_async
    def _can_access(self, conversation_id):
        from .chat import ensure_community_conversation, user_can_access
        from .models import Conversation, ConversationMember

        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return False
        if conv.conversation_type == "community":
            ensure_community_conversation(self.user)
        if not user_can_access(self.user, conv):
            return False
        ConversationMember.objects.get_or_create(conversation=conv, user=self.user)
        return True

    @database_sync_to_async
    def _create_message(
        self,
        conversation_id,
        body,
        client_id,
        media_url="",
        media_type="",
        mentions=None,
    ):
        from .chat import (
            _normalize_mentions,
            message_dict,
            notify_chat_mentions,
            user_can_access,
        )
        from .models import ChatMessage, Conversation, ConversationMember

        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return None
        if not user_can_access(self.user, conv):
            return None
        if client_id:
            existing = (
                ChatMessage.objects.filter(
                    conversation=conv, sender=self.user, client_id=client_id
                )
                .select_related("sender")
                .first()
            )
            if existing:
                return message_dict(existing, self.user_id)

        media_url = (media_url or "").strip()
        media_type = (media_type or "").strip().lower()
        if media_type and media_type not in {"image", "video", "audio", "file"}:
            media_type = "file"
        if not media_url:
            media_type = ""
        mention_rows = _normalize_mentions(mentions)

        ConversationMember.objects.get_or_create(conversation=conv, user=self.user)
        msg = ChatMessage.objects.create(
            conversation=conv,
            sender=self.user,
            body=body or "",
            media_url=media_url,
            media_type=media_type,
            mentions=mention_rows,
            client_id=client_id or "",
        )
        Conversation.objects.filter(id=conv.id).update(updated_at=timezone.now())
        ConversationMember.objects.filter(
            conversation=conv, user=self.user
        ).update(last_read_at=timezone.now(), last_read_message_id=msg.id)
        notify_chat_mentions(msg, sender=self.user)
        return message_dict(msg, self.user_id)

    @database_sync_to_async
    def _mark_read(self, conversation_id, message_id):
        from .chat import user_can_access
        from .models import ChatMessage, Conversation, ConversationMember

        try:
            conv = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return None
        if not user_can_access(self.user, conv):
            return None
        member, _ = ConversationMember.objects.get_or_create(
            conversation=conv, user=self.user
        )
        now = timezone.now()
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
        member.save(update_fields=["last_read_at", "last_read_message_id"])
        return {
            "conversation_id": conversation_id,
            "user_id": self.user_id,
            "message_id": member.last_read_message_id,
            "read_at": now.isoformat(),
        }

    @database_sync_to_async
    def _user_public(self):
        from .chat import user_public_dict

        return user_public_dict(self.user)

    @database_sync_to_async
    def _member_ids(self, conversation_id):
        from .models import ConversationMember

        return list(
            ConversationMember.objects.filter(
                conversation_id=conversation_id
            ).values_list("user_id", flat=True)
        )

    @database_sync_to_async
    def _is_community(self, conversation_id):
        from .models import Conversation

        return Conversation.objects.filter(
            id=conversation_id, conversation_type="community"
        ).exists()

    @database_sync_to_async
    def _ensure_community_and_responder_rooms(self):
        from .chat import ensure_community_conversation, ensure_responder_conversations

        conv = ensure_community_conversation(self.user)
        ensure_responder_conversations(self.user)
        return conv.id
