"""
Branded tree-planting certificates (Climate Wavers + FlowOps).

- Auto-issue + email after a successful donation
- Regenerable PNG for download / re-send
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

TEAL = (6, 125, 131)
TEAL_DARK = (5, 90, 95)
NAVY = (12, 48, 58)
GOLD = (184, 148, 60)
GOLD_LIGHT = (212, 180, 98)
INK = (20, 28, 36)
MUTED = (90, 100, 110)
CREAM = (250, 249, 246)
PAPER = (252, 251, 248)
WHITE = (255, 255, 255)
BORDER = (13, 148, 136)

FOUNDER_NAME = "Ismael Kiprop"
FOUNDER_TITLE = "Founder & CEO of FlowOps Africa"


def frontend_base() -> str:
    return (getattr(settings, "FRONTEND_URL", "") or "https://alerts.flowops.africa").rstrip(
        "/"
    )


def _display_name(user) -> str:
    if not user:
        return ""
    try:
        full = (user.get_full_name() or "").strip()
    except Exception:
        full = ""
    if full:
        return full
    name = " ".join(
        filter(None, [getattr(user, "first_name", ""), getattr(user, "last_name", "")])
    ).strip()
    if name:
        return name
    return (getattr(user, "username", "") or "").strip()


def certificate_id_for(donation) -> str:
    existing = (getattr(donation, "certificate_id", "") or "").strip()
    if existing:
        return existing
    return f"CW-{donation.payment_reference}-{donation.id}"


def donor_label(donation) -> str:
    stored = (getattr(donation, "donor_display_name", "") or "").strip()
    if stored:
        return stored
    if donation.donor_id:
        return _display_name(donation.donor) or donation.payer_email or "Climate Wavers supporter"
    return (donation.payer_email or "Climate Wavers supporter").split("@")[0]


def gifted_label(donation) -> str:
    if not donation.gifted_to_id:
        return ""
    # Self-gift / same person — show as a planting, not a gift line
    if donation.donor_id and donation.gifted_to_id == donation.donor_id:
        return ""
    label = _display_name(donation.gifted_to) or f"Member #{donation.gifted_to_id}"
    donor = donor_label(donation)
    if label and donor and label.strip().lower() == donor.strip().lower():
        return ""
    return label


def species_summary(donation) -> str:
    selected = getattr(donation, "selected_species", None) or {}
    if isinstance(selected, dict) and selected:
        parts = [
            f"{name} x {int(qty)}"
            for name, qty in selected.items()
            if int(qty or 0) > 0
        ]
        if parts:
            return ", ".join(parts)
    return "Verified seedling"


def _cert_text(text: str) -> str:
    """Normalize fancy punctuation so certificate fonts never show tofu boxes."""
    if not text:
        return ""
    replacements = {
        "\u2014": "-",  # em dash
        "\u2013": "-",  # en dash
        "\u2212": "-",  # minus
        "\u00d7": "x",  # multiply
        "\u2022": "*",
        "\u00b7": "-",  # middle dot
        "\u2026": "...",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
        "\u202f": " ",
        "CO\u2082": "CO2",
        "\u2082": "2",
    }
    out = str(text)
    for src, dst in replacements.items():
        out = out.replace(src, dst)
    return out


def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    try:
        box = draw.textbbox((0, 0), text, font=font)
        return max(0, box[2] - box[0])
    except Exception:
        return int(len(text) * (getattr(font, "size", 16) * 0.55))


def _center_text(draw, y, text, font, fill, canvas_w, x0=0, x1=None):
    text = _cert_text(text)
    x1 = canvas_w if x1 is None else x1
    tw = _text_width(draw, text, font)
    x = x0 + max(0, ((x1 - x0) - tw) // 2)
    draw.text((x, y), text, fill=fill, font=font)
    return y


def _draw_cw_mark(img: Image.Image, cx: int, cy: int, size: int = 72) -> None:
    """Drawn Climate Wavers mark (leaf + wave) so branding works offline."""
    draw = ImageDraw.Draw(img)
    r = size // 2
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
    # Leaf
    leaf = [
        (cx, cy - int(r * 0.62)),
        (cx + int(r * 0.48), cy + int(r * 0.08)),
        (cx, cy + int(r * 0.55)),
        (cx - int(r * 0.48), cy + int(r * 0.08)),
    ]
    draw.polygon(leaf, fill=TEAL)
    draw.line(
        [(cx, cy - int(r * 0.45)), (cx, cy + int(r * 0.42))],
        fill=WHITE,
        width=max(2, size // 28),
    )
    # Soft wave under mark
    draw.arc(
        [cx - int(r * 0.7), cy + int(r * 0.15), cx + int(r * 0.7), cy + int(r * 0.95)],
        start=200,
        end=340,
        fill=TEAL_DARK,
        width=max(2, size // 26),
    )


def _draw_planted_tree(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    *,
    trees: int = 1,
    size: int = 88,
) -> None:
    """Stylized tree mark for footer (replaces duplicate CW logo)."""
    s = size
    ring = int(s * 0.48)
    # Gold ring first so tree sits inside cleanly
    draw.ellipse(
        [cx - ring, cy - ring, cx + ring, cy + ring],
        outline=GOLD,
        width=2,
    )
    # Soft ground oval (inside ring)
    draw.ellipse(
        [cx - int(s * 0.34), cy + int(s * 0.18), cx + int(s * 0.34), cy + int(s * 0.34)],
        fill=(226, 232, 228),
    )
    # Trunk
    trunk_w = max(5, s // 12)
    draw.rectangle(
        [cx - trunk_w // 2, cy - int(s * 0.02), cx + trunk_w // 2, cy + int(s * 0.28)],
        fill=(120, 82, 48),
    )
    # Layered canopy (kept inside the ring)
    canopy = [
        (cx, cy - int(s * 0.28), int(s * 0.22), TEAL_DARK),
        (cx - int(s * 0.14), cy - int(s * 0.12), int(s * 0.18), TEAL),
        (cx + int(s * 0.14), cy - int(s * 0.12), int(s * 0.18), TEAL),
        (cx, cy - int(s * 0.02), int(s * 0.20), (8, 145, 148)),
    ]
    for tx, ty, r, color in canopy:
        draw.ellipse([tx - r, ty - r, tx + r, ty + r], fill=color)
    # Label clearly below the ring (no overlap)
    label = _load_font(11, bold=True)
    text = "TREE PLANTED" if trees == 1 else f"{trees} TREES PLANTED"
    tw = _text_width(draw, text, label)
    draw.text((cx - tw // 2, cy + ring + 8), text, fill=TEAL, font=label)


def _draw_seal(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int = 78) -> None:
    """Gold-and-navy seal: tree mark + VERIFIED (fits small radius)."""
    ribbon_w = int(radius * 0.55)
    ribbon_h = int(radius * 1.05)
    left = [
        (cx - ribbon_w - 4, cy + 8),
        (cx - 6, cy + 8),
        (cx - ribbon_w // 2 - 8, cy + ribbon_h),
        (cx - ribbon_w - 2, cy + ribbon_h - 10),
        (cx - ribbon_w // 2 - 2, cy + ribbon_h - 22),
    ]
    right = [
        (cx + 6, cy + 8),
        (cx + ribbon_w + 4, cy + 8),
        (cx + ribbon_w // 2 + 2, cy + ribbon_h - 22),
        (cx + ribbon_w + 2, cy + ribbon_h - 10),
        (cx + ribbon_w // 2 + 8, cy + ribbon_h),
    ]
    draw.polygon(left, fill=TEAL_DARK)
    draw.polygon(right, fill=TEAL)
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=GOLD,
        outline=NAVY,
        width=2,
    )
    inner = radius - 8
    draw.ellipse(
        [cx - inner, cy - inner, cx + inner, cy + inner],
        fill=NAVY,
        outline=GOLD_LIGHT,
        width=2,
    )
    # Compact tree inside seal
    trunk_w = max(3, radius // 14)
    draw.rectangle(
        [cx - trunk_w // 2, cy - 2, cx + trunk_w // 2, cy + int(radius * 0.28)],
        fill=(184, 148, 60),
    )
    for tx, ty, r in (
        (cx, cy - int(radius * 0.38), int(radius * 0.22)),
        (cx - int(radius * 0.16), cy - int(radius * 0.18), int(radius * 0.18)),
        (cx + int(radius * 0.16), cy - int(radius * 0.18), int(radius * 0.18)),
        (cx, cy - int(radius * 0.08), int(radius * 0.20)),
    ):
        draw.ellipse([tx - r, ty - r, tx + r, ty + r], fill=TEAL)
    # Single clear label — sized to radius so it never clips the ring
    label_size = max(10, min(14, radius // 4))
    seal_font = _load_font(label_size, bold=True)
    label = "VERIFIED"
    tw = _text_width(draw, label, seal_font)
    draw.text(
        (cx - tw // 2, cy + int(radius * 0.32)),
        label,
        fill=GOLD_LIGHT,
        font=seal_font,
    )


def _load_font(size: int, bold: bool = False, serif: bool = False):
    candidates = []
    if serif:
        if bold:
            candidates.extend(
                [
                    "C:/Windows/Fonts/georgiab.ttf",
                    "C:/Windows/Fonts/timesbd.ttf",
                    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
                    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
                ]
            )
        candidates.extend(
            [
                "C:/Windows/Fonts/georgia.ttf",
                "C:/Windows/Fonts/times.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
            ]
        )
    if bold:
        candidates.extend(
            [
                "C:/Windows/Fonts/arialbd.ttf",
                "C:/Windows/Fonts/segoeuib.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            ]
        )
    candidates.extend(
        [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    )
    for path in candidates:
        try:
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _wrap_text(draw, text: str, font, max_width: int) -> List[str]:
    words = (text or "").split()
    if not words:
        return []
    lines: List[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if _text_width(draw, trial, font) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_paper_texture(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Subtle diagonal hatch — solid strokes, no gradients."""
    step = 14
    for i in range(-h, w + h, step):
        draw.line([(i, 0), (i + h, h)], fill=(240, 238, 232), width=1)


