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
INK = (15, 23, 42)
MUTED = (100, 116, 139)
CREAM = (248, 250, 252)
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
    return _display_name(donation.gifted_to) or f"Member #{donation.gifted_to_id}"


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


def _load_font(size: int, bold: bool = False):
    candidates = []
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


def _cw_logo() -> Optional[Image.Image]:
    base = frontend_base()
    for path in ("/Vector.png", "/logo.jpg", "/og-image.jpg"):
        logo = _fetch_logo(f"{base}{path}")
        if logo:
            return logo
    return None


def _flowops_logo() -> Optional[Image.Image]:
    for url in (
        "https://www.flowops.africa/favicon.ico",
        f"{frontend_base()}/Vector.png",
    ):
        logo = _fetch_logo(url, max_w=160, max_h=56)
        if logo:
            return logo
    return None


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
    """Landscape branded certificate as PNG bytes."""
    ctx = build_certificate_context(donation)
    w, h = 1600, 1132
    img = Image.new("RGB", (w, h), CREAM)
    draw = ImageDraw.Draw(img)

    # Outer brand frame
    draw.rectangle([36, 36, w - 36, h - 36], outline=BORDER, width=4)
    draw.rectangle([52, 52, w - 52, h - 52], outline=(204, 251, 241), width=2)

    # Header bar
    draw.rectangle([52, 52, w - 52, 168], fill=TEAL)

    title_font = _load_font(42, bold=True)
    sub_font = _load_font(22, bold=True)
    body_font = _load_font(28)
    small_font = _load_font(20)
    tiny_font = _load_font(16)
    name_font = _load_font(48, bold=True)

    draw.text((80, 78), "CLIMATE WAVERS", fill=WHITE, font=sub_font)
    draw.text((80, 112), "Tree Planting Certificate", fill=WHITE, font=title_font)

    cw = _cw_logo()
    fo = _flowops_logo()
    if cw:
        img.paste(cw, (w - 80 - cw.width, 74), cw if cw.mode == "RGBA" else None)
    if fo:
        img.paste(fo, (w - 80 - (cw.width if cw else 0) - 24 - fo.width, 90), fo if fo.mode == "RGBA" else None)

    y = 210
    draw.text((80, y), "This certifies that", fill=MUTED, font=small_font)
    y += 48
    draw.text((80, y), ctx["donor_name"], fill=INK, font=name_font)
    y += 70

    if ctx["gifted_to"]:
        draw.text(
            (80, y),
            f"gifted tree(s) to {ctx['gifted_to']}",
            fill=TEAL_DARK,
            font=body_font,
        )
        y += 44
    else:
        draw.text((80, y), "planted tree(s) with Climate Wavers", fill=TEAL_DARK, font=body_font)
        y += 44

    draw.text(
        (80, y),
        f"{ctx['trees']} tree{'s' if ctx['trees'] != 1 else ''} · {ctx['species']}",
        fill=INK,
        font=body_font,
    )
    y += 40
    draw.text(
        (80, y),
        f"Project: {ctx['project_name']}",
        fill=INK,
        font=small_font,
    )
    y += 32
    if ctx["organization_name"]:
        draw.text(
            (80, y),
            f"Hosted by {ctx['organization_name']}",
            fill=MUTED,
            font=small_font,
        )
        y += 32
    draw.text((80, y), f"Location: {ctx['location']}", fill=MUTED, font=small_font)
    y += 32
    draw.text(
        (80, y),
        f"Estimated CO₂ absorption: ~{ctx['co2']:.0f} kg/year",
        fill=MUTED,
        font=small_font,
    )

    # Right meta card
    card_x0, card_y0 = 980, 210
    card_x1, card_y1 = w - 80, 520
    draw.rounded_rectangle(
        [card_x0, card_y0, card_x1, card_y1],
        radius=16,
        fill=WHITE,
        outline=(226, 232, 240),
        width=2,
    )
    draw.text((card_x0 + 28, card_y0 + 28), "Certificate details", fill=TEAL, font=sub_font)
    meta_lines = [
        ("ID", ctx["certificate_id"]),
        ("Issued", ctx["issued_on"]),
        ("Reference", ctx["payment_reference"]),
        ("Amount", f"{ctx['currency']} {ctx['amount']:,.2f}"),
    ]
    my = card_y0 + 80
    for label, value in meta_lines:
        draw.text((card_x0 + 28, my), label, fill=MUTED, font=tiny_font)
        draw.text((card_x0 + 28, my + 22), str(value)[:42], fill=INK, font=small_font)
        my += 64

    # Footer brands
    draw.rectangle([52, h - 150, w - 52, h - 52], fill=WHITE)
    draw.line([(80, h - 150), (w - 80, h - 150)], fill=(226, 232, 240), width=2)
    draw.text(
        (80, h - 120),
        "Issued by Climate Wavers  ·  Powered by FlowOps Africa",
        fill=TEAL_DARK,
        font=small_font,
    )
    draw.text(
        (80, h - 88),
        "Digitally verified on alerts.flowops.africa  ·  Every tree supports local climate action.",
        fill=MUTED,
        font=tiny_font,
    )
    draw.text(
        (80, h - 62),
        "Kipkoech Ismael Kiprop  ·  Founder, Climate Wavers / FlowOps Africa",
        fill=MUTED,
        font=tiny_font,
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
