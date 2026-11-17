"""
Email for social activity (follow, like, repost, comment, new post).
Uses Resend first; falls back to notification service HTTP.
Renders as branded community card HTML (Tree-Nation-style layout).
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


def _display_name(user):
    first = (getattr(user, "first_name", None) or "").strip()
    if first:
        return first
    username = (getattr(user, "username", None) or "").strip()
    if username:
        return username
    email = getattr(user, "email", None) or ""
    return email.split("@")[0] if email else ""


def send_social_email(user, *, subject, message, link=None, headline=None):
    """Best-effort social email; never raise into the request/signal path."""
    email = getattr(user, "email", None) or ""
    if not email or "@" not in email:
        return False
    # Skip disposable / empty placeholders
    if email.endswith("@example.com"):
        return False

    dest = link or notifications_url()
    name = _display_name(user)
    title = (headline or subject or "Activity on Climate Wavers").strip()
    body = (
        f"{message}\n\n"
        f"Open Climate Wavers: {dest}\n\n"
        "You’re receiving this because of activity on your Climate Wavers account."
    )
    payload = {
        "email": email,
        "data": {
            "subject": subject,
            "headline": title,
            "name": name,
            "content": body,
            "cta_text": "Open Climate Wavers",
            "cta_url": dest,
            "link": dest,
            "hero_image": f"{frontend_base()}/community-respond.jpg",
            "reply_hint": (
                "You’re getting this because of activity in your Climate Wavers "
                "community. Manage alerts anytime in Email preferences."
            ),
            "preheader": message,
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
