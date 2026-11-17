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
) -> str:
    base = frontend_base()
    logo = asset_url("logo.jpg")
    hero = hero_image or asset_url("environment.jpg")
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
              <img src="{_escape(hero)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;" />
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
    )
