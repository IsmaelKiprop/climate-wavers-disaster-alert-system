"""Fast CDN Open Graph image URLs (Cloudinary + Climate Wavers logo)."""

from __future__ import annotations

import re

# Uploaded once to Cloudinary (unsigned preset). Overlay public_id uses ":" for "/".
CLOUDINARY_LOGO_LAYER = "disax:climate-wavers:brand-logo"

_CLOUDINARY_UPLOAD = re.compile(
    r"^(https://res\.cloudinary\.com/[^/]+/image/upload)/(.+)$",
    re.I,
)
_VERSION_PATH = re.compile(r"(v\d+/.+)$")


def cloudinary_branded_og(photo_url: str | None) -> str | None:
    """
    Build a 1200×630 Cloudinary URL with the Climate Wavers logo blended on.
    Returns None when the photo is not a Cloudinary upload URL.
    """
    if not photo_url:
        return None
    url = str(photo_url).strip()
    if url.startswith("http://"):
        url = "https://" + url[7:]

    match = _CLOUDINARY_UPLOAD.match(url)
    if not match:
        return None

    base, rest = match.group(1), match.group(2)
    version = _VERSION_PATH.search(rest)
    if not version:
        return None

    public_path = version.group(1)
    transforms = (
        "w_1200,h_630,c_fill,g_auto,q_auto,f_jpg/"
        f"l_{CLOUDINARY_LOGO_LAYER}/c_scale,w_150/"
        "fl_layer_apply,g_south_east,x_40,y_36"
    )
    return f"{base}/{transforms}/{public_path}"


def cloudinary_resized(photo_url: str | None, width: int = 1200, height: int = 630) -> str | None:
    """Same-origin Cloudinary photo resized for faster server-side compositing."""
    if not photo_url:
        return None
    url = str(photo_url).strip()
    if url.startswith("http://"):
        url = "https://" + url[7:]
    match = _CLOUDINARY_UPLOAD.match(url)
    if not match:
        return None
    base, rest = match.group(1), match.group(2)
    version = _VERSION_PATH.search(rest)
    if not version:
        return None
    return f"{base}/w_{width},h_{height},c_fill,g_auto,q_auto,f_jpg/{version.group(1)}"
