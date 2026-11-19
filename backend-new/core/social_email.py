"""
Email for social activity (follow, like, repost, comment, new post).
Uses Resend first; falls back to notification service HTTP.
Renders as branded community card HTML (Tree-Nation-style layout).
"""
import logging
import re

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


def chat_url(conversation_id=None):
    base = f"{frontend_base()}/app/chat"
    if conversation_id:
        return f"{base}?c={conversation_id}"
    return base


def _display_name(user):
    first = (getattr(user, "first_name", None) or "").strip()
    if first:
        return first
    username = (getattr(user, "username", None) or "").strip()
    if username:
        return username
    email = getattr(user, "email", None) or ""
    return email.split("@")[0] if email else ""


def _http_url(value):
    url = str(value or "").strip()
    if url.startswith("https://") or url.startswith("http://"):
        return url
    return ""


def _cloudinary_video_still(video_url):
    """
    Derive a still-frame image URL from a Cloudinary video delivery URL.
    Emails cannot play video; a thumbnail is the correct preview.
    """
    url = _http_url(video_url)
    if not url or "/video/upload/" not in url:
        return ""
    # Switch to image delivery and request first frame as jpg.
    still = url.replace("/video/upload/", "/image/upload/so_0/", 1)
    still = re.sub(r"\.(mp4|webm|mov|m4v)(\?.*)?$", r".jpg\2", still, flags=re.I)
    if still == url or still.endswith((".mp4", ".webm", ".mov", ".m4v")):
        # No extension swap — append .jpg transform-friendly suffix if needed
        if "/image/upload/" in still and not still.lower().endswith(".jpg"):
            still = f"{still}.jpg" if "?" not in still else still
    return still


def post_preview_hero(post):
    """Public image URL for email hero from a Post, or None."""
    if not post:
        return None
    for attr in ("image", "gif"):
        url = _http_url(getattr(post, attr, None))
        if url:
            return url
    video = _http_url(getattr(post, "video", None))
    if video:
        still = _cloudinary_video_still(video)
        if still:
            return still
        # Non-Cloudinary video: no reliable still; skip hero override
    return None


def post_content_excerpt(post, limit=180):
    """Short plain-text preview of post content for email body."""
    if not post:
        return ""
    text = str(getattr(post, "content", None) or "").strip()
    if not text:
        return ""
    # Collapse whitespace for email readability
    text = re.sub(r"\s+", " ", text)
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def send_social_email(
    user,
    *,
    subject,
    message,
    link=None,
    headline=None,
    post=None,
    hero_image=None,
):
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

    body_message = (message or "").strip()
    excerpt = post_content_excerpt(post) if post is not None else ""
    if excerpt and excerpt not in body_message:
        body_message = f"{body_message}\n\n{excerpt}" if body_message else excerpt

    body = (
        f"{body_message}\n\n"
        f"Open Climate Wavers: {dest}\n\n"
        "You’re receiving this because of activity on your Climate Wavers account."
    )

    resolved_hero = _http_url(hero_image) if hero_image else ""
    if not resolved_hero and post is not None:
        resolved_hero = post_preview_hero(post) or ""
    if not resolved_hero:
        resolved_hero = f"{frontend_base()}/community-respond.jpg"

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
            "hero_image": resolved_hero,
            "reply_hint": (
                "You’re getting this because of activity in your Climate Wavers "
                "community. Manage alerts anytime in Email preferences."
            ),
            "preheader": body_message or message,
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
