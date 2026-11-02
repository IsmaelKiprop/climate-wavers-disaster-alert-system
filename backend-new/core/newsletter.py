import json
import logging

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from api.tasks import send_message

from .models import NewsletterSubscriber

logger = logging.getLogger(__name__)


class NewsletterSubscribeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email or "@" not in email or "." not in email.split("@")[-1]:
            return Response(
                {"email": ["Enter a valid email address."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(email) > 254:
            return Response(
                {"email": ["Email is too long."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source = (request.data.get("source") or "footer")[:40]
        subscriber, created = NewsletterSubscriber.objects.get_or_create(
            email=email,
            defaults={"source": source},
        )
        if not subscriber.is_active:
            subscriber.is_active = True
            subscriber.save(update_fields=["is_active"])
            created = True

        if created:
            self._notify(email)

        return Response(
            {
                "ok": True,
                "created": created,
                "message": (
                    "You're on the Climate Wavers update list."
                    if created
                    else "This email is already on the update list."
                ),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def _notify(self, email):
        now = timezone.now()
        stamp = {
            "date": now.strftime("%d %b %Y"),
            "time": now.strftime("%H:%M UTC"),
        }
        try:
            send_message(
                "custom_mail",
                json.dumps(
                    {
                        "email": email,
                        "data": {
                            **stamp,
                            "content": (
                                "You are subscribed to Climate Wavers updates. "
                                "We send live USGS and NASA alert notes and campaign news. "
                                "This is not a government siren."
                            ),
                        },
                    }
                ),
            )
        except Exception:
            logger.exception("Failed to send subscriber confirmation to %s", email)

        hello = getattr(settings, "DEFAULT_FROM_EMAIL", "") or "hello@climatewavers.org"
        if "<" in hello and ">" in hello:
            hello = hello[hello.find("<") + 1 : hello.find(">")].strip()
        if hello.lower() == email.lower():
            return
        try:
            send_message(
                "custom_mail",
                json.dumps(
                    {
                        "email": "hello@climatewavers.org",
                        "data": {
                            **stamp,
                            "content": f"New update-list subscriber: {email}",
                        },
                    }
                ),
            )
        except Exception:
            logger.exception("Failed to notify hello of subscriber %s", email)
