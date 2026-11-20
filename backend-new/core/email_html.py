"""
Branded HTML for community / custom Climate Wavers emails.

Layout mirrors a Tree-Nation-style card: logo above, bordered white card,
hero image, greeting, headline, body, soft CTA box, sign-off, footer.
"""
from __future__ import annotations

import html
import re
from typing import Any

from django.conf import settings

BRAND = "#067d83"
BRAND_SOFT = "#e8f5f5"
BRAND_BORDER = "#9fd4d7"
INK = "#111111"
MUTED = "#6b7280"
PAGE_BG = "#f3f4f4"


def frontend_base() -> str:
    return (
        getattr(settings, "FRONTEND_URL", None)
        or getattr(settings, "SITE_URL", None)
        or "https://alerts.flowops.africa"
    ).rstrip("/")


def asset_url(path: str) -> str:
    return f"{frontend_base()}/{path.lstrip('/')}"


def _escape(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def _paragraphs(text: str) -> str:
    raw = (text or "").replace("\r\n", "\n").strip()
    if not raw:
        return ""
    chunks = re.split(r"\n\s*\n", raw)
    parts = []
    for chunk in chunks:
        lines = [_escape(line) for line in chunk.split("\n") if line.strip() or line == ""]
        # Keep single newlines as <br> inside a paragraph
        body = "<br>".join(line if line else "&nbsp;" for line in lines)
        # Autolink bare URLs
        body = re.sub(
            r"(https?://[^\s<]+)",
            lambda m: (
                f'<a href="{_escape(m.group(1))}" style="color:{BRAND};'
                f'text-decoration:underline;font-weight:700;">{_escape(m.group(1))}</a>'
            ),
            body,
        )
        parts.append(
            f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:{INK};">{body}</p>'
        )
    return "".join(parts)


def _preview_block(
    *,
    hero: str,
    preview_kind: str = "",
    preview_title: str = "",
    preview_description: str = "",
    preview_site_name: str = "",
    preview_url: str = "",
) -> str:
    """
    In-app-style preview: full-width hero (complete poster / media, no crop)
    with optional link-card title/description under the image.
    """
    href = (preview_url or "").strip()
    # height:auto + no object-fit:cover so posters (e.g. Plastic Pulse) are
    # not clipped at the email card edges. Email clients handle this reliably.
    img = (
        f'<img src="{_escape(hero)}" width="560" alt="" '
        f'style="display:block;width:100%;max-width:560px;height:auto;'
        f'border:0;background:#0b3d40;" />'
    )
    if href:
        img = (
            f'<a href="{_escape(href)}" style="display:block;text-decoration:none;border:0;">'
            f"{img}</a>"
        )

    meta = ""
    if (preview_kind == "link" or preview_title or preview_description) and (
        preview_title or preview_description
    ):
        site = (preview_site_name or "Climate Wavers").strip().upper()
        title_html = (
            f'<div style="margin:0 0 4px;font-size:16px;line-height:1.35;font-weight:700;'
            f'color:{INK};">{_escape(preview_title)}</div>'
            if preview_title
            else ""
        )
        desc_html = (
            f'<div style="margin:0;font-size:13px;line-height:1.45;color:{MUTED};">'
            f"{_escape(preview_description)}</div>"
            if preview_description
            else ""
        )
        inner = (
            f'<div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;'
            f'color:{MUTED};margin:0 0 6px;">{_escape(site)}</div>'
            f"{title_html}{desc_html}"
        )
        if href:
            inner = (
                f'<a href="{_escape(href)}" style="display:block;text-decoration:none;color:inherit;">'
                f"{inner}</a>"
            )
        meta = (
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
            f'<tr><td style="padding:14px 16px;border-top:1px solid #e5e7eb;'
            f'background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">{inner}</td></tr></table>'
        )

    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="border-bottom:1px solid #e5e7eb;">'
        f"<tr><td>{img}</td></tr>"
        f"{meta}"
        f"</table>"
    )


def render_community_email(
    *,
    content: str,
    subject: str = "",
    name: str = "",
    headline: str = "",
    cta_text: str = "",
    cta_url: str = "",
    hero_image: str = "",
    preheader: str = "",
    reply_hint: str = "",
    preview_kind: str = "",
    preview_title: str = "",
    preview_description: str = "",
    preview_site_name: str = "",
    preview_url: str = "",
) -> str:
    base = frontend_base()
    logo = asset_url("logo.jpg")
    hero = hero_image or asset_url("og-image.jpg")
    greet_name = (name or "").strip() or "there"
    title = (headline or subject or "A note from Climate Wavers").strip()
    pre = (preheader or title).strip()
    cta_label = (cta_text or "").strip() or "Open Climate Wavers"
    cta_href = (cta_url or base).strip() or base
    soft = (reply_hint or "").strip() or (
        "Prefer some help? Reply to this email and the Climate Wavers team will follow up."
    )
    body_html = _paragraphs(content)
    year = __import__("datetime").datetime.utcnow().year
    preview_html = _preview_block(
        hero=hero,
        preview_kind=preview_kind,
        preview_title=preview_title,
        preview_description=preview_description,
        preview_site_name=preview_site_name,
        preview_url=preview_url or cta_href,
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{_escape(title)}</title>
  <!--[if mso]><style>table,td{{font-family:Arial,Helvetica,sans-serif !important;}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {_escape(pre)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAGE_BG};">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 14px;">
              <img src="{_escape(logo)}" width="56" height="56" alt="Climate Wavers" style="display:block;width:56px;height:56px;border-radius:50%;border:2px solid #111;object-fit:cover;background:#fff;" />
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #111111;border-radius:6px;overflow:hidden;">
              {preview_html}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:{INK};">Hi {_escape(greet_name)},</p>
                    <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;font-weight:800;color:{INK};">{_escape(title)}</h1>
                    {body_html}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;">
                      <tr>
                        <td style="background:{BRAND_SOFT};border:1px solid {BRAND_BORDER};border-radius:4px;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:{INK};">
                          {_escape(soft)}
                          <br />
                          <a href="{_escape(cta_href)}" style="color:{BRAND};font-weight:700;text-decoration:underline;">{_escape(cta_label)}</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 6px;font-size:15px;line-height:1.5;color:{INK};">With care for the planet,</p>
                    <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:{INK};font-weight:700;">Climate Wavers Team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:{MUTED};">
              Climate Wavers by FlowOps Africa<br />
              <a href="{_escape(base)}/app/alert-settings" style="color:{MUTED};text-decoration:underline;">Email preferences</a>
              &nbsp;|&nbsp;
              <a href="{_escape(base)}" style="color:{MUTED};text-decoration:underline;">alerts.flowops.africa</a>
              <br />
              © {year} Climate Wavers
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def html_for_custom_mail(data: dict | None) -> str:
    data = data or {}
    return render_community_email(
        content=data.get("content") or "A message from Climate Wavers.",
        subject=data.get("subject") or "",
        name=data.get("name") or data.get("first_name") or "",
        headline=data.get("headline") or "",
        cta_text=data.get("cta_text") or "",
        cta_url=data.get("cta_url") or data.get("link") or "",
        hero_image=data.get("hero_image") or "",
        preheader=data.get("preheader") or "",
        reply_hint=data.get("reply_hint") or "",
        preview_kind=data.get("preview_kind") or "",
        preview_title=data.get("preview_title") or "",
        preview_description=data.get("preview_description") or "",
        preview_site_name=data.get("preview_site_name") or "",
        preview_url=data.get("preview_url") or data.get("cta_url") or data.get("link") or "",
    )
