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


def _email_fit_image(url):
    """
    Prefer a landscape, email-friendly Cloudinary crop (≈ OG 1200×630).
    Leaves non-Cloudinary URLs unchanged.
    """
    src = _http_url(url)
    if not src or "res.cloudinary.com" not in src:
        return src
    # Insert c_fill,w_1120,h_588,f_auto,q_auto after /upload/
    if "/upload/" in src and "/upload/c_fill," not in src:
        return src.replace("/upload/", "/upload/c_fill,w_1120,h_588,f_auto,q_auto/", 1)
    return src


_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)


def _extract_urls(text, limit=3):
    urls = []
    for match in _URL_RE.finditer(str(text or "")):
        url = match.group(0).rstrip(").,];'")
        if url not in urls:
            urls.append(url)
        if len(urls) >= limit:
            break
    return urls


def _site_hosts():
    hosts = set()
    for raw in (frontend_base(), getattr(settings, "SITE_URL", None) or ""):
        raw = str(raw or "").strip()
        if not raw:
            continue
        try:
            from urllib.parse import urlparse

            host = urlparse(raw if "://" in raw else f"https://{raw}").hostname
            if host:
                hosts.add(host.lower())
        except Exception:
            pass
    hosts.add("alerts.flowops.africa")
    return hosts


def resolve_site_link_preview(url):
    """
    Build an in-app-style link preview for Climate Wavers URLs
    (image + title + description), mirroring frontend linkPreview.js.
    """
    from urllib.parse import urlparse

    href = _http_url(url)
    if not href:
        return None
    try:
        parsed = urlparse(href)
    except Exception:
        return None
    host = (parsed.hostname or "").lower()
    if host not in _site_hosts():
        return None

    base = frontend_base()
    og = f"{base}/og-image.jpg"
    path = (parsed.pathname or "/").rstrip("/") or "/"

    plastic_match = re.match(r"^/plastic/(\d+)", path)
    if plastic_match:
        try:
            from .models import PlasticProject

            plastic = PlasticProject.objects.filter(
                id=int(plastic_match.group(1))
            ).select_related("tree_admin_org", "organization").first()
        except Exception:
            plastic = None
        if plastic:
            org = getattr(plastic, "tree_admin_org", None)
            org_name = (
                (getattr(org, "name", None) or "").strip()
                or (plastic.organization_name or "").strip()
                or "Climate Wavers partner"
            )
            cover = (
                _http_url(getattr(plastic, "cover_image", None))
                or f"{base}/docs/plastic-pulse-og.jpg"
            )
            recovered = float(plastic.recovered_kg or 0)
            goal = float(plastic.goal_kg or 0)
            desc = (
                plastic.short_description
                or plastic.description
                or f"Led by {org_name}"
            )
            if goal > 0:
                desc = f"{desc} · {recovered:g}/{goal:g} kg recovered"
            return {
                "url": f"{base}/plastic/{plastic.id}",
                "title": f"{plastic.name} · Plastic Pulse",
                "description": re.sub(r"\s+", " ", str(desc)).strip()[:180],
                "image": cover,
                "site_name": "Climate Wavers",
            }
        return {
            "url": f"{base}/plastic/{plastic_match.group(1)}",
            "title": "Plastic Pulse · Climate Wavers",
            "description": "Sponsor verified plastic recovery on Climate Wavers.",
            "image": f"{base}/docs/plastic-pulse-og.jpg",
            "site_name": "Climate Wavers",
        }

    project_match = re.match(r"^/p/(\d+)", path)
    if project_match:
        try:
            from .models import TreeProject

            project = TreeProject.objects.filter(id=int(project_match.group(1))).first()
        except Exception:
            project = None
        if project:
            cover = _http_url(getattr(project, "cover_image", None)) or og
            desc = (
                getattr(project, "short_description", None)
                or getattr(project, "description", None)
                or "Tree planting on Climate Wavers."
            )
            return {
                "url": f"{base}/p/{project.id}",
                "title": f"{getattr(project, 'name', None) or 'Tree project'} · Climate Wavers",
                "description": re.sub(r"\s+", " ", str(desc)).strip()[:180],
                "image": cover,
                "site_name": "Climate Wavers",
            }

    profile_match = re.match(r"^/u/(\d+)", path)
    if profile_match:
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            profile = User.objects.filter(id=int(profile_match.group(1))).first()
        except Exception:
            profile = None
        if profile:
            name = (
                f"{getattr(profile, 'first_name', '') or ''} "
                f"{getattr(profile, 'last_name', '') or ''}"
            ).strip() or getattr(profile, "username", None) or "Member"
            photo = (
                _http_url(getattr(profile, "photo", None))
                or _http_url(getattr(profile, "avatar", None))
                or og
            )
            return {
                "url": f"{base}/u/{profile.id}",
                "title": f"{name} · Climate Wavers",
                "description": str(getattr(profile, "bio", None) or "Climate Wavers community member.")[
                    :180
                ],
                "image": photo,
                "site_name": "Climate Wavers",
            }

    # Keep aligned with frontend/api/og-pages.js — themed image per route.
    path_previews = {
        "/": (
            "Climate Wavers: Disaster Alerts & Climate Action",
            "Real-time USGS and NASA disaster alerts, community response, and climate action. "
            "Built in Nairobi to verify hazards instead of amplifying rumors.",
            "/og-image.jpg",
        ),
        "/plastic-pulse": (
            "Plastic Pulse — Climate Wavers partner onboarding",
            "Verified plastic recovery for CBOs, youth groups, recyclers, and sponsors. "
            "GPS proof, live kg, certificates, and sponsor-a-kilo on Climate Wavers.",
            "/docs/plastic-pulse-og.jpg",
        ),
        "/about": (
            "About Climate Wavers",
            "Climate Wavers is the live disaster platform from FlowOps Africa in Nairobi.",
            "/climate-action-network.jpg",
        ),
        "/impact": (
            "Impact · Climate Wavers",
            "Live USGS and NASA events plus tree-planting records on Climate Wavers.",
            "/environment.jpg",
        ),
        "/faq": (
            "FAQ · Climate Wavers",
            "Answers about live USGS and NASA data, accounts, and tree campaigns.",
            "/og-image.jpg",
        ),
        "/contact": (
            "Contact Climate Wavers",
            "Reach the Climate Wavers team for partnerships, support, and climate action.",
            "/community-respond.jpg",
        ),
        "/pricing": (
            "Pricing · Climate Wavers",
            "Plans and pricing for Climate Wavers disaster alerts and climate action.",
            "/og-image.jpg",
        ),
        "/consulting": (
            "Consulting · Climate Wavers",
            "FlowOps Africa consulting for disaster systems and climate data.",
            "/ai-disaster.jpg",
        ),
        "/support": (
            "Support · Climate Wavers",
            "Get help with Climate Wavers accounts, alerts, tree gifts, and Plastic Pulse.",
            "/community-respond.jpg",
        ),
        "/disasters": (
            "Live disasters · Climate Wavers",
            "Verified and official disaster alerts for Africa — USGS, NASA, and community response.",
            "/emergency-response.jpg",
        ),
        "/champions": (
            "Climate Champions · Climate Wavers",
            "Meet Climate Wavers champions leading local climate action.",
            "/climate-action-network.jpg",
        ),
        "/app": (
            "Climate Wavers app",
            "Open your feed, chats, alerts, and tree projects on Climate Wavers.",
            "/og-image.jpg",
        ),
        "/app/calendar": (
            "Climate Calendar · Climate Wavers",
            "Schedule Climate events, invite collaborators, and RSVP with your network.",
            "/environment.jpg",
        ),
    }
    known = path_previews.get(path)
    if not known and path.startswith("/disasters/"):
        known = path_previews["/disasters"]
    if not known and path.startswith("/app/calendar"):
        known = path_previews["/app/calendar"]
    if not known and path.startswith("/app"):
        known = path_previews["/app"]
    if not known and path.startswith("/champions"):
        known = path_previews["/champions"]
    if known:
        title, description, image_path = known
        return {
            "url": f"{base}{'' if path == '/' else path}",
            "title": title,
            "description": description,
            "image": f"{base}{image_path}",
            "site_name": "Climate Wavers",
        }

    return {
        "url": href,
        "title": "Climate Wavers",
        "description": "Open this page on Climate Wavers.",
        "image": og,
        "site_name": "Climate Wavers",
    }


