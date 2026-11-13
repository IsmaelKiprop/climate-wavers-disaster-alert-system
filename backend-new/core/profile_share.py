"""Public profile share helpers and OG HTML for social previews."""

import html
import os
import re
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.models import User
from .models import Follow, TreeProjectDonation

CRAWLER_UA = re.compile(
    r"whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|"
    r"slackbot|discordbot|telegrambot|embedly|pinterest|quora link preview|"
    r"googlebot|bingbot|duckduckbot|baiduspider|yandex|crawler|spider|bot|preview",
    re.I,
)


def frontend_base():
    """
    Always one origin. Never paste ALLOWED_ORIGINS into FRONTEND_URL —
    a comma list breaks redirects (browser treats it as one hostname).
    """
    try:
        from django.conf import settings

        configured = str(getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")
        if configured and "," not in configured and ";" not in configured:
            return configured
    except Exception:
        pass

    raw = os.getenv("FRONTEND_URL", "").strip()
    parts = [
        part.strip().rstrip("/")
        for part in raw.replace(";", ",").split(",")
        if part and part.strip()
    ]
    preferred = ("alerts.flowops.africa", "climatewavers.org")
    https_parts = [
        part
        for part in parts
        if part.startswith("https://") and "localhost" not in part
    ]
    for host in preferred:
        for part in https_parts:
            if host in part:
                return part
    if https_parts:
        return https_parts[0]
    return "https://alerts.flowops.africa"


def https_url(url):
    if not url:
        return None
    value = str(url).strip()
    if value.startswith("http://"):
        return f"https://{value[7:]}"
    return value


def profile_is_complete(user):
    has_photo = bool(
        https_url(getattr(user, "profile_pic", None))
        or https_url(getattr(user, "picture", None))
    )
    return bool(
        (user.first_name or "").strip()
        and (user.last_name or "").strip()
        and (user.username or "").strip()
        and (user.bio or "").strip()
        and ((user.country or "").strip() or (user.location or "").strip())
        and has_photo
    )


def trees_for_user(user):
    bought = (
        TreeProjectDonation.objects.filter(donor=user, payment_status="completed").aggregate(
            total=Sum("trees_purchased")
        )["total"]
        or 0
    )
    gifted = (
        TreeProjectDonation.objects.filter(gifted_to=user, payment_status="completed").aggregate(
            total=Sum("trees_purchased")
        )["total"]
        or 0
    )
    return {
        "trees_bought": bought,
        "trees_gifted_to_them": gifted,
        "trees_total": bought + gifted,
    }


def api_base():
    """Public backend origin used for generated OG images (must be HTTPS in prod)."""
    candidates = []
    try:
        from django.conf import settings

        for key in ("BACKEND_PUBLIC_URL", "BASE_URL", "BACKEND_HOST"):
            value = str(getattr(settings, key, "") or "").strip().rstrip("/")
            if value:
                candidates.append(value)
    except Exception:
        pass
    for key in ("BACKEND_PUBLIC_URL", "BASE_URL", "BACKEND_HOST"):
        value = os.getenv(key, "").strip().rstrip("/")
        if value:
            candidates.append(value)

    public = [
        url
        for url in candidates
        if url
        and "," not in url
        and "localhost" not in url
        and "127.0.0.1" not in url
    ]
    if public:
        return public[0]
    # Production API (share crawlers hit this for branded og:image).
    return "https://climate-wavers-api.onrender.com"


def og_image_url(user_id):
    """Fallback server-composited OG image (non-Cloudinary photos)."""
    return f"{api_base()}/api/v1/users/{user_id}/og-image/"


def share_og_image(photo_url, user_id):
    """
    Prefer a Cloudinary CDN URL with the logo blended on (fast + HEAD-friendly).
    Fall back to the API compositor for non-Cloudinary photos.
    """
    from .og_brand import cloudinary_branded_og

    branded = cloudinary_branded_og(photo_url)
    if branded:
        return branded
    return og_image_url(user_id)


def public_profile_payload(user):
    trees = trees_for_user(user)
    display_name = f"{user.first_name} {user.last_name}".strip() or user.username
    photo = https_url(user.profile_picture) or f"{frontend_base()}/og-image.jpg"
    cover = https_url(getattr(user, "cover", None)) or f"{frontend_base()}/environment.jpg"
    complete = profile_is_complete(user)
    site = frontend_base()
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "display_name": display_name,
        "bio": user.bio or "",
        "country": user.country or "",
        "state": user.state or "",
        "location": user.location or "",
        "profession": user.profession or "",
        "website": user.website or "",
        "profile_picture": photo,
        "cover": cover,
        "og_image": share_og_image(photo, user.id),
        "followers_count": Follow.objects.filter(following=user).count(),
        "following_count": Follow.objects.filter(follower=user).count(),
        "is_profile_complete": complete,
        "share_enabled": complete,
        "trees": trees,
        "share_url": f"{site}/u/{user.id}",
        "og_share_url": f"{site}/u/{user.id}",
    }