def _corner_bracket(
    draw: ImageDraw.ImageDraw,
    *,
    x: int,
    y: int,
    arm: int,
    thick: int,
    h_dir: int,
    v_dir: int,
    primary,
    accent,
) -> None:
    """Thick L-bracket with overlapping gold edge (recognition sample style)."""
    # Primary L
    draw.rectangle(
        [
            x if h_dir > 0 else x - arm,
            y if v_dir > 0 else y - thick,
            x + arm if h_dir > 0 else x,
            y + thick if v_dir > 0 else y,
        ],
        fill=primary,
    )
    draw.rectangle(
        [
            x if h_dir > 0 else x - thick,
            y if v_dir > 0 else y - arm,
            x + thick if h_dir > 0 else x,
            y + arm if v_dir > 0 else y,
        ],
        fill=primary,
    )
    # Gold inner edge along the L
    inset = 7
    g = 5
    draw.rectangle(
        [
            x + inset if h_dir > 0 else x - arm + inset,
            y + inset if v_dir > 0 else y - g - inset,
            x + arm - inset if h_dir > 0 else x - inset,
            y + inset + g if v_dir > 0 else y - inset,
        ],
        fill=accent,
    )
    draw.rectangle(
        [
            x + inset if h_dir > 0 else x - inset - g,
            y + inset if v_dir > 0 else y - arm + inset,
            x + inset + g if h_dir > 0 else x - inset,
            y + arm - inset if v_dir > 0 else y - inset,
        ],
        fill=accent,
    )
    # Sharp 45° bevel tip where arms meet
    tip = [
        (x + (thick if h_dir > 0 else -thick), y),
        (x, y),
        (x, y + (thick if v_dir > 0 else -thick)),
    ]
    draw.polygon(tip, fill=accent)


