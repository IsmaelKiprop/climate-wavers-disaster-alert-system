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
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

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
            f"{name} × {int(qty)}"
            for name, qty in selected.items()
            if int(qty or 0) > 0
        ]
        if parts:
            return ", ".join(parts)
    return "Verified seedling"


def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    try:
        box = draw.textbbox((0, 0), text, font=font)
        return max(0, box[2] - box[0])
    except Exception:
        return int(len(text) * (getattr(font, "size", 16) * 0.55))


def _center_text(draw, y, text, font, fill, canvas_w, x0=0, x1=None):
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


def _draw_seal(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int = 78) -> None:
    """Gold-and-teal recognition seal with ribbon tails (A2SV-style)."""
    # Ribbon tails behind the seal
    ribbon_w = int(radius * 0.55)
    ribbon_h = int(radius * 1.15)
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
    # Outer gold ring
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=GOLD,
        outline=NAVY,
        width=2,
    )
    # Inner navy disc
    inner = radius - 10
    draw.ellipse(
        [cx - inner, cy - inner, cx + inner, cy + inner],
        fill=NAVY,
        outline=GOLD_LIGHT,
        width=2,
    )
    # Thin teal ring
    mid = radius - 22
    draw.ellipse(
        [cx - mid, cy - mid, cx + mid, cy + mid],
        outline=TEAL,
        width=2,
    )
    seal_font = _load_font(15, bold=True)
    seal_small = _load_font(11, bold=True)
    for text, font, dy, color in (
        ("CLIMATE", seal_font, -28, GOLD_LIGHT),
        ("WAVERS", seal_font, -8, GOLD_LIGHT),
        ("VERIFIED", seal_small, 16, (200, 220, 218)),
        ("PLANTING", seal_small, 32, (200, 220, 218)),
    ):
        tw = _text_width(draw, text, font)
        draw.text((cx - tw // 2, cy + dy), text, fill=color, font=font)


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
        "verify_url": f"{frontend_base()}/plant-tree",
    }


def render_certificate_png(donation) -> bytes:
    """Formal landscape Climate Wavers certificate (A2SV recognition-style)."""
    ctx = build_certificate_context(donation)
    w, h = 1600, 1130
    img = Image.new("RGB", (w, h), PAPER)
    draw = ImageDraw.Draw(img)
    _draw_paper_texture(draw, w, h)
    _draw_formal_frame(draw, w, h)

    title_font = _load_font(48, bold=True, serif=True)
    name_font = _load_font(56, bold=True, serif=True)
    body_font = _load_font(22, serif=True)
    lead_font = _load_font(15, bold=True)
    tiny_font = _load_font(13)
    meta_font = _load_font(14)
    label_font = _load_font(12, bold=True)

    # Top centered Climate Wavers logo
    cw_logo = _cw_logo(max_w=180, max_h=110)
    y = 88
    if cw_logo:
        lx = (w - cw_logo.width) // 2
        draw.rounded_rectangle(
            [lx - 10, y - 6, lx + cw_logo.width + 10, y + cw_logo.height + 6],
            radius=6,
            fill=(10, 10, 10),
        )
        _paste_logo(img, cw_logo, lx, y)
        y += cw_logo.height + 28
    else:
        _draw_cw_mark(img, w // 2, y + 36, size=78)
        y += 96

    _center_text(draw, y, "CERTIFICATE OF PLANTATION", title_font, NAVY, w)
    y += 58
    _draw_gold_divider(draw, y, w, margin=280)
    y += 32

    _center_text(
        draw,
        y,
        "THE FOLLOWING AWARD IS GIVEN TO",
        lead_font,
        MUTED,
        w,
    )
    y += 36

    donor = (ctx["donor_name"] or "Climate Wavers supporter").strip()[:48]
    _center_text(draw, y, donor, name_font, INK, w)
    nw = _text_width(draw, donor, name_font)
    draw.line(
        [(w // 2 - nw // 2 - 12, y + 66), (w // 2 + nw // 2 + 12, y + 66)],
        fill=GOLD,
        width=2,
    )
    y += 90

    tree_word = "tree" if ctx["trees"] == 1 else "trees"
    if ctx["gifted_to"]:
        prose = (
            f"Congratulations on funding {ctx['trees']} {tree_word} gifted to "
            f"{ctx['gifted_to']}, supporting {ctx['project_name']} in {ctx['location']} "
            f"({ctx['species']}). Your dedication restores ecosystems and advances "
            f"climate action across Africa. Estimated CO₂ absorption ~{ctx['co2']:.0f} kg/year."
        )
    else:
        prose = (
            f"Congratulations on funding the planting of {ctx['trees']} {tree_word} "
            f"with Climate Wavers — {ctx['species']} for {ctx['project_name']} in "
            f"{ctx['location']}. Your outstanding dedication restores ecosystems and "
            f"supports local climate action across Africa. "
            f"Estimated CO₂ absorption ~{ctx['co2']:.0f} kg/year."
        )
    if ctx["organization_name"]:
        prose += f" Hosted by {ctx['organization_name']}."

    for line in _wrap_text(draw, prose, body_font, w - 360):
        _center_text(draw, y, line, body_font, INK, w)
        y += 30

    y += 22
    # Compact meta strip (trees · species · issued)
    details = [
        ("TREES", str(ctx["trees"])),
        ("SPECIES", (ctx["species"] or "—")[:28]),
        ("ISSUED", ctx["issued_on"]),
    ]
    col_w = (w - 420) // len(details)
    for i, (label, value) in enumerate(details):
        cx = 210 + i * col_w + col_w // 2
        lw = _text_width(draw, label, label_font)
        draw.text((cx - lw // 2, y), label, fill=TEAL, font=label_font)
        vw = _text_width(draw, value, meta_font)
        draw.text((cx - vw // 2, y + 20), value, fill=INK, font=meta_font)

    y += 52
    id_bits = f"ID  {ctx['certificate_id']}"
    if ctx["payment_reference"]:
        id_bits += f"   ·   Ref  {ctx['payment_reference']}"
    _center_text(draw, y, id_bits[:90], tiny_font, MUTED, w)

    # Footer band: CW | seal | FlowOps — recognition sample layout
    footer_y = h - 240
    cw_foot = _cw_logo(max_w=130, max_h=90)
    fo_foot = _flowops_logo(max_w=110, max_h=110)

    if cw_foot:
        lx = 160
        fy = footer_y + 36
        draw.rounded_rectangle(
            [lx - 6, fy - 4, lx + cw_foot.width + 6, fy + cw_foot.height + 4],
            radius=6,
            fill=(10, 10, 10),
        )
        _paste_logo(img, cw_foot, lx, fy)

    seal_cy = footer_y + 58
    _draw_seal(draw, w // 2, seal_cy, radius=66)

    if fo_foot:
        fx = w - 160 - fo_foot.width
        fy = footer_y + 28
        powered = _load_font(11, bold=True)
        pl = "POWERED BY"
        pw = _text_width(draw, pl, powered)
        draw.text((fx + (fo_foot.width - pw) // 2, fy - 18), pl, fill=MUTED, font=powered)
        draw.rounded_rectangle(
            [fx - 8, fy - 2, fx + fo_foot.width + 8, fy + fo_foot.height + 6],
            radius=8,
            fill=WHITE,
            outline=(226, 232, 240),
            width=1,
        )
        _paste_logo(img, fo_foot, fx, fy)

    _center_text(
        draw,
        h - 88,
        "Climate Wavers  ·  Powered by FlowOps Africa  ·  Digitally issued",
        tiny_font,
        MUTED,
        w,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _send_certificate_email(
    *,
    to_email: str,
    subject: str,
    text: str,
    html: str,
    png_bytes: bytes,
    filename: str,
) -> bool:
    key = getattr(settings, "RESEND_API_KEY", "") or os.environ.get("RESEND_API_KEY", "")
    if not key or not to_email or "@" not in to_email:
        return False
    if to_email.endswith("@example.com"):
        return False

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
                logger.info("Certificate email ok to=%s status=%s", to_email, resp.status)
                return True
        except Exception as exc:
            last_error = exc
            logger.warning("Certificate email failed from %s: %s", from_email, exc)
            continue
    if last_error:
        logger.warning("Certificate email ultimately failed: %s", last_error)
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
    from api.tasks import _send_resend

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
    _send_resend("custom_mail", payload)


def maybe_issue_certificate(donation) -> None:
    """Best-effort hook after payment recording — never raise."""
    try:
        with transaction.atomic():
            locked = type(donation).objects.select_for_update().get(pk=donation.pk)
            issue_and_email_certificate(locked)
    except Exception as exc:
        logger.exception("Certificate issue failed for donation %s: %s", getattr(donation, "id", None), exc)


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
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "admin_share": float(getattr(d, "admin_share", 0) or 0),
        "platform_fee": float(getattr(d, "platform_fee", 0) or 0),
    }