def _is_crawler(request):
    ua = request.META.get("HTTP_USER_AGENT") or ""
    return bool(CRAWLER_UA.search(ua))


@api_view(["GET"])
@permission_classes([AllowAny])
def public_profile(request, user_id):
    """Public profile card used by /u/:id and gift flows. Always readable."""
    user = get_object_or_404(User, pk=user_id, is_active=True)
    return Response(public_profile_payload(user))


def share_profile_html(request, user_id):
    """
    Crawler-friendly HTML with Open Graph tags.
    Humans are redirected to the public frontend profile page.
    Crawlers get static OG tags only (no redirect) so WhatsApp previews work.
    """
    user = get_object_or_404(User, pk=user_id, is_active=True)
    payload = public_profile_payload(user)
    site = frontend_base()
    profile_url = payload["share_url"]
    share_url = payload["og_share_url"]

    if not payload["share_enabled"]:
        return HttpResponse(
            f"""<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Profile not ready</title>
<meta property="og:title" content="Profile not ready | Climate Wavers" />
<meta property="og:description" content="This Climate Wavers profile is still being set up." />
<meta property="og:url" content="{html.escape(share_url)}" />
<meta property="og:image" content="{html.escape(site + '/og-image.jpg')}" />
<meta property="og:image:type" content="image/jpeg" />
<meta http-equiv="refresh" content="0;url={html.escape(site)}" />
</head><body><p>This profile is not ready to share.</p></body></html>""",
            content_type="text/html; charset=utf-8",
            status=403,
        )

    title = html.escape(f"{payload['display_name']} (@{payload['username']}) on Climate Wavers")
    trees = payload["trees"]["trees_total"]
    place = payload["location"] or payload["country"] or "Africa"
    bio = (payload["bio"] or "").strip()
    description = html.escape(
        bio
        or f"Climate Wavers member from {place}. {trees} trees planted for climate action. Gift a tree to support their impact."
    )
    image = html.escape(
        payload.get("og_image")
        or share_og_image(payload.get("profile_picture"), user_id)
    )
    canonical = html.escape(share_url)
    profile_href = html.escape(profile_url)
    crawler = _is_crawler(request)

    # WhatsApp/Facebook must see meta tags without being redirected away.
    redirect_bits = ""
    if not crawler:
        redirect_bits = f"""
  <meta http-equiv="refresh" content="0;url={profile_href}" />
  <script>window.location.replace({html.escape(repr(profile_url))});</script>
"""

    body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Climate Wavers" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:image" content="{image}" />
  <meta property="og:image:secure_url" content="{image}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{description}" />
  <meta name="twitter:image" content="{image}" />
  {redirect_bits}
</head>
<body style="font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; padding:2rem;">
  <main>
    <h1>{title}</h1>
    <p>{description}</p>
    <p><a href="{profile_href}" style="color:#5eead4;">Open profile</a></p>
  </main>
</body>
</html>"""
    response = HttpResponse(body, content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response
