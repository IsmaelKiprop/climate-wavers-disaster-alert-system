"""Branded Open Graph images: profile photo + Climate Wavers logo blend."""

from __future__ import annotations

import io
import logging
from pathlib import Path
from urllib.request import Request, urlopen

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from PIL import Image, ImageDraw, ImageFilter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from api.models import User

from .profile_share import frontend_base, https_url

logger = logging.getLogger(__name__)

OG_W, OG_H = 1200, 630
LOGO_PATH = Path(__file__).resolve().parent / "static_assets" / "logo.jpg"
FETCH_TIMEOUT = 12


def _fetch_image(url: str) -> Image.Image | None:
    if not url:
        return None
    try:
        req = Request(
            url,
            headers={"User-Agent": "ClimateWavers-OG/1.0", "Accept": "image/*"},
        )
        with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            data = resp.read()
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        logger.exception("OG image fetch failed for %s", url[:120])
        return None


def _cover_fit(img: Image.Image, width: int, height: int) -> Image.Image:
    src_w, src_h = img.size
    if src_w <= 0 or src_h <= 0:
        return Image.new("RGBA", (width, height), (15, 23, 42, 255))
    scale = max(width / src_w, height / src_h)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - width) // 2
    top = (new_h - height) // 2
    return resized.crop((left, top, left + width, top + height))


def _rounded_rect_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def _logo_badge(logo: Image.Image, badge_h: int = 96) -> Image.Image:
    """Seat the logo on a light plate (same idea as BrandLogo) for contrast on photos."""
    pad = 10
    max_logo_h = badge_h - pad * 2
    lw, lh = logo.size
    scale = max_logo_h / max(lh, 1)
    logo_w = max(1, int(lw * scale))
    logo_h = max(1, int(lh * scale))
    logo_fit = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)

    badge_w = logo_w + pad * 2
    badge = Image.new("RGBA", (badge_w, badge_h), (255, 255, 255, 235))
    badge.paste(logo_fit, (pad, (badge_h - logo_h) // 2), logo_fit)

    mask = _rounded_rect_mask((badge_w, badge_h), radius=12)
    out = Image.new("RGBA", (badge_w, badge_h), (0, 0, 0, 0))
    out.paste(badge, (0, 0), mask)
    return out


def _fallback_canvas() -> Image.Image:
    canvas = Image.new("RGBA", (OG_W, OG_H), (15, 23, 42, 255))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, OG_H - 180, OG_W, OG_H), fill=(6, 78, 59, 90))
    return canvas


def compose_profile_og(photo_url: str | None) -> bytes:
    photo = _fetch_image(photo_url) if photo_url else None
    if photo:
        canvas = _cover_fit(photo, OG_W, OG_H)
    else:
        canvas = _fallback_canvas()

    # Soft bottom fade so the logo plate reads clearly.
    fade = Image.new("RGBA", (OG_W, OG_H), (0, 0, 0, 0))
    fade_draw = ImageDraw.Draw(fade)
    for i in range(160):
        alpha = int(110 * (i / 159))
        y = OG_H - 160 + i
        fade_draw.line([(0, y), (OG_W, y)], fill=(0, 0, 0, alpha))
    canvas = Image.alpha_composite(canvas, fade)

    logo = None
    if LOGO_PATH.exists():
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
        except Exception:
            logger.exception("Failed to open local OG logo")
    if logo is None:
        logo = _fetch_image(f"{frontend_base()}/logo.jpg")

    if logo is not None:
        badge = _logo_badge(logo, badge_h=100)
        # Soft shadow under the badge.
        shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        sx = OG_W - badge.width - 36
        sy = OG_H - badge.height - 32
        shadow_box = Image.new("RGBA", (badge.width + 12, badge.height + 12), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow_box)
        shadow_draw.rounded_rectangle(
            (0, 0, badge.width + 11, badge.height + 11),
            radius=14,
            fill=(0, 0, 0, 90),
        )
        shadow_box = shadow_box.filter(ImageFilter.GaussianBlur(6))
        shadow.paste(shadow_box, (sx - 4, sy - 2), shadow_box)
        canvas = Image.alpha_composite(canvas, shadow)
        canvas.paste(badge, (sx, sy), badge)

    rgb = canvas.convert("RGB")
    buf = io.BytesIO()
    rgb.save(buf, format="JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue()


@api_view(["GET"])
@permission_classes([AllowAny])
def profile_og_image(request, user_id):
    """
    1200×630 share preview: profile photo with Climate Wavers logo blended on.
    Used as og:image for WhatsApp / Facebook / X crawlers.
    """
    user = get_object_or_404(User, pk=user_id, is_active=True)
    photo = https_url(user.profile_picture) or f"{frontend_base()}/og-image.jpg"
    try:
        jpeg = compose_profile_og(photo)
    except Exception:
        logger.exception("OG compose failed for user %s", user_id)
        jpeg = compose_profile_og(None)

    response = HttpResponse(jpeg, content_type="image/jpeg")
    response["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    response["Content-Disposition"] = f'inline; filename="climate-wavers-u{user_id}.jpg"'
    return response