def post_media_preview(post):
    """Uploaded image / GIF / video still for a post."""
    if not post:
        return None
    for attr in ("image", "gif"):
        url = _http_url(getattr(post, attr, None))
        if url:
            return {
                "image": url,
                "title": "",
                "description": "",
                "site_name": "Climate Wavers",
                "url": "",
                "kind": "media",
            }
    video = _http_url(getattr(post, "video", None))
    if video:
        still = _cloudinary_video_still(video)
        if still:
            return {
                "image": still,
                "title": "",
                "description": "",
                "site_name": "Climate Wavers",
                "url": "",
                "kind": "media",
            }
    return None


def post_preview_hero(post):
    """Public image URL for email hero from a Post, or None."""
    preview = post_preview_card(post)
    return (preview or {}).get("image") or None


def post_preview_card(post):
    """
    Full preview payload for email: prefer uploaded media, else first
    Climate Wavers link in the post (same idea as in-app link cards).
    """
    if not post:
        return None
    media = post_media_preview(post)
    if media:
        media["image"] = _email_fit_image(media["image"])
        return media
    for url in _extract_urls(getattr(post, "content", None) or ""):
        link = resolve_site_link_preview(url)
        if link and link.get("image"):
            link = dict(link)
            link["image"] = _email_fit_image(link["image"])
            link["kind"] = "link"
            return link
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

    preview = post_preview_card(post) if post is not None else None
    resolved_hero = _http_url(hero_image) if hero_image else ""
    if not resolved_hero and preview:
        resolved_hero = preview.get("image") or ""
    if not resolved_hero:
        resolved_hero = f"{frontend_base()}/og-image.jpg"

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
            "preview_kind": (preview or {}).get("kind") or "",
            "preview_title": (preview or {}).get("title") or "",
            "preview_description": (preview or {}).get("description") or "",
            "preview_site_name": (preview or {}).get("site_name") or "",
            "preview_url": (preview or {}).get("url") or dest,
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
