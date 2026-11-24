"""Firebase Cloud Messaging delivery for opted-in device tokens."""

from __future__ import annotations

import json
import logging
import os
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)
_credentials_cache = None
_credentials_key = None


def _service_account_info():
    raw = (os.getenv("FCM_SERVICE_ACCOUNT_JSON") or "").strip()
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error("FCM_SERVICE_ACCOUNT_JSON is not valid JSON: %s", exc)
            return None
    path = (os.getenv("FCM_SERVICE_ACCOUNT_FILE") or "").strip()
    if not path:
        path = (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "").strip()
    if path:
        try:
            with open(path, "r", encoding="utf-8") as source:
                return json.load(source)
        except (OSError, json.JSONDecodeError) as exc:
            logger.error("Could not read FCM service account file: %s", exc)
    return None


def is_configured() -> bool:
    info = _service_account_info()
    return bool(info and info.get("project_id") and info.get("client_email") and info.get("private_key"))


def _access_token(info):
    global _credentials_cache, _credentials_key
    key = (info.get("client_email"), info.get("project_id"))
    if _credentials_cache is None or _credentials_key != key:
        from google.oauth2 import service_account

        _credentials_cache = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        _credentials_key = key
    if not _credentials_cache.valid:
        from google.auth.transport.requests import Request

        _credentials_cache.refresh(Request())
    return _credentials_cache.token


def send_push(token: str, *, title: str, body: str, data=None) -> dict:
    """Send one FCM HTTP v1 push. Provider errors are returned, never raised."""
    info = _service_account_info()
    if not info or not info.get("project_id"):
        return {"ok": False, "configured": False, "detail": "FCM credentials are not configured"}
    try:
        safe_data = {str(key): str(value) for key, value in (data or {}).items() if value is not None}
        safe_data["title"] = title
        safe_data["body"] = body
        payload = {
            "message": {
                "token": token,
                "data": safe_data,
                "android": {
                    "priority": "high",
                    "notification": {"title": title, "body": body, "channel_id": "hazard_alerts"},
                },
                "apns": {
                    "headers": {"apns-priority": "10"},
                    "payload": {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}},
                },
                "webpush": {
                    "headers": {"Urgency": "high", "TTL": "300"},
                    "fcm_options": {
                        "link": urljoin(
                            (os.getenv("FRONTEND_BASE_URL") or "https://alerts.flowops.africa").rstrip("/") + "/",
                            "app/notifications",
                        )
                    },
                },
            }
        }
        response = requests.post(
            f"https://fcm.googleapis.com/v1/projects/{info['project_id']}/messages:send",
            headers={"Authorization": f"Bearer {_access_token(info)}"},
            json=payload,
            timeout=10,
        )
        if response.ok:
            return {"ok": True, "provider": "fcm"}
        detail = response.text[:300]
        invalid = response.status_code == 404 or "UNREGISTERED" in detail
        return {"ok": False, "provider": "fcm", "invalid_token": invalid, "detail": detail}
    except Exception as exc:  # external credentials/network must not block in-app alerts
        logger.warning("FCM delivery failed: %s", exc)
        return {"ok": False, "provider": "fcm", "detail": str(exc)[:300]}
