"""Climate Action Calendar + Jitsi conference rooms."""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import (
    ChatMessage,
    ClimateEvent,
    ClimateEventInvite,
    Conversation,
    ConversationMember,
    Disaster,
    Notification,
    ResponderMembership,
    SocialGroupMembership,
    TreeAdminMembership,
    TreeProject,
)
from .signals import send_to_websocket

logger = logging.getLogger(__name__)


def new_jitsi_room() -> str:
    return f"cw-{uuid.uuid4().hex}"


def display_name_for(user) -> str:
    full = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
    return full or user.username or (user.email or "Climate Wavers member")


def user_can_host_ops(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    if TreeAdminMembership.objects.filter(user=user).exists():
        return True
    if ResponderMembership.objects.filter(user=user).exists():
        return True
    if SocialGroupMembership.objects.filter(user=user, role__in=("owner", "admin")).exists():
        return True
    return False


def user_can_access_event(user, event: ClimateEvent) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    if event.host_id == user.id:
        return True
    if ClimateEventInvite.objects.filter(event=event, user=user).exists():
        return True
    if event.visibility == "public":
        return True
    if event.visibility == "org":
        if event.tree_admin_org_id and TreeAdminMembership.objects.filter(
            user=user, org_id=event.tree_admin_org_id
        ).exists():
            return True
        if event.responder_org_id and ResponderMembership.objects.filter(
            user=user, org_id=event.responder_org_id
        ).exists():
            return True
        if event.social_group_id and SocialGroupMembership.objects.filter(
            user=user, group_id=event.social_group_id
        ).exists():
            return True
    if event.conversation_id and ConversationMember.objects.filter(
        conversation_id=event.conversation_id, user=user
    ).exists():
        return True
    return False


def events_visible_to(user):
    if not user or not user.is_authenticated:
        return ClimateEvent.objects.none()
    if user.is_superuser or user.is_staff:
        return ClimateEvent.objects.all()

    tree_org_ids = list(
        TreeAdminMembership.objects.filter(user=user).values_list("org_id", flat=True)
    )
    responder_org_ids = list(
        ResponderMembership.objects.filter(user=user).values_list("org_id", flat=True)
    )
    group_ids = list(
        SocialGroupMembership.objects.filter(user=user).values_list("group_id", flat=True)
    )
    conv_ids = list(
        ConversationMember.objects.filter(user=user).values_list("conversation_id", flat=True)
    )

    return ClimateEvent.objects.filter(
        Q(host=user)
        | Q(invites__user=user)
        | Q(visibility="public")
        | Q(visibility="org", tree_admin_org_id__in=tree_org_ids)
        | Q(visibility="org", responder_org_id__in=responder_org_ids)
        | Q(visibility="org", social_group_id__in=group_ids)
        | Q(conversation_id__in=conv_ids)
    ).distinct()


def notify_climate_event(user, event: ClimateEvent, message: str):
    if not user:
        return
    notice = Notification.objects.create(
        user=user,
        notification_type="climate_event",
        content_type=ContentType.objects.get_for_model(ClimateEvent),
        object_id=event.id,
        message=message,
    )
    try:
        send_to_websocket(
            notice.id,
            user.username,
            message,
            event.host,
            "climate_event",
            content={
                "event_id": event.id,
                "title": event.title,
                "event_type": event.event_type,
                "starts_at": event.starts_at.isoformat() if event.starts_at else None,
                "join_path": f"/app/calendar/events/{event.id}/join",
                "jitsi_room": event.jitsi_room,
            },
        )
    except Exception:
        pass


def _event_join_url(event: ClimateEvent) -> str:
    from django.conf import settings as dj_settings

    base = (
        getattr(dj_settings, "FRONTEND_URL", None)
        or getattr(dj_settings, "SITE_URL", None)
        or "https://alerts.flowops.africa"
    ).rstrip("/")
    return f"{base}/app/calendar/events/{event.id}"


def _send_climate_event_mail(
    *,
    to_email: str,
    subject: str,
    body: str,
    event: ClimateEvent,
    kind: str = "invite",
):
    """Deliver climate-event mail via Resend (SMTP is blocked on Render)."""
    email = str(to_email or "").strip()
    if not email or "@" not in email or email.endswith("@example.com"):
        return False
    payload = {
        "email": email,
        "data": {"subject": subject, "content": body},
    }
    try:
        from api.tasks import _send_resend

        _send_resend("custom_mail", payload)
        logger.info(
            "Climate %s email sent via Resend to %s event=%s",
            kind,
            email,
            event.id,
        )
        return True
    except Exception as exc:
        logger.warning(
            "Climate %s Resend failed to %s event=%s: %s",
            kind,
            email,
            event.id,
            exc,
        )
    try:
        from api.tasks import _post_notification

        _post_notification({"type": "custom_mail", **payload})
        logger.info(
            "Climate %s email sent via notification service to %s event=%s",
            kind,
            email,
            event.id,
        )
        return True
    except Exception as exc:
        logger.warning(
            "Climate %s email failed to %s event=%s: %s",
            kind,
            email,
            event.id,
            exc,
        )
        return False


def send_climate_invite_email(event: ClimateEvent, to_email: str, invitee_name: str = ""):
    """Send invite via Resend (SMTP is blocked on Render)."""
    email = str(to_email or "").strip()
    if not email or "@" not in email or email.endswith("@example.com"):
        return False

    when = ""
    if event.starts_at:
        when = event.starts_at.strftime("%a %d %b %Y, %H:%M UTC")
    join_url = _event_join_url(event)
    who = invitee_name or email
    host = display_name_for(event.host) if event.host_id else "Climate Wavers"
    subject = f"You're invited: {event.title} — Climate Wavers"
    body = (
        f"Hi {who},\n\n"
        f"{host} invited you to a Climate Wavers event.\n\n"
        f"Event: {event.title}\n"
        f"Type: {event.get_event_type_display()}\n"
        f"When: {when or 'See calendar'}\n\n"
        f"{(event.description or '').strip()[:500]}\n\n"
        f"Open / RSVP / join the Climate room:\n{join_url}\n\n"
        f"Accept the invite on the calendar to receive reminders before it starts.\n\n"
        f"— Climate Wavers\n"
    )
    return _send_climate_event_mail(
        to_email=email,
        subject=subject,
        body=body,
        event=event,
        kind="invite",
    )


def send_climate_reminder_email(
    event: ClimateEvent,
    to_email: str,
    invitee_name: str = "",
    *,
    when_label: str = "soon",
):
    """Remind an accepted invitee (or host) before the event starts."""
    email = str(to_email or "").strip()
    if not email or "@" not in email or email.endswith("@example.com"):
        return False

    when = ""
    if event.starts_at:
        when = event.starts_at.strftime("%a %d %b %Y, %H:%M UTC")
    join_url = _event_join_url(event)
    who = invitee_name or email
    subject = f"Reminder: {event.title} — {when_label}"
    body = (
        f"Hi {who},\n\n"
        f"Reminder: your Climate Wavers event is {when_label}.\n\n"
        f"Event: {event.title}\n"
        f"Type: {event.get_event_type_display()}\n"
        f"When: {when or 'See calendar'}\n\n"
        f"Join the Climate room:\n{join_url}\n\n"
        f"— Climate Wavers\n"
    )
    return _send_climate_event_mail(
        to_email=email,
        subject=subject,
        body=body,
        event=event,
        kind="reminder",
    )


def invite_receives_reminders(invite: ClimateEventInvite) -> bool:
    """Hosts and accepted (yes) invitees get reminders; pending/maybe/no do not."""
    if invite.role == "host":
        return True
    return invite.rsvp == "yes"


def _invite_email_address(invite: ClimateEventInvite) -> str:
    if invite.user_id and (invite.user.email or "").strip():
        return (invite.user.email or "").strip()
    return (invite.email or "").strip()


def deliver_event_reminder(
    invite: ClimateEventInvite,
    event: ClimateEvent,
    message: str,
    *,
    when_label: str,
):
    """In-app + email reminder for one invitee, respecting notify flags."""
    delivered = False
    if invite.notify_in_app and invite.user_id:
        notify_climate_event(invite.user, event, message)
        delivered = True
    if invite.notify_email:
        to_email = _invite_email_address(invite)
        if to_email:
            name = display_name_for(invite.user) if invite.user_id else ""
            if send_climate_reminder_email(
                event, to_email, name, when_label=when_label
            ):
                delivered = True
    return delivered


def _deliver_invite_notice(
    event: ClimateEvent,
    invite: ClimateEventInvite,
    *,
    notify: bool,
    send_email: bool,
):
    """Always deliver in-app + email when requested (including re-invites)."""
    user = invite.user
    if notify and user is not None:
        notify_climate_event(user, event, f"You're invited: {event.title}")
        logger.info(
            "Climate invite in-app notify user=%s event=%s",
            getattr(user, "username", user.id),
            event.id,
        )
    if not send_email:
        return
    to_email = ""
    name = ""
    if user is not None:
        to_email = (user.email or "").strip()
        name = display_name_for(user)
    if not to_email:
        to_email = (invite.email or "").strip()
    if to_email:
        send_climate_invite_email(event, to_email, name)


def invite_users(
    event: ClimateEvent,
    user_ids,
    role="attendee",
    notify=True,
    send_email=True,
):
    invited = []
    for uid in user_ids or []:
        try:
            uid_int = int(uid)
        except (TypeError, ValueError):
            continue
        if not uid_int or uid_int == event.host_id:
            continue
        invite, created = ClimateEventInvite.objects.get_or_create(
            event=event,
            user_id=uid_int,
            defaults={
                "role": role,
                "rsvp": "pending",
                "email": "",
                "notify_in_app": notify,
                "notify_email": send_email,
            },
        )
        if not created:
            dirty = []
            if invite.notify_in_app != notify:
                invite.notify_in_app = notify
                dirty.append("notify_in_app")
            if invite.notify_email != send_email:
                invite.notify_email = send_email
                dirty.append("notify_email")
            if dirty:
                invite.save(update_fields=[*dirty, "updated_at"])
        if invite.user_id:
            invite = (
                ClimateEventInvite.objects.select_related("user").get(pk=invite.pk)
            )
        _deliver_invite_notice(
            event, invite, notify=notify, send_email=send_email
        )
        invited.append(invite)
        logger.info(
            "Climate invite user event=%s user_id=%s created=%s notify=%s email=%s",
            event.id,
            uid_int,
            created,
            notify,
            send_email,
        )
    return invited


def invite_emails(
    event: ClimateEvent,
    emails,
    role="attendee",
    notify=True,
    send_email=True,
):
    """Invite by email: match Climate Wavers users when possible, else email-only invite."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    invited = []
    seen = set()
    for raw in emails or []:
        email = str(raw or "").strip().lower()
        if not email or "@" not in email or email in seen:
            continue
        seen.add(email)
        user = User.objects.filter(email__iexact=email).first()
        if user and user.id == event.host_id:
            continue
        if user:
            created_list = invite_users(
                event,
                [user.id],
                role=role,
                notify=notify,
                send_email=send_email,
            )
            invited.extend(created_list)
            continue
        invite, created = ClimateEventInvite.objects.get_or_create(
            event=event,
            email=email,
            defaults={
                "user": None,
                "role": role,
                "rsvp": "pending",
                "notify_in_app": False,
                "notify_email": send_email,
            },
        )
        if not created and invite.notify_email != send_email:
            invite.notify_email = send_email
            invite.save(update_fields=["notify_email", "updated_at"])
        _deliver_invite_notice(
            event, invite, notify=False, send_email=send_email
        )
        invited.append(invite)
        logger.info(
            "Climate invite email-only event=%s email=%s created=%s send_email=%s",
            event.id,
            email,
            created,
            send_email,
        )
    return invited


def apply_invites(
    event: ClimateEvent,
    *,
    user_ids=None,
    emails=None,
    notify=True,
    send_email=True,
):
    user_ids = list(user_ids or [])
    emails = list(emails or [])
    logger.info(
        "apply_invites event=%s user_ids=%s emails=%s notify=%s send_email=%s",
        event.id,
        user_ids,
        emails,
        notify,
        send_email,
    )
    created = []
    created.extend(
        invite_users(
            event, user_ids, notify=notify, send_email=send_email
        )
    )
    created.extend(
        invite_emails(
            event, emails, notify=notify, send_email=send_email
        )
    )
    return created


def post_event_chat_link(event: ClimateEvent, body: str | None = None):
    if not event.conversation_id or not event.host_id:
        return None
    text = body or (
        f"📅 {event.title}\n"
        f"Join Climate Briefing: /app/calendar/events/{event.id}/join"
    )
    return ChatMessage.objects.create(
        conversation_id=event.conversation_id,
        sender_id=event.host_id,
        body=text,
        client_id=f"climate-event-{event.id}-{uuid.uuid4().hex[:8]}",
    )


def ensure_host_invite(event: ClimateEvent):
    ClimateEventInvite.objects.get_or_create(
        event=event,
        user_id=event.host_id,
        defaults={"role": "host", "rsvp": "yes"},
    )


class ClimateEventInviteSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()

    class Meta:
        model = ClimateEventInvite
        fields = (
            "id",
            "user",
            "username",
            "user_name",
            "email",
            "role",
            "rsvp",
            "notify_in_app",
            "notify_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_user_name(self, obj):
        if obj.user_id:
            return display_name_for(obj.user)
        return obj.email or "Invitee"

    def get_username(self, obj):
        if obj.user_id:
            return obj.user.username
        return ""


class ClimateEventSerializer(serializers.ModelSerializer):
    host_name = serializers.SerializerMethodField()
    my_rsvp = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()
    invite_count = serializers.SerializerMethodField()
    invites = serializers.SerializerMethodField()
    tree_project_name = serializers.CharField(
        source="tree_project.name", read_only=True, default=None
    )
    disaster_title = serializers.SerializerMethodField()
    join_path = serializers.SerializerMethodField()
    trees_gifted = serializers.SerializerMethodField()
    gift_count = serializers.SerializerMethodField()
    gift_path = serializers.SerializerMethodField()
    is_observance = serializers.SerializerMethodField()

    class Meta:
        model = ClimateEvent
        fields = (
            "id",
            "title",
            "description",
            "event_type",
            "starts_at",
            "ends_at",
            "timezone",
            "status",
            "visibility",
            "host",
            "host_name",
            "disaster",
            "disaster_title",
            "tree_project",
            "tree_project_name",
            "tree_admin_org",
            "responder_org",
            "social_group",
            "conversation",
            "jitsi_room",
            "allow_tree_gifts",
            "trees_gifted",
            "gift_count",
            "gift_path",
            "is_observance",
            "my_rsvp",
            "my_role",
            "can_join",
            "invite_count",
            "invites",
            "join_path",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "host",
            "jitsi_room",
            "created_at",
            "updated_at",
        )

    def get_host_name(self, obj):
        return display_name_for(obj.host)

    def get_disaster_title(self, obj):
        if not obj.disaster_id:
            return None
        return getattr(obj.disaster, "title", None) or getattr(obj.disaster, "name", None)

    def get_join_path(self, obj):
        return f"/app/calendar/events/{obj.id}/join"

    def get_is_observance(self, obj):
        return False

    def get_trees_gifted(self, obj):
        if hasattr(obj, "_trees_gifted"):
            return obj._trees_gifted or 0
        from django.db.models import Sum

        total = obj.tree_gifts.filter(payment_status="completed").aggregate(
            t=Sum("trees_purchased")
        )["t"]
        return int(total or 0)

    def get_gift_count(self, obj):
        if hasattr(obj, "_gift_count"):
            return obj._gift_count or 0
        return obj.tree_gifts.filter(payment_status="completed").count()

    def get_gift_path(self, obj):
        if not obj.allow_tree_gifts:
            return None
        from urllib.parse import urlencode

        params = {"event": obj.id}
        if obj.tree_project_id:
            params["project"] = obj.tree_project_id
        if obj.host_id:
            params["for"] = obj.host_id
            params["name"] = display_name_for(obj.host)
        return f"/app/plant-tree?{urlencode(params)}"

    def _my_invite(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        return next(
            (i for i in obj.invites.all() if i.user_id == request.user.id),
            None,
        )

    def get_my_rsvp(self, obj):
        invite = self._my_invite(obj)
        if invite:
            return invite.rsvp
        request = self.context.get("request")
        if request and obj.host_id == request.user.id:
            return "yes"
        return None

    def get_my_role(self, obj):
        invite = self._my_invite(obj)
        if invite:
            return invite.role
        request = self.context.get("request")
        if request and obj.host_id == request.user.id:
            return "host"
        return None

    def get_can_join(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return user_can_access_event(request.user, obj)

    def get_invite_count(self, obj):
        if hasattr(obj, "_invite_count"):
            return obj._invite_count
        return obj.invites.count()

    def get_invites(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return []
        if (
            obj.host_id != request.user.id
            and not request.user.is_staff
            and not request.user.is_superuser
        ):
            return []
        qs = obj.invites.all()
        # Prefetch already loaded
        return ClimateEventInviteSerializer(qs, many=True).data


class ClimateEventCreateSerializer(serializers.ModelSerializer):
    invite_user_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    invite_emails = serializers.ListField(
        child=serializers.EmailField(), required=False, allow_empty=True
    )
    notify_in_app = serializers.BooleanField(required=False, default=True)
    notify_email = serializers.BooleanField(required=False, default=True)

    class Meta:
        model = ClimateEvent
        fields = (
            "title",
            "description",
            "event_type",
            "starts_at",
            "ends_at",
            "timezone",
            "status",
            "visibility",
            "disaster",
            "tree_project",
            "tree_admin_org",
            "responder_org",
            "social_group",
            "conversation",
            "invite_user_ids",
            "invite_emails",
            "notify_in_app",
            "notify_email",
            "allow_tree_gifts",
        )

    def create(self, validated_data):
        invite_ids = validated_data.pop("invite_user_ids", []) or []
        invite_emails_list = validated_data.pop("invite_emails", []) or []
        notify_in_app = validated_data.pop("notify_in_app", True)
        notify_email = validated_data.pop("notify_email", True)
        request = self.context["request"]
        event = ClimateEvent.objects.create(
            **validated_data,
            host=request.user,
            jitsi_room=new_jitsi_room(),
        )
        ensure_host_invite(event)
        apply_invites(
            event,
            user_ids=invite_ids,
            emails=invite_emails_list,
            notify=bool(notify_in_app),
            send_email=bool(notify_email),
        )
        if event.conversation_id:
            post_event_chat_link(event)
        return event

    def update(self, instance, validated_data):
        invite_ids = validated_data.pop("invite_user_ids", None)
        invite_emails_list = validated_data.pop("invite_emails", None)
        notify_in_app = validated_data.pop("notify_in_app", True)
        notify_email = validated_data.pop("notify_email", True)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if invite_ids is not None or invite_emails_list is not None:
            apply_invites(
                instance,
                user_ids=invite_ids or [],
                emails=invite_emails_list or [],
                notify=bool(notify_in_app),
                send_email=bool(notify_email),
            )
        return instance


class ClimateEventViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ClimateEventSerializer

    def get_queryset(self):
        return (
            events_visible_to(self.request.user)
            .select_related(
                "host",
                "disaster",
                "tree_project",
                "tree_admin_org",
                "responder_org",
                "social_group",
                "conversation",
            )
            .prefetch_related("invites__user")
            .annotate(
                _invite_count=models.Count("invites", distinct=True),
                _gift_count=models.Count(
                    "tree_gifts",
                    filter=Q(tree_gifts__payment_status="completed"),
                    distinct=True,
                ),
                _trees_gifted=models.Sum(
                    "tree_gifts__trees_purchased",
                    filter=Q(tree_gifts__payment_status="completed"),
                ),
            )
        )

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ClimateEventCreateSerializer
        return ClimateEventSerializer

    def create(self, request, *args, **kwargs):
        if not user_can_host_ops(request.user) and not request.data.get("conversation"):
            # Huddles from chat (conversation set) allowed for any member later via from_chat
            if request.data.get("event_type") != "huddle":
                return Response(
                    {"detail": "Only Climate ops hosts can create this event type."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        out = ClimateEventSerializer(event, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        event = self.get_object()
        if (
            event.host_id != request.user.id
            and not request.user.is_staff
            and not request.user.is_superuser
        ):
            return Response(
                {"detail": "Only the host can update this event."},
                status=status.HTTP_403_FORBIDDEN,
            )
        prev_status = event.status
        serializer = self.get_serializer(event, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        if prev_status != "live" and event.status == "live":
            post_event_chat_link(
                event,
                f"🔴 Live now: {event.title}\nJoin: /app/calendar/events/{event.id}/join",
            )
            for invite in event.invites.select_related("user").exclude(
                user_id=event.host_id
            ):
                if invite.user_id and invite_receives_reminders(invite):
                    notify_climate_event(invite.user, event, f"Live now: {event.title}")
        out = ClimateEventSerializer(event, context={"request": request})
        return Response(out.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if (
            instance.host_id != self.request.user.id
            and not self.request.user.is_staff
            and not self.request.user.is_superuser
        ):
            raise serializers.ValidationError("Only the host can delete this event.")
        instance.delete()

    @action(detail=False, methods=["get"])
    def mine(self, request):
        qs = self.get_queryset().order_by("starts_at")
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        event_type = request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)
        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")
        if from_date:
            qs = qs.filter(starts_at__gte=from_date)
        if to_date:
            qs = qs.filter(starts_at__lte=to_date)
        page = self.paginate_queryset(qs)
        ser = ClimateEventSerializer(
            page or qs, many=True, context={"request": request}
        )
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=True, methods=["post"])
    def rsvp(self, request, pk=None):
        event = self.get_object()
        if not user_can_access_event(request.user, event):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        choice = (request.data.get("rsvp") or "").strip().lower()
        if choice not in ("pending", "yes", "no", "maybe"):
            return Response(
                {"detail": "rsvp must be pending, yes, no, or maybe"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invite, _ = ClimateEventInvite.objects.get_or_create(
            event=event,
            user=request.user,
            defaults={"role": "attendee", "rsvp": choice},
        )
        if invite.rsvp != choice:
            invite.rsvp = choice
            invite.save(update_fields=["rsvp", "updated_at"])
        return Response(ClimateEventInviteSerializer(invite).data)

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        event = self.get_object()
        if not user_can_access_event(request.user, event):
            return Response(
                {"detail": "You are not allowed to join this Climate room."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if event.status == "cancelled":
            return Response(
                {"detail": "This event was cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Auto-mark live when joining near start
        now = timezone.now()
        if event.status == "scheduled" and event.starts_at <= now + timedelta(minutes=15):
            event.status = "live"
            event.save(update_fields=["status", "updated_at"])
        ClimateEventInvite.objects.get_or_create(
            event=event,
            user=request.user,
            defaults={"role": "attendee" if event.host_id != request.user.id else "host", "rsvp": "yes"},
        )
        return Response(
            {
                "event_id": event.id,
                "title": event.title,
                "roomName": event.jitsi_room,
                "displayName": display_name_for(request.user),
                "jwt": None,
                "domain": None,
                "status": event.status,
                "join_path": f"/app/calendar/events/{event.id}/join",
            }
        )

    @action(detail=True, methods=["get"])
    def invites(self, request, pk=None):
        event = self.get_object()
        if not user_can_access_event(request.user, event):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        qs = event.invites.select_related("user").order_by("created_at")
        return Response(ClimateEventInviteSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        event = self.get_object()
        if event.host_id != request.user.id and not request.user.is_staff:
            return Response({"detail": "Only the host can invite."}, status=403)
        ids = request.data.get("user_ids") or request.data.get("invite_user_ids") or []
        emails = request.data.get("emails") or request.data.get("invite_emails") or []
        notify = request.data.get("notify_in_app", True)
        send_email = request.data.get("notify_email", True)
        created = apply_invites(
            event,
            user_ids=ids,
            emails=emails,
            notify=bool(notify),
            send_email=bool(send_email),
        )
        return Response(
            {
                "invited": ClimateEventInviteSerializer(created, many=True).data,
                "count": len(created),
            }
        )

    @action(detail=True, methods=["get"])
    def gifts(self, request, pk=None):
        """List completed tree gifts contributed to this calendar day's activities."""
        from .models import TreeProjectDonation
        from .serializers import TreeProjectDonationSerializer

        event = self.get_object()
        if not user_can_access_event(request.user, event) and event.visibility != "public":
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            TreeProjectDonation.objects.filter(
                climate_event=event, payment_status="completed"
            )
            .select_related("donor", "gifted_to", "project")
            .order_by("-created_at")[:50]
        )
        return Response(
            {
                "event_id": event.id,
                "allow_tree_gifts": event.allow_tree_gifts,
                "trees_gifted": sum(d.trees_purchased for d in qs),
                "gift_count": len(qs),
                "gift_path": ClimateEventSerializer(
                    event, context={"request": request}
                ).data.get("gift_path"),
                "results": TreeProjectDonationSerializer(qs, many=True).data,
            }
        )

    @action(detail=True, methods=["get"], url_path="gift-options")
    def gift_options(self, request, pk=None):
        """
        Available trees/species for this calendar day's activities.
        Prefers the event's linked project; otherwise returns plantable African projects.
        """
        from .models import TreeProject, TreeProjectDonation
        from .serializers import TreeProjectSerializer
        from .tree_inventory import with_remaining

        event = self.get_object()
        if not event.allow_tree_gifts:
            return Response(
                {"detail": "Tree gifts are disabled for this event."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            not user_can_access_event(request.user, event)
            and event.visibility != "public"
        ):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        gifted = TreeProjectDonation.objects.filter(
            climate_event=event, payment_status="completed"
        )
        trees_gifted = sum(gifted.values_list("trees_purchased", flat=True))
        gift_count = gifted.count()

        def project_card(project: TreeProject):
            data = TreeProjectSerializer(project, context={"request": request}).data
            # Drop heavy nested lists for the gift picker
            data.pop("updates", None)
            data.pop("donations", None)
            data["tree_species"] = with_remaining(data.get("tree_species"))
            return data

        linked = None
        options = []
        if event.tree_project_id:
            linked = project_card(event.tree_project)
            options = [linked]
        else:
            qs = (
                TreeProject.objects.filter(status="active", is_verified=True)
                .order_by("-trees_planted", "-created_at")[:24]
            )
            options = [project_card(p) for p in qs]

        return Response(
            {
                "event_id": event.id,
                "title": event.title,
                "starts_at": event.starts_at.isoformat() if event.starts_at else None,
                "allow_tree_gifts": event.allow_tree_gifts,
                "trees_gifted": int(trees_gifted or 0),
                "gift_count": gift_count,
                "host_id": event.host_id,
                "host_name": display_name_for(event.host) if event.host_id else "",
                "linked_project_id": event.tree_project_id,
                "linked_project": linked,
                "projects": options,
            }
        )

    @action(detail=False, methods=["post"], url_path="from-disaster")
    def from_disaster(self, request):
        if not user_can_host_ops(request.user):
            return Response({"detail": "Forbidden"}, status=403)
        disaster_id = request.data.get("disaster_id") or request.data.get("disaster")
        disaster = Disaster.objects.filter(id=disaster_id).first()
        if not disaster:
            return Response({"detail": "Disaster not found"}, status=404)
        title = (request.data.get("title") or "").strip() or (
            f"Disaster briefing: {getattr(disaster, 'title', None) or getattr(disaster, 'name', None) or disaster.id}"
        )
        starts = request.data.get("starts_at") or timezone.now() + timedelta(minutes=10)
        allow_gifts = request.data.get("allow_tree_gifts", True)
        day_project_id = request.data.get("tree_project")
        day_project = (
            TreeProject.objects.filter(id=day_project_id).first()
            if day_project_id not in (None, "")
            else None
        )
        with transaction.atomic():
            event = ClimateEvent.objects.create(
                title=title[:200],
                description=(request.data.get("description") or disaster.description or "")[:5000],
                event_type="disaster_briefing",
                starts_at=starts,
                ends_at=request.data.get("ends_at"),
                timezone=request.data.get("timezone") or "Africa/Nairobi",
                status="scheduled",
                visibility=request.data.get("visibility") or "org",
                host=request.user,
                disaster=disaster,
                tree_project=day_project,
                allow_tree_gifts=bool(allow_gifts),
                responder_org_id=request.data.get("responder_org"),
                conversation_id=request.data.get("conversation"),
                jitsi_room=new_jitsi_room(),
            )
            ensure_host_invite(event)
            apply_invites(
                event,
                user_ids=request.data.get("invite_user_ids") or [],
                emails=request.data.get("invite_emails") or [],
                notify=bool(request.data.get("notify_in_app", True)),
                send_email=bool(request.data.get("notify_email", True)),
            )
            if event.conversation_id:
                post_event_chat_link(event)
        return Response(
            ClimateEventSerializer(event, context={"request": request}).data,
            status=201,
        )

    @action(detail=False, methods=["post"], url_path="from-project")
    def from_project(self, request):
        if not user_can_host_ops(request.user):
            return Response({"detail": "Forbidden"}, status=403)
        project_id = request.data.get("project_id") or request.data.get("tree_project")
        project = TreeProject.objects.filter(id=project_id).first()
        if not project:
            return Response({"detail": "Project not found"}, status=404)
        title = (request.data.get("title") or "").strip() or (
            f"Planting day: {project.name}"
        )
        starts = request.data.get("starts_at") or timezone.now() + timedelta(days=1)
        tree_admin_org = project.tree_admin_org_id
        allow_gifts = request.data.get("allow_tree_gifts", True)
        with transaction.atomic():
            event = ClimateEvent.objects.create(
                title=title[:200],
                description=(request.data.get("description") or project.short_description or project.description or "")[:5000],
                event_type="planting_day",
                starts_at=starts,
                ends_at=request.data.get("ends_at"),
                timezone=request.data.get("timezone") or "Africa/Nairobi",
                status="scheduled",
                visibility=request.data.get("visibility") or "public",
                host=request.user,
                tree_project=project,
                allow_tree_gifts=bool(allow_gifts),
                tree_admin_org_id=tree_admin_org or request.data.get("tree_admin_org"),
                conversation_id=request.data.get("conversation"),
                jitsi_room=new_jitsi_room(),
            )
            ensure_host_invite(event)
            apply_invites(
                event,
                user_ids=request.data.get("invite_user_ids") or [],
                emails=request.data.get("invite_emails") or [],
                notify=bool(request.data.get("notify_in_app", True)),
                send_email=bool(request.data.get("notify_email", True)),
            )
            if event.conversation_id:
                post_event_chat_link(event)
        return Response(
            ClimateEventSerializer(event, context={"request": request}).data,
            status=201,
        )

    @action(detail=False, methods=["post"], url_path="send-reminders")
    def send_reminders(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"detail": "Staff only"}, status=403)
        return Response(send_climate_event_reminders())

    @action(detail=False, methods=["post"], url_path="from-chat")
    def from_chat(self, request):
        """Start a Climate Call huddle from a conversation (Phase 2)."""
        conv_id = request.data.get("conversation_id") or request.data.get("conversation")
        conv = Conversation.objects.filter(id=conv_id).first()
        if not conv:
            return Response({"detail": "Conversation not found"}, status=404)
        if not ConversationMember.objects.filter(
            conversation=conv, user=request.user
        ).exists() and not (request.user.is_staff or request.user.is_superuser):
            return Response({"detail": "Not a member of this chat"}, status=403)

        member_ids = list(
            ConversationMember.objects.filter(conversation=conv).values_list(
                "user_id", flat=True
            )
        )
        title = (request.data.get("title") or "").strip() or (
            f"Climate call — {conv.name or 'Chat'}"
        )[:200]
        now = timezone.now()
        with transaction.atomic():
            event = ClimateEvent.objects.create(
                title=title,
                description=request.data.get("description") or "Ad-hoc Climate Wavers huddle",
                event_type="huddle",
                starts_at=now,
                ends_at=now + timedelta(hours=1),
                timezone=request.data.get("timezone") or "Africa/Nairobi",
                status="live",
                visibility="invitees",
                host=request.user,
                conversation=conv,
                social_group_id=getattr(conv, "social_group_id", None),
                responder_org_id=getattr(conv, "responder_org_id", None),
                jitsi_room=new_jitsi_room(),
            )
            ensure_host_invite(event)
            invite_users(event, [uid for uid in member_ids if uid != request.user.id])
            post_event_chat_link(
                event,
                f"📞 Climate Call started: {event.title}\nJoin: /app/calendar/events/{event.id}/join",
            )
        return Response(
            ClimateEventSerializer(event, context={"request": request}).data,
            status=201,
        )


