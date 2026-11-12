import logging
import random
import string
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.tasks import _post_notification, _send_resend

from . import meta_whatsapp
from .models import UserAlertPreference

logger = logging.getLogger(__name__)


def _pref_for(user):
    pref, _ = UserAlertPreference.objects.get_or_create(user=user)
    if not pref.phone and getattr(user, "phone", None):
        pref.phone = user.phone
        pref.save(update_fields=["phone"])
    return pref


def _serialize(pref):
    return {
        "email_alerts": pref.email_alerts,
        "whatsapp_alerts": pref.whatsapp_alerts,
        "radius_km": pref.radius_km,
        "min_magnitude": float(pref.min_magnitude) if pref.min_magnitude is not None else 4.5,
        "latitude": float(pref.latitude) if pref.latitude is not None else None,
        "longitude": float(pref.longitude) if pref.longitude is not None else None,
        "phone": pref.phone or "",
        "phone_verified": pref.phone_verified,
    }


class AlertPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_serialize(_pref_for(request.user)))

    def put(self, request):
        pref = _pref_for(request.user)
        data = request.data or {}
        if "email_alerts" in data:
            pref.email_alerts = bool(data.get("email_alerts"))
        if "whatsapp_alerts" in data:
            pref.whatsapp_alerts = bool(data.get("whatsapp_alerts"))
        if "radius_km" in data:
            try:
                pref.radius_km = max(10, min(500, int(data.get("radius_km"))))
            except (TypeError, ValueError):
                pass
        if "min_magnitude" in data:
            try:
                pref.min_magnitude = float(data.get("min_magnitude"))
            except (TypeError, ValueError):
                pass
        if "latitude" in data:
            try:
                pref.latitude = float(data["latitude"]) if data["latitude"] not in (None, "") else None
            except (TypeError, ValueError):
                pass
        if "longitude" in data:
            try:
                pref.longitude = float(data["longitude"]) if data["longitude"] not in (None, "") else None
            except (TypeError, ValueError):
                pass
        if "phone" in data:
            new_phone = (data.get("phone") or "").strip()
            if new_phone != (pref.phone or ""):
                pref.phone = new_phone
                pref.phone_verified = False
                if hasattr(request.user, "phone"):
                    request.user.phone = new_phone
                    request.user.save(update_fields=["phone"])
        pref.save()
        return Response(_serialize(pref))


class AlertPhoneVerifyRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        pref = _pref_for(request.user)
        phone = (request.data.get("phone") or pref.phone or request.user.phone or "").strip()
        if not phone:
            return Response({"error": "Enter a phone number first."}, status=400)
        code = "".join(random.choices(string.digits, k=6))
        pref.phone = phone
        pref.phone_otp = code
        pref.phone_otp_expires = timezone.now() + timedelta(minutes=15)
        pref.phone_verified = False
        pref.save(
            update_fields=["phone", "phone_otp", "phone_otp_expires", "phone_verified"]
        )

        sent_via = []
        channel_errors = {}
        sent_to = meta_whatsapp.normalize_phone(phone)
        # Prefer direct Meta Graph API (avoids Cloudflare 429 on notification service).
        try:
            result = meta_whatsapp.send_phone_otp(phone, code)
            sent_via.append("whatsapp")
            sent_to = result.get("to") or sent_to
        except Exception as exc:
            channel_errors["whatsapp_direct"] = str(exc)
            logger.warning("Direct WhatsApp OTP failed to=%s: %s", sent_to, exc)
            try:
                _post_notification(
                    {
                        "type": "disaster_alert_whatsapp",
                        "data": {
                            "template": "phone_verify_otp",
                            "recipients": [{"phone": phone}],
                            "otp": code,
                            "city": "Climate Wavers",
                            "disasterType": "verification",
                        },
                    }
                )
                sent_via.append("whatsapp")
            except Exception as nested:
                channel_errors["whatsapp_notification"] = str(nested)
                logger.warning("Notification-service WhatsApp OTP failed: %s", nested)

        # Email OTP via Resend first (same Cloudflare issue on notification HTTP).
        try:
            _send_resend(
                "custom_mail",
                {
                    "email": request.user.email,
                    "data": {
                        "content": (
                            f"Your Climate Wavers phone verification code is {code}. "
                            "It expires in 15 minutes."
                        )
                    },
                },
            )
            sent_via.append("email")
        except Exception as exc:
            channel_errors["email_resend"] = str(exc)
            logger.warning("Resend OTP email failed: %s", exc)
            try:
                _post_notification(
                    {
                        "type": "custom_mail",
                        "email": request.user.email,
                        "data": {
                            "content": (
                                f"Your Climate Wavers phone verification code is {code}. "
                                "It expires in 15 minutes."
                            )
                        },
                    }
                )
                sent_via.append("email")
            except Exception as nested:
                channel_errors["email_notification"] = str(nested)
                logger.warning("Notification-service OTP email failed: %s", nested)

        if not sent_via:
            return Response(
                {
                    "error": "Could not send verification code. Try again shortly.",
                    "channel_errors": channel_errors,
                },
                status=502,
            )
        if "whatsapp" in sent_via:
            message = (
                f"Verification code sent to +{sent_to} "
                "(WhatsApp from FlowOps Africa business number)."
            )
        elif "email" in sent_via:
            message = (
                f"WhatsApp delivery failed; code sent to {request.user.email} instead. "
                "Check that inbox (and spam)."
            )
        else:
            message = "Verification code sent."
        return Response(
            {
                "ok": True,
                "sent_via": sent_via,
                "sent_to": sent_to,
                "message": message,
                "channel_errors": channel_errors or None,
                # Dev convenience when DEBUG; never rely on this in production UI.
                "debug_code": code if getattr(settings, "DEBUG", False) else None,
            }
        )


class AlertPhoneVerifyConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        pref = _pref_for(request.user)
        code = str(request.data.get("code") or "").strip()
        if not code or not pref.phone_otp:
            return Response({"error": "Enter the verification code."}, status=400)
        if pref.phone_otp_expires and timezone.now() > pref.phone_otp_expires:
            return Response({"error": "Code expired. Request a new one."}, status=400)
        if code != pref.phone_otp:
            return Response({"error": "Invalid code."}, status=400)
        pref.phone_verified = True
        pref.phone_otp = None
        pref.phone_otp_expires = None
        pref.save(update_fields=["phone_verified", "phone_otp", "phone_otp_expires"])
        return Response({"ok": True, "phone_verified": True})
