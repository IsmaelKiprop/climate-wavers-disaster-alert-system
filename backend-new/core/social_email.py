"""
Email for social activity (follow, like, repost, comment, new post).
Uses Resend first; falls back to notification service HTTP.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def frontend_base():
    return (getattr(settings, "FRONTEND_URL", "") or "https://alerts.flowops.africa").rstrip(
        "/"
    )


def notifications_url():
    return f"{frontend_base()}/app/notifications"


def post_url(post_id):
    if not post_id:
        return notifications_url()
    return f"{frontend_base()}/app/{post_id}/comments"


def profile_url(user_id):
    if not user_id:
        return notifications_url()
    return f"{frontend_base()}/app/{user_id}/profile"


def send_social_email(user, *, subject, message, link=None):
    """Best-effort social email; never raise into the request/signal path."""
    email = getattr(user, "email", None) or ""
    if not email or "@" not in email:
        return False
    # Skip disposable / empty placeholders
    if email.endswith("@example.com"):
        return False

    body = (
        f"{message}\n\n"
        f"Open Climate Wavers: {link or notifications_url()}\n\n"
        "You’re receiving this because of activity on your Climate Wavers account."
    )
    payload = {
        "email": email,
        "data": {
            "subject": subject,
            "content": body,
        },
    }
    try:
        from api.tasks import _send_resend

        _send_resend("custom_mail", payload)
        return True
    except Exception as exc:
        logger.warning("Social email via Resend failed for %s: %s", email, exc)
    try:
        from api.tasks import _post_notification

        _post_notification({"type": "custom_mail", **payload})
        return True
    except Exception as exc:
        logger.warning("Social email via notification service failed for %s: %s", email, exc)
        return False
