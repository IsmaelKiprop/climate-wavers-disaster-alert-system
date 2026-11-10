"""
Direct Meta WhatsApp Cloud API sender (bypasses notification service / Cloudflare).
"""
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def configured():
    return bool(
        getattr(settings, "META_WA_TOKEN", "")
        and getattr(settings, "META_WA_PHONE_NUMBER_ID", "")
    )


def normalize_phone(phone):
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit() or ch == "+")
    if digits.startswith("+"):
        digits = digits[1:]
    if digits.startswith("0") and len(digits) >= 9:
        return f"254{digits[1:]}"
    return digits


def send_template(*, to, template_name, language_code="en", components=None):
    if not configured():
        raise RuntimeError("META_WA_TOKEN / META_WA_PHONE_NUMBER_ID not set")
    phone = normalize_phone(to)
    if not phone:
        raise RuntimeError("missing phone")

    # Never allow sending "to" the business Phone number ID (common misconfig).
    phone_id = str(getattr(settings, "META_WA_PHONE_NUMBER_ID", "") or "")
    if phone_id and phone == phone_id:
        raise RuntimeError("recipient cannot be META_WA_PHONE_NUMBER_ID")

    graph = getattr(settings, "META_WA_GRAPH_VERSION", "") or "v21.0"
    url = f"https://graph.facebook.com/{graph}/{phone_id}/messages"
    body = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }
    if components:
        body["template"]["components"] = components

    logger.info(
        "Meta WhatsApp send template=%s to=%s from_phone_number_id=%s",
        template_name,
        phone,
        phone_id,
    )

    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.META_WA_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "ClimateWavers-API/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace") or "{}")
            return {"ok": True, "to": phone, "data": payload}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        logger.error("Meta WhatsApp HTTP %s to=%s: %s", exc.code, phone, detail[:500])
        raise RuntimeError(f"Meta WhatsApp {exc.code}: {detail[:400]}") from exc


def send_phone_otp(phone, otp, language_code=None):
    """Send authentication template phone_verify_otp (body + copy-code button)."""
    code = str(otp or "").strip()
    lang = language_code or getattr(settings, "META_WA_TEMPLATE_LANG", "") or "en"
    # Copy-code auth templates need the OTP in body and button params.
    components = [
        {
            "type": "body",
            "parameters": [{"type": "text", "text": code}],
        },
        {
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": code}],
        },
    ]
    return send_template(
        to=phone,
        template_name="phone_verify_otp",
        language_code=lang,
        components=components,
    )