def _draw_formal_frame(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Landscape geometric frame: navy/teal L-corners + gold inner rule."""
    m = 42
    # Outer navy band
    draw.rectangle([m, m, w - m, h - m], outline=NAVY, width=12)
    # Gold inner rule
    draw.rectangle([m + 16, m + 16, w - m - 16, h - m - 16], outline=GOLD, width=3)
    # Thin teal accent
    draw.rectangle([m + 26, m + 26, w - m - 26, h - m - 26], outline=TEAL, width=1)

    arm = 150
    thick = 22
    # Asymmetric emphasis like the sample: stronger top-right + bottom-left
    _corner_bracket(
        draw, x=m, y=m, arm=arm, thick=thick, h_dir=1, v_dir=1, primary=TEAL, accent=GOLD
    )
    _corner_bracket(
        draw,
        x=w - m,
        y=m,
        arm=arm + 20,
        thick=thick + 2,
        h_dir=-1,
        v_dir=1,
        primary=NAVY,
        accent=GOLD,
    )
    _corner_bracket(
        draw,
        x=m,
        y=h - m,
        arm=arm + 20,
        thick=thick + 2,
        h_dir=1,
        v_dir=-1,
        primary=NAVY,
        accent=GOLD,
    )
    _corner_bracket(
        draw,
        x=w - m,
        y=h - m,
        arm=arm,
        thick=thick,
        h_dir=-1,
        v_dir=-1,
        primary=TEAL,
        accent=GOLD,
    )


def _draw_gold_divider(draw, y: int, canvas_w: int, margin: int = 160) -> None:
    mid = canvas_w // 2
    draw.line([(margin, y), (mid - 20, y)], fill=GOLD, width=2)
    draw.line([(mid + 20, y), (canvas_w - margin, y)], fill=GOLD, width=2)
    # Diamond centerpiece
    d = 9
    draw.polygon(
        [(mid, y - d), (mid + d, y), (mid, y + d), (mid - d, y)],
        fill=GOLD,
        outline=GOLD_LIGHT,
    )


def _fetch_logo(url: str, max_w: int = 220, max_h: int = 72) -> Optional[Image.Image]:
    if not url:
        return None
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "ClimateWavers-Certificate/1.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
        return img
    except Exception as exc:
        logger.warning("Certificate logo fetch failed (%s): %s", url, exc)
        return None


def _certificates_static_dir() -> str:
    return os.path.join(os.path.abspath(os.path.dirname(__file__)), "static", "certificates")


def _load_image_file(path: str, max_w: int, max_h: int) -> Optional[Image.Image]:
    try:
        if not path or not os.path.exists(path):
            return None
        img = Image.open(path).convert("RGBA")
        img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
        return img
    except Exception:
        return None


def _cw_logo(max_w: int = 220, max_h: int = 120) -> Optional[Image.Image]:
    """Real Climate Wavers logo (bundled first, then CDN)."""
    static_dir = _certificates_static_dir()
    here = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.join(static_dir, "climate_wavers_logo.png"),
        os.path.join(static_dir, "climate_wavers_logo.jpg"),
        os.path.join(here, "..", "..", "frontend", "public", "logo.jpg"),
        os.path.join(here, "..", "..", "frontend", "dist", "logo.jpg"),
    ]
    for path in candidates:
        logo = _load_image_file(path, max_w, max_h)
        if logo:
            return logo
    return _fetch_logo(f"{frontend_base()}/logo.jpg", max_w=max_w, max_h=max_h)


def _flowops_logo(max_w: int = 160, max_h: int = 160) -> Optional[Image.Image]:
    """Real FlowOps Africa logo (bundled first, then CDN)."""
    static_dir = _certificates_static_dir()
    here = os.path.abspath(os.path.dirname(__file__))
    candidates = [
        os.path.join(static_dir, "flowops_logo.png"),
        os.path.join(here, "..", "..", "frontend", "public", "flowops-logo.png"),
        os.path.join(here, "..", "..", "frontend", "dist", "flowops-logo.png"),
    ]
    for path in candidates:
        logo = _load_image_file(path, max_w, max_h)
        if logo:
            return logo
    return _fetch_logo(
        "https://www.flowops.africa/assets/Logo.png", max_w=max_w, max_h=max_h
    )


def _paste_logo(canvas: Image.Image, logo: Optional[Image.Image], x: int, y: int) -> Tuple[int, int]:
    if not logo:
        return 0, 0
    canvas.paste(logo, (x, y), logo if logo.mode == "RGBA" else None)
    return logo.size


def build_certificate_context(donation) -> Dict[str, Any]:
    project = donation.project
    location = ""
    if project:
        location = ", ".join(
            filter(None, [getattr(project, "city", None), getattr(project, "country", None)])
        )
    issued = donation.certificate_issued_at or donation.created_at or timezone.now()
    if timezone.is_aware(issued):
        issued_local = timezone.localtime(issued)
    else:
        issued_local = issued
    return {
        "certificate_id": certificate_id_for(donation),
        "donor_name": donor_label(donation),
        "gifted_to": gifted_label(donation),
        "project_name": getattr(project, "name", "") or "Climate Wavers project",
        "organization_name": getattr(project, "organization_name", "") or "",
        "location": location or "Africa",
        "species": species_summary(donation),
        "trees": int(donation.trees_purchased or 1),
        "amount": float(donation.amount or 0),
        "currency": "KES",
        "payment_reference": donation.payment_reference or "",
        "co2": float(getattr(project, "co2_absorption_per_tree", 22) or 22)
        * int(donation.trees_purchased or 1),
        "issued_on": issued_local.strftime("%d %B %Y"),
        "verify_url": (
            f"{frontend_base()}/verify/tree/"
            f"{urllib.parse.quote(certificate_id_for(donation), safe='')}"
        ),
        "founder_name": FOUNDER_NAME,
        "founder_title": FOUNDER_TITLE,
    }


def _make_qr_image(data: str, box: int = 120) -> Optional[Image.Image]:
    """QR for certificate verification — local qrcode lib, else public API."""
    if not data:
        return None
    try:
        import qrcode

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=4,
            border=1,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color=NAVY, back_color="white").convert("RGBA")
        img = img.resize((box, box), Image.Resampling.NEAREST)
        return img
    except Exception:
        pass
    try:
        url = (
            "https://api.qrserver.com/v1/create-qr-code/"
            f"?size={box}x{box}&margin=4&ecc=M&data={urllib.parse.quote(data, safe='')}"
        )
        req = urllib.request.Request(
            url, headers={"User-Agent": "ClimateWavers-Certificate/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            return Image.open(io.BytesIO(resp.read())).convert("RGBA")
    except Exception as exc:
        logger.warning("Certificate QR generation failed: %s", exc)
        return None


def render_certificate_png(donation) -> bytes:
    """Formal landscape Climate Wavers certificate (A2SV recognition-style)."""
    ctx = build_certificate_context(donation)
    w, h = 1600, 900
    img = Image.new("RGB", (w, h), PAPER)
    draw = ImageDraw.Draw(img)
    _draw_paper_texture(draw, w, h)
    _draw_formal_frame(draw, w, h)

    title_font = _load_font(46, bold=True, serif=True)
    name_font = _load_font(52, bold=True, serif=True)
    body_font = _load_font(21, serif=True)
    lead_font = _load_font(14, bold=True)
    tiny_font = _load_font(12)
    meta_font = _load_font(14)
    label_font = _load_font(12, bold=True)
    sign_font = _load_font(24, bold=True, serif=True)
    sign_title_font = _load_font(15)

    # Top centered Climate Wavers logo
    cw_logo = _cw_logo(max_w=160, max_h=96)
    y = 78
    if cw_logo:
        lx = (w - cw_logo.width) // 2
        draw.rounded_rectangle(
            [lx - 10, y - 6, lx + cw_logo.width + 10, y + cw_logo.height + 6],
            radius=6,
            fill=(10, 10, 10),
        )
        _paste_logo(img, cw_logo, lx, y)
        y += cw_logo.height + 20
    else:
        _draw_cw_mark(img, w // 2, y + 32, size=70)
        y += 84

    _center_text(draw, y, "CERTIFICATE OF PLANTATION", title_font, NAVY, w)
    y += 52
    _draw_gold_divider(draw, y, w, margin=280)
    y += 26

    _center_text(
        draw,
        y,
        "THE FOLLOWING AWARD IS GIVEN TO",
        lead_font,
        MUTED,
        w,
    )
    y += 30

    donor = (ctx["donor_name"] or "Climate Wavers supporter").strip()[:48]
    _center_text(draw, y, donor, name_font, INK, w)
    nw = _text_width(draw, donor, name_font)
    draw.line(
        [(w // 2 - nw // 2 - 12, y + 60), (w // 2 + nw // 2 + 12, y + 60)],
        fill=GOLD,
        width=2,
    )
    y += 78

    tree_word = "tree" if ctx["trees"] == 1 else "trees"
    if ctx["gifted_to"]:
        prose = (
            f"In honour of your generosity, {ctx['trees']} {tree_word} "
            f"will be planted as a gift for {ctx['gifted_to']}, supporting "
            f"{ctx['project_name']} in {ctx['location']}. "
            f"Your kindness helps restore living landscapes and strengthens "
            f"climate resilience across Africa, with an estimated "
            f"{ctx['co2']:.0f} kg of CO2 absorbed each year."
        )
    else:
        prose = (
            f"In recognition of your commitment to a greener future, "
            f"{ctx['trees']} {tree_word} will be planted through Climate Wavers "
            f"for {ctx['project_name']} in {ctx['location']}. "
            f"Your contribution nurtures ecosystems, uplifts local communities, "
            f"and advances climate action across Africa, absorbing an estimated "
            f"{ctx['co2']:.0f} kg of CO2 each year."
        )
    if ctx["organization_name"]:
        prose += f" This planting is hosted by {ctx['organization_name']}."
    prose = _cert_text(prose)

    for line in _wrap_text(draw, prose, body_font, w - 360):
        _center_text(draw, y, line, body_font, INK, w)
        y += 28

    y += 18
    details = [
        ("TREES", str(ctx["trees"])),
        ("SPECIES", _cert_text(ctx["species"] or "-")[:28]),
        ("ISSUED", _cert_text(ctx["issued_on"])),
    ]
    col_w = (w - 420) // len(details)
    for i, (label, value) in enumerate(details):
        cx = 210 + i * col_w + col_w // 2
        value = _cert_text(value)
        lw = _text_width(draw, label, label_font)
        draw.text((cx - lw // 2, y), label, fill=TEAL, font=label_font)
        vw = _text_width(draw, value, meta_font)
        draw.text((cx - vw // 2, y + 18), value, fill=INK, font=meta_font)

    y += 48
    id_bits = f"ID  {ctx['certificate_id']}"
    if ctx["payment_reference"]:
        id_bits += f"   ·   Ref  {ctx['payment_reference']}"
    _center_text(draw, y, id_bits[:90], tiny_font, MUTED, w)

    # Footer: planted tree | QR | seal | Founder & CEO (CW logo only at top)
    y += 18
    footer_y = y
    qr_img = _make_qr_image(ctx["verify_url"], box=96)

    _draw_planted_tree(
        draw,
        175,
        footer_y + 48,
        trees=int(ctx["trees"] or 1),
        size=86,
    )

    # QR left of seal
    if qr_img:
        qx = w // 2 - 200
        qy = footer_y + 6
        draw.rectangle(
            [qx - 4, qy - 4, qx + qr_img.width + 4, qy + qr_img.height + 4],
            fill=WHITE,
            outline=GOLD,
            width=2,
        )
        _paste_logo(img, qr_img, qx, qy)
        scan_font = _load_font(10, bold=True)
        sl = "SCAN TO VERIFY"
        sw = _text_width(draw, sl, scan_font)
        draw.text(
            (qx + (qr_img.width - sw) // 2, qy + qr_img.height + 5),
            sl,
            fill=TEAL,
            font=scan_font,
        )

    seal_cy = footer_y + 50
    _draw_seal(draw, w // 2 + 36, seal_cy, radius=52)

    # Founder & CEO (right) — A2SV-style signatory, no handwritten signature
    sign_x = w - 130
    sign_y = footer_y + 14
    sn = _cert_text(ctx.get("founder_name") or FOUNDER_NAME)
    st = _cert_text(ctx.get("founder_title") or FOUNDER_TITLE)
    sn_w = _text_width(draw, sn, sign_font)
    draw.text((sign_x - sn_w, sign_y), sn, fill=INK, font=sign_font)
    draw.line(
        [(sign_x - max(sn_w, 210), sign_y + 34), (sign_x, sign_y + 34)],
        fill=GOLD,
        width=2,
    )
    st_w = _text_width(draw, st, sign_title_font)
    draw.text((sign_x - st_w, sign_y + 42), st, fill=NAVY, font=sign_title_font)
    fo_mini = _flowops_logo(max_w=68, max_h=68)
    if fo_mini:
        _paste_logo(img, fo_mini, sign_x - fo_mini.width, sign_y + 68)

    tagline_y = footer_y + 140
    _center_text(
        draw,
        min(tagline_y, h - 72),
        "Climate Wavers  -  Powered by FlowOps Africa  -  Digitally issued",
        tiny_font,
        MUTED,
        w,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _send_certificate_email_smtp(
    *,
    to_email: str,
    subject: str,
    text: str,
    html: str,
    png_bytes: bytes,
    filename: str,
) -> bool:
    if os.environ.get("RENDER"):
        raise RuntimeError("SMTP is blocked on Render")
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        raise RuntimeError("SMTP is not configured")

    from django.core.mail import EmailMessage, get_connection

    from api.tasks import _force_ipv4

    attempts = [
        {"port": 465, "use_ssl": True, "use_tls": False},
        {
            "port": int(getattr(settings, "EMAIL_PORT", 587) or 587),
            "use_ssl": False,
            "use_tls": True,
        },
    ]
    last_error = None
    for attempt in attempts:
        try:
            with _force_ipv4():
                connection = get_connection(
                    host=settings.EMAIL_HOST or "smtp.gmail.com",
                    port=attempt["port"],
                    username=settings.EMAIL_HOST_USER,
                    password=settings.EMAIL_HOST_PASSWORD,
                    use_tls=attempt["use_tls"],
                    use_ssl=attempt["use_ssl"],
                    timeout=20,
                )
                msg = EmailMessage(
                    subject=subject,
                    body=html or text,
                    from_email=settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                    to=[to_email],
                    connection=connection,
                )
                if html:
                    msg.content_subtype = "html"
                msg.attach(filename, png_bytes, "image/png")
                msg.send(fail_silently=False)
            logger.info(
                "Certificate email via SMTP ok to=%s port=%s",
                to_email,
                attempt["port"],
            )
            return True
        except Exception as exc:
            last_error = exc
            logger.warning("Certificate SMTP %s failed: %s", attempt["port"], exc)
    raise last_error or RuntimeError("SMTP certificate send failed")


def _send_certificate_email_resend(
    *,
    to_email: str,
    subject: str,
    text: str,
    html: str,
    png_bytes: bytes,
    filename: str,
) -> bool:
    key = getattr(settings, "RESEND_API_KEY", "") or os.environ.get("RESEND_API_KEY", "")
    if not key:
        raise RuntimeError("RESEND_API_KEY is not set")

    from api.tasks import _resend_from_addresses, _ssl_context

    attachment = {
        "filename": filename,
        "content": base64.b64encode(png_bytes).decode("ascii"),
        "content_id": "tree_certificate",
    }
    last_error = None
    for from_email in _resend_from_addresses():
        message = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "text": text,
            "html": html,
            "attachments": [attachment],
        }
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(message).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                "User-Agent": "ClimateWavers-API/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=25, context=_ssl_context()) as resp:
                logger.info(
                    "Certificate email via Resend ok to=%s status=%s",
                    to_email,
                    resp.status,
                )
                return True
        except Exception as exc:
            last_error = exc
            logger.warning("Certificate email failed from %s: %s", from_email, exc)
            continue
    raise last_error or RuntimeError("Resend certificate send failed")


def _send_certificate_email(
    *,
    to_email: str,
    subject: str,
    text: str,
    html: str,
    png_bytes: bytes,
    filename: str,
) -> bool:
    if not to_email or "@" not in to_email:
        return False
    if to_email.endswith("@example.com"):
        return False

    try:
        return _send_certificate_email_smtp(
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
            png_bytes=png_bytes,
            filename=filename,
        )
    except Exception as exc:
        if "not configured" in str(exc) or "blocked on Render" in str(exc):
            logger.info("Certificate SMTP skipped: %s", exc)
        else:
            logger.warning("Certificate SMTP failed, trying Resend: %s", exc)

    try:
        return _send_certificate_email_resend(
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
            png_bytes=png_bytes,
            filename=filename,
        )
    except Exception as exc:
        logger.warning("Certificate email ultimately failed: %s", exc)
        return False


def _email_html(ctx: Dict[str, Any]) -> str:
    gift_line = (
        f"<p style='margin:0 0 12px;color:#0f172a'>Gifted to <strong>{ctx['gifted_to']}</strong>.</p>"
        if ctx.get("gifted_to")
        else ""
    )
    return f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#067d83;color:#fff;padding:20px 24px">
          <div style="font-size:12px;letter-spacing:0.08em;opacity:0.9">CLIMATE WAVERS · FLOWOPS AFRICA</div>
          <h1 style="margin:8px 0 0;font-size:24px">Your tree certificate</h1>
        </div>
        <div style="padding:24px;color:#334155;font-size:15px;line-height:1.55">
          <p style="margin:0 0 12px">Hi {ctx['donor_name']},</p>
          <p style="margin:0 0 12px">Thank you for planting with Climate Wavers. Your certificate is attached.</p>
          {gift_line}
          <ul style="padding-left:18px;margin:0 0 16px">
            <li><strong>{ctx['trees']}</strong> tree(s) — {ctx['species']}</li>
            <li>Project: {ctx['project_name']}</li>
            <li>Location: {ctx['location']}</li>
            <li>Certificate ID: {ctx['certificate_id']}</li>
          </ul>
          <p style="margin:0 0 16px">
            <a href="{ctx['verify_url']}" style="display:inline-block;background:#067d83;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">
              View Climate Wavers
            </a>
          </p>
          <p style="margin:0;font-size:13px;color:#64748b">
            Powered by FlowOps Africa · alerts.flowops.africa
          </p>
        </div>
      </div>
    </div>
    """


def issue_and_email_certificate(donation, *, force_resend: bool = False) -> Dict[str, Any]:
    """
    Generate certificate, persist ids, email payer (and gifted user when different).
    Safe to call repeatedly; skips re-email unless force_resend.
    """
    if not donation or getattr(donation, "payment_status", "") != "completed":
        return {"issued": False, "emailed": False, "reason": "not_completed"}

    updates = []
    cert_id = certificate_id_for(donation)
    if (donation.certificate_id or "") != cert_id:
        donation.certificate_id = cert_id
        updates.append("certificate_id")
    if not donation.certificate_issued_at:
        donation.certificate_issued_at = timezone.now()
        updates.append("certificate_issued_at")
    if not (donation.donor_display_name or "").strip():
        donation.donor_display_name = donor_label(donation)[:200]
        updates.append("donor_display_name")
    if updates:
        donation.save(update_fields=updates)

    png = render_certificate_png(donation)
    ctx = build_certificate_context(donation)
    filename = f"ClimateWavers_Certificate_{cert_id}.png"
    subject = f"Your Climate Wavers tree certificate — {ctx['project_name']}"
    text = (
        f"Hi {ctx['donor_name']},\n\n"
        f"Thank you for planting with Climate Wavers.\n"
        f"Certificate ID: {ctx['certificate_id']}\n"
        f"Project: {ctx['project_name']}\n"
        f"Trees: {ctx['trees']} ({ctx['species']})\n"
        f"Location: {ctx['location']}\n\n"
        f"Your certificate is attached.\n"
        f"{ctx['verify_url']}\n\n"
        "Climate Wavers · FlowOps Africa\n"
    )
    html = _email_html(ctx)

    emailed = False
    already = bool(donation.certificate_emailed_at) and not force_resend
    recipients: List[str] = []
    if donation.payer_email:
        recipients.append(donation.payer_email.strip().lower())
    if donation.donor_id and getattr(donation.donor, "email", None):
        recipients.append(donation.donor.email.strip().lower())
    if (
        donation.gifted_to_id
        and getattr(donation.gifted_to, "email", None)
        and donation.gifted_to_id != donation.donor_id
    ):
        recipients.append(donation.gifted_to.email.strip().lower())
    # unique preserve order
    seen = set()
    unique_recipients = []
    for email in recipients:
        if email and email not in seen:
            seen.add(email)
            unique_recipients.append(email)

    if not already:
        for email in unique_recipients:
            if _send_certificate_email(
                to_email=email,
                subject=subject,
                text=text,
                html=html,
                png_bytes=png,
                filename=filename,
            ):
                emailed = True
        if emailed:
            donation.certificate_emailed_at = timezone.now()
            donation.save(update_fields=["certificate_emailed_at"])
    elif force_resend:
        for email in unique_recipients:
            if _send_certificate_email(
                to_email=email,
                subject=subject,
                text=text,
                html=html,
                png_bytes=png,
                filename=filename,
            ):
                emailed = True
        if emailed:
            donation.certificate_emailed_at = timezone.now()
            donation.save(update_fields=["certificate_emailed_at"])

    # Notify tree admin org (no attachment — payment alert)
    try:
        _notify_tree_admin(donation, ctx)
    except Exception as exc:
        logger.warning("Tree admin payment notice failed: %s", exc)

    return {
        "issued": True,
        "emailed": emailed or already,
        "certificate_id": cert_id,
        "png_base64": base64.b64encode(png).decode("ascii") if force_resend else None,
    }


def _notify_tree_admin(donation, ctx: Dict[str, Any]) -> None:
    project = donation.project
    org = getattr(project, "tree_admin_org", None) if project else None
    email = (getattr(org, "contact_email", None) or "").strip() if org else ""
    if not email or "@" not in email:
        return
    from api.tasks import _deliver_mail

    payload = {
        "email": email,
        "data": {
            "subject": f"New tree payment — {ctx['project_name']}",
            "headline": "New payment on your project",
            "name": getattr(org, "name", "Tree Admin") or "Tree Admin",
            "content": (
                f"{ctx['donor_name']} paid {ctx['currency']} {ctx['amount']:,.2f} "
                f"for {ctx['trees']} tree(s) ({ctx['species']}) on {ctx['project_name']}.\n"
                f"Reference: {ctx['payment_reference']}\n"
                f"Certificate: {ctx['certificate_id']}\n"
            ),
            "cta_text": "Open Tree Admin",
            "cta_url": f"{frontend_base()}/app/admin/tree-projects",
            "preheader": "A supporter just funded trees on your project.",
        },
    }
    _deliver_mail("custom_mail", payload)


def maybe_issue_certificate(donation) -> None:
    """Best-effort hook after payment recording — never raise."""
    try:
        with transaction.atomic():
            locked = type(donation).objects.select_for_update().get(pk=donation.pk)
            issue_and_email_certificate(locked)
    except Exception as exc:
        logger.exception("Certificate issue failed for donation %s: %s", getattr(donation, "id", None), exc)


def serialize_planting_proof(donation) -> Optional[Dict[str, Any]]:
    """Latest planting proof update for a donation, if any."""
    updates = getattr(donation, "planting_updates", None)
    if updates is None:
        return None
    proof = (
        updates.filter(update_type="planting_proof")
        .order_by("-created_at")
        .first()
    )
    if not proof:
        proof = updates.order_by("-created_at").first()
    if not proof:
        return None
    return {
        "id": proof.id,
        "title": proof.title or "",
        "content": proof.content or "",
        "images": list(proof.images or []),
        "videos": list(proof.videos or []),
        "latitude": float(proof.latitude) if proof.latitude is not None else None,
        "longitude": float(proof.longitude) if proof.longitude is not None else None,
        "location_label": proof.location_label or "",
        "created_at": proof.created_at.isoformat() if proof.created_at else None,
    }


def serialize_donation_rich(d) -> Dict[str, Any]:
    gifted = ""
    if getattr(d, "gifted_to_id", None):
        gifted = gifted_label(d)
    return {
        "id": d.id,
        "project_id": d.project_id,
        "project_name": getattr(d.project, "name", "") if d.project_id else "",
        "amount": float(d.amount) if d.amount is not None else 0,
        "currency": "KES",
        "payment_status": getattr(d, "payment_status", "") or "",
        "payment_reference": getattr(d, "payment_reference", "") or "",
        "trees_purchased": getattr(d, "trees_purchased", 0) or 0,
        "selected_species": getattr(d, "selected_species", None) or {},
        "donor_email": getattr(d, "payer_email", "") or "",
        "donor_name": donor_label(d),
        "gifted_to": gifted,
        "gifted_to_id": getattr(d, "gifted_to_id", None),
        "dedication_message": getattr(d, "dedication_message", "") or "",
        "certificate_id": getattr(d, "certificate_id", "") or "",
        "certificate_issued_at": d.certificate_issued_at.isoformat()
        if getattr(d, "certificate_issued_at", None)
        else None,
        "certificate_emailed_at": d.certificate_emailed_at.isoformat()
        if getattr(d, "certificate_emailed_at", None)
        else None,
        "planting_status": getattr(d, "planting_status", "") or "funded",
        "planted_at": d.planted_at.isoformat() if getattr(d, "planted_at", None) else None,
        "planting_proof": serialize_planting_proof(d),
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "admin_share": float(getattr(d, "admin_share", 0) or 0),
        "platform_fee": float(getattr(d, "platform_fee", 0) or 0),
        "payout_status": getattr(d, "payout_status", "") or "none",
        "payout_amount_kes": float(d.payout_amount_kes)
        if getattr(d, "payout_amount_kes", None) is not None
        else None,
        "payout_reference": getattr(d, "payout_reference", "") or "",
        "payout_transfer_code": getattr(d, "payout_transfer_code", "") or "",
        "payout_error": getattr(d, "payout_error", "") or "",
        "payout_at": d.payout_at.isoformat() if getattr(d, "payout_at", None) else None,
    }


class TreeCertificateVerifyView(APIView):
    """Public lookup — anyone can verify a tree plantation certificate ID."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, code=None):
        from .models import TreeProjectDonation

        raw = (code or request.query_params.get("code") or "").strip()
        if not raw:
            return Response(
                {"valid": False, "detail": "Provide a certificate ID."},
                status=400,
            )
        donation = (
            TreeProjectDonation.objects.filter(certificate_id__iexact=raw)
            .select_related("project", "donor", "gifted_to")
            .first()
        )
        if not donation and raw.upper().startswith("CW-"):
            # Also allow lookup by payment reference suffix
            ref = raw.split("-", 1)[-1].rsplit("-", 1)[0]
            donation = (
                TreeProjectDonation.objects.filter(
                    payment_reference__iexact=ref,
                    payment_status="completed",
                )
                .select_related("project", "donor", "gifted_to")
                .first()
            )
        if not donation or (donation.payment_status or "") != "completed":
            return Response(
                {
                    "valid": False,
                    "detail": "No tree certificate matches that ID.",
                    "certificate_id": raw,
                },
                status=404,
            )
        cert_id = certificate_id_for(donation)
        if (donation.certificate_id or "") != cert_id:
            donation.certificate_id = cert_id
            donation.save(update_fields=["certificate_id"])
        ctx = build_certificate_context(donation)
        proof = serialize_planting_proof(donation)
        return Response(
            {
                "valid": True,
                "certificate": {
                    "certificate_id": ctx["certificate_id"],
                    "donor_name": ctx["donor_name"],
                    "gifted_to": ctx["gifted_to"],
                    "project_name": ctx["project_name"],
                    "organization_name": ctx["organization_name"],
                    "location": ctx["location"],
                    "species": ctx["species"],
                    "trees": ctx["trees"],
                    "co2_kg_year": ctx["co2"],
                    "issued_on": ctx["issued_on"],
                    "payment_reference": ctx["payment_reference"],
                    "verify_url": ctx["verify_url"],
                    "planting_status": getattr(donation, "planting_status", "")
                    or "funded",
                    "planted_at": donation.planted_at.isoformat()
                    if getattr(donation, "planted_at", None)
                    else None,
                    "planting_proof": proof,
                },
            }
        )