def send_climate_event_reminders():
    """
    T-60 and T-10 reminders for hosts + accepted (rsvp=yes) invitees only.
    Delivers in-app notifications and Resend email when prefs allow.
    """
    now = timezone.now()
    sent_60 = 0
    sent_10 = 0

    window_60 = ClimateEvent.objects.filter(
        status="scheduled",
        reminder_60_sent=False,
        starts_at__gte=now + timedelta(minutes=50),
        starts_at__lte=now + timedelta(minutes=70),
    ).prefetch_related("invites__user")

    for event in window_60:
        for invite in event.invites.all():
            if not invite_receives_reminders(invite):
                continue
            if deliver_event_reminder(
                invite,
                event,
                f"In about 1 hour: {event.title}",
                when_label="in about 1 hour",
            ):
                sent_60 += 1
        event.reminder_60_sent = True
        event.save(update_fields=["reminder_60_sent", "updated_at"])

    window_10 = ClimateEvent.objects.filter(
        status__in=("scheduled", "live"),
        reminder_10_sent=False,
        starts_at__gte=now + timedelta(minutes=5),
        starts_at__lte=now + timedelta(minutes=15),
    ).prefetch_related("invites__user")

    for event in window_10:
        for invite in event.invites.all():
            if not invite_receives_reminders(invite):
                continue
            if deliver_event_reminder(
                invite,
                event,
                f"Starting soon: {event.title} — join the Climate room",
                when_label="starting soon",
            ):
                sent_10 += 1
        event.reminder_10_sent = True
        event.save(update_fields=["reminder_10_sent", "updated_at"])

    return {"reminder_60": sent_60, "reminder_10": sent_10}
