"""
SMS delivery via Mobile Sasa, Africa's Talking, or Twilio.

Env:
  SMS_PROVIDER=mobilesasa|africastalking|twilio|log
  MOBILESASA_API_TOKEN / MOBILESASA_SENDER_ID
  AT_USERNAME / AT_API_KEY / AT_SENDER_ID
  AT_SANDBOX=true  (or AT_USERNAME=sandbox) → uses sandbox API host
  TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER

Sandbox note (Africa's Talking):
  Default Sender ID is test-only in Kenya and currently Airtel-only.
  Production / Safaricom needs a dedicated Sender ID on a Team app.
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


def is_configured() -> bool:
    """Whether the selected SMS provider has the credentials it needs."""
    mode = provider()
    if mode in {"mobilesasa", "mobile_sasa"}:
        return bool((os.getenv("MOBILESASA_API_TOKEN") or "").strip())
    if mode in {"africastalking", "at", "africa"}:
        return bool(
            (os.getenv("AT_USERNAME") or "").strip()
            and (os.getenv("AT_API_KEY") or "").strip()
        )
    if mode == "twilio":
        return bool(
            (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
            and (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
            and (os.getenv("TWILIO_FROM_NUMBER") or "").strip()
        )
    return False


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
        if mode in {"mobilesasa", "mobile_sasa"}:
            return _send_mobilesasa(to, body)
        if mode == "twilio":
            return _send_twilio(to, body)
        logger.warning("Unknown SMS_PROVIDER=%s; logging only", mode)
        logger.info("SMS fallback log → %s: %s", to, body[:160])
        return {"ok": True, "provider": "log", "to": to}
    except Exception as exc:
        logger.exception("SMS send failed to=%s: %s", to, exc)
        return {"ok": False, "provider": mode, "detail": str(exc)[:300]}


def _africastalking_base_url(username: str) -> str:
    sandbox_flag = (os.getenv("AT_SANDBOX") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if sandbox_flag or username.lower() == "sandbox":
        return "https://api.sandbox.africastalking.com/version1/messaging"
    return "https://api.africastalking.com/version1/messaging"


def _send_africastalking(to: str, body: str) -> Dict[str, Any]:
    username = (os.getenv("AT_USERNAME") or "").strip()
    api_key = (os.getenv("AT_API_KEY") or "").strip()
    # Sandbox often works with AFRICASTKNG / default; leave blank to omit "from"
    sender = (os.getenv("AT_SENDER_ID") or "").strip()
    if not username or not api_key:
        raise RuntimeError("AT_USERNAME / AT_API_KEY not configured")

    # Africa's Talking expects 2547… without +
    msisdn = to.lstrip("+")
    form = {
        "username": username,
        "to": msisdn,
        "message": body,
    }
    if sender:
        form["from"] = sender
    data = urllib.parse.urlencode(form).encode("utf-8")
    url = _africastalking_base_url(username)
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "ApiKey": api_key,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8") or "{}"
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        raise RuntimeError(raw[:400]) from exc
    payload = json.loads(raw) if raw.strip().startswith("{") else {"raw": raw}
    return {
        "ok": True,
        "provider": "africastalking",
        "sandbox": "sandbox" in url,
        "to": to,
        "response": payload,
    }


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


def _send_mobilesasa(to: str, body: str) -> Dict[str, Any]:
    token = (os.getenv("MOBILESASA_API_TOKEN") or "").strip()
    sender_id = (os.getenv("MOBILESASA_SENDER_ID") or "MOBILESASA").strip()
    if not token:
        raise RuntimeError("MOBILESASA_API_TOKEN is not configured")
    if not sender_id:
        raise RuntimeError("MOBILESASA_SENDER_ID is not configured")

    payload = json.dumps(
        {"senderID": sender_id, "phone": to, "message": body}
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.mobilesasa.com/v1/send/message",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8") or "{}"
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else str(exc)
        raise RuntimeError(raw[:400]) from exc

    result = json.loads(raw) if raw.strip().startswith("{") else {"message": raw}
    accepted = result.get("status") is True and str(result.get("responseCode")) == "0200"
    return {
        "ok": accepted,
        "provider": "mobilesasa",
        "to": to,
        "message_id": result.get("messageId"),
        "response_code": result.get("responseCode"),
        "detail": None if accepted else str(result.get("message") or "Mobile Sasa rejected the SMS")[:300],
    }
