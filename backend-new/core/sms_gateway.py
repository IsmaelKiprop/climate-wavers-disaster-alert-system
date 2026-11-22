"""
SMS delivery via Africa's Talking (preferred) or Twilio.

Env:
  SMS_PROVIDER=africastalking|twilio|log
  AT_USERNAME / AT_API_KEY / AT_SENDER_ID
  TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict

logger = logging.getLogger(__name__)


def provider() -> str:
    return (os.getenv("SMS_PROVIDER") or "log").strip().lower()


def normalize_e164_ke(raw: str) -> str:
    digits = re.sub(r"\D", "", str(raw or ""))
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    if digits.startswith("7") and len(digits) == 9:
        digits = "254" + digits
    if digits.startswith("1") and len(digits) == 9:
        digits = "254" + digits
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


def send_sms(phone: str, message: str) -> Dict[str, Any]:
    """Send a short SMS. Never raises; returns {ok, provider, detail?}."""
    to = normalize_e164_ke(phone)
    body = (message or "").strip()[:640]
    if not to or not body:
        return {"ok": False, "provider": provider(), "detail": "Missing phone or message"}

    mode = provider()
    if mode in {"", "log", "none", "off"}:
        logger.info("SMS log → %s: %s", to, body[:160])
        return {"ok": True, "provider": "log", "to": to}

    try:
        if mode in {"africastalking", "at", "africa"}:
            return _send_africastalking(to, body)
        if mode == "twilio":
            return _send_twilio(to, body)
        logger.warning("Unknown SMS_PROVIDER=%s; logging only", mode)
        logger.info("SMS fallback log → %s: %s", to, body[:160])
        return {"ok": True, "provider": "log", "to": to}
    except Exception as exc:
        logger.exception("SMS send failed to=%s: %s", to, exc)
        return {"ok": False, "provider": mode, "detail": str(exc)[:300]}


def _send_africastalking(to: str, body: str) -> Dict[str, Any]:
    username = (os.getenv("AT_USERNAME") or "").strip()
    api_key = (os.getenv("AT_API_KEY") or "").strip()
    sender = (os.getenv("AT_SENDER_ID") or "ClimateW").strip()
    if not username or not api_key:
        raise RuntimeError("AT_USERNAME / AT_API_KEY not configured")

    # Africa's Talking expects 2547… without +
    msisdn = to.lstrip("+")
    data = urllib.parse.urlencode(
        {
            "username": username,
            "to": msisdn,
            "message": body,
            "from": sender,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.africastalking.com/version1/messaging",
        data=data,
        headers={
            "ApiKey": api_key,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        raw = resp.read().decode("utf-8") or "{}"
    payload = json.loads(raw)
    return {"ok": True, "provider": "africastalking", "to": to, "response": payload}


def _send_twilio(to: str, body: str) -> Dict[str, Any]:
    sid = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
    token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    from_number = (os.getenv("TWILIO_FROM_NUMBER") or "").strip()
    if not sid or not token or not from_number:
        raise RuntimeError("Twilio credentials not configured")

    data = urllib.parse.urlencode(
        {"To": to, "From": from_number, "Body": body}
    ).encode("utf-8")
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    basic = base64.b64encode(f"{sid}:{token}".encode("utf-8")).decode("ascii")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8") or "{}"
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        raise RuntimeError(raw[:300]) from exc
    return {"ok": True, "provider": "twilio", "to": to, "response": json.loads(raw)}
