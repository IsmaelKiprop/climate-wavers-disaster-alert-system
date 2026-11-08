"""Public profile share helpers and OG HTML for social previews."""

import html
import os
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.models import User
from .models import Follow, TreeProjectDonation


def frontend_base():
    return (
        os.getenv("FRONTEND_URL", "").strip().rstrip("/")
        or "https://alerts.flowops.africa"
    )


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


def public_profile_payload(user):
    trees = trees_for_user(user)
    display_name = f"{user.first_name} {user.last_name}".strip() or user.username
    photo = https_url(user.profile_picture) or f"{frontend_base()}/avatar.png"
    cover = https_url(getattr(user, "cover", None)) or f"{frontend_base()}/environment.jpg"
    complete = profile_is_complete(user)
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
        "followers_count": Follow.objects.filter(following=user).count(),
        "following_count": Follow.objects.filter(follower=user).count(),
        "is_profile_complete": complete,
        "share_enabled": complete,
        "trees": trees,
        "share_url": f"{frontend_base()}/u/{user.id}",
        "og_share_url": f"{os.getenv('BACKEND_PUBLIC_URL', 'https://climate-wavers-api.onrender.com').rstrip('/')}/share/profile/{user.id}/",
    }


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
    """
    user = get_object_or_404(User, pk=user_id, is_active=True)
    payload = public_profile_payload(user)
    if not payload["share_enabled"]:
        app_url = frontend_base()
        return HttpResponse(
            f"""<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Profile not ready</title>
<meta http-equiv="refresh" content="0;url={html.escape(app_url)}" />
</head><body><p>This profile is not ready to share.</p></body></html>""",
            content_type="text/html; charset=utf-8",
            status=403,
        )
    app_url = payload["share_url"]
    title = html.escape(f"{payload['display_name']} (@{payload['username']}) on Climate Wavers")
    trees = payload["trees"]["trees_total"]
    place = payload["location"] or payload["country"] or "Africa"
    bio = (payload["bio"] or "").strip()
    description = html.escape(
        bio
        or f"Climate Wavers member from {place}. {trees} trees planted for climate action. Gift a tree to support their impact."
    )
    image = html.escape(payload["profile_picture"] or f"{frontend_base()}/og-image.jpg")
    canonical = html.escape(app_url)
    api_share = html.escape(request.build_absolute_uri())

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
  <meta property="og:image:alt" content="{title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{description}" />
  <meta name="twitter:image" content="{image}" />
  <meta http-equiv="refresh" content="0;url={canonical}" />
  <script>window.location.replace({html.escape(repr(app_url))});</script>
</head>
<body style="font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; padding:2rem;">
  <main>
    <p>Opening <a href="{canonical}" style="color:#5eead4;">{html.escape(payload['display_name'])}</a> on Climate Wavers…</p>
    <p style="opacity:.7;font-size:.875rem;">Preview source: {api_share}</p>
  </main>
</body>
</html>"""
    return HttpResponse(body, content_type="text/html; charset=utf-8")
