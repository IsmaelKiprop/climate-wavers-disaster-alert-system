"""
Paystack Transfers — auto-pay Tree Admin share after a completed tree sale.

Requires:
  PAYSTACK_SECRET_KEY
  PAYSTACK_TRANSFER_ENABLED=true  (kill switch; default off until orgs are configured)
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from decimal import Decimal
from typing import Any, Dict, Optional

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def transfers_enabled() -> bool:
    flag = (os.getenv("PAYSTACK_TRANSFER_ENABLED") or "").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def _secret() -> str:
    return (os.getenv("PAYSTACK_SECRET_KEY") or "").strip()


def _paystack_request(method: str, path: str, payload: Optional[dict] = None) -> dict:
    secret = _secret()
    if not secret:
        raise RuntimeError("PAYSTACK_SECRET_KEY is not configured")
    url = f"https://api.paystack.co{path}"
    data = None
    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
        "User-Agent": "ClimateWavers-API/1.0",
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        try:
            body = json.loads(raw) if raw else {}
        except Exception:
            body = {"message": raw or str(exc)}
        raise RuntimeError(
            body.get("message") or body.get("detail") or f"Paystack HTTP {exc.code}"
        ) from exc
    if not body.get("status"):
        raise RuntimeError(body.get("message") or "Paystack request failed")
    return body.get("data") or {}


def normalize_ke_phone(raw: str) -> str:
    """Normalize to 07XXXXXXXX local form Paystack M-Pesa accepts."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if digits.startswith("254") and len(digits) == 12:
        digits = "0" + digits[3:]
    if digits.startswith("7") and len(digits) == 9:
        digits = "0" + digits
    if digits.startswith("1") and len(digits) == 9:
        digits = "0" + digits
    return digits


def admin_share_kes(donation) -> Decimal:
    """KES amount to send the Tree Admin (fee taken from charged KES)."""
    from .tree_pricing import split_tree_payment

    gross = Decimal(str(getattr(donation, "amount", 0) or 0)).quantize(Decimal("0.01"))
    org = getattr(getattr(donation, "project", None), "tree_admin_org", None)
    rate = getattr(donation, "fee_rate", None)
    _fee, share, _r = split_tree_payment(gross, fee_rate=rate, org=org)
    return share


def ensure_transfer_recipient(org) -> str:
    """Create or reuse a Paystack transfer recipient for the org. Returns recipient_code."""
    existing = (getattr(org, "paystack_recipient_code", "") or "").strip()
    if existing:
        return existing

    account_number = (org.payout_account_number or "").strip()
    account_name = (org.payout_account_name or org.name or "Tree Admin").strip()
    bank_code = (org.payout_bank_code or "MPESA").strip() or "MPESA"
    channel = (org.payout_channel or "mobile_money").strip() or "mobile_money"

    if not account_number:
        raise RuntimeError("Tree Admin payout account number is missing")

    if channel == "mobile_money":
        account_number = normalize_ke_phone(account_number)
        if not re.fullmatch(r"0[17]\d{8}", account_number):
            raise RuntimeError(
                "M-Pesa number must be a valid Kenyan mobile (07… or 01…)"
            )
        payload = {
            "type": "mobile_money",
            "name": account_name[:100],
            "account_number": account_number,
            "bank_code": bank_code if bank_code.startswith("MP") else "MPESA",
            "currency": "KES",
        }
    else:
        # Kenya Electronic Payment and Settlement System (bank accounts)
        payload = {
            "type": "kepss",
            "name": account_name[:100],
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": "KES",
        }

    data = _paystack_request("POST", "/transferrecipient", payload)
    code = (data.get("recipient_code") or "").strip()
    if not code:
        raise RuntimeError("Paystack did not return a recipient_code")
    org.paystack_recipient_code = code
    if channel == "mobile_money" and account_number:
        org.payout_account_number = account_number
    org.save(
        update_fields=["paystack_recipient_code", "payout_account_number", "updated_at"]
    )
    return code


def _mark_donation_payout(donation, **fields) -> None:
    updates = []
    for key, value in fields.items():
        setattr(donation, key, value)
        updates.append(key)
    if updates:
        donation.save(update_fields=updates)


def maybe_payout_tree_admin_share(donation, *, force: bool = False) -> Dict[str, Any]:
    """
    Idempotent: transfer admin KES share to the project's Tree Admin org.
    Safe to call repeatedly; never raises to callers (logs + stores error).
    """
    result: Dict[str, Any] = {"ok": False, "status": "none"}
    try:
        if not donation or (getattr(donation, "payment_status", "") or "") != "completed":
            result["status"] = "skipped"
            result["detail"] = "Donation not completed"
            return result

        current = (getattr(donation, "payout_status", "") or "none").strip()
        if current == "success" and not force:
            result["ok"] = True
            result["status"] = "success"
            result["detail"] = "Already paid out"
            return result

        if not transfers_enabled() and not force:
            _mark_donation_payout(
                donation,
                payout_status="skipped",
                payout_error="PAYSTACK_TRANSFER_ENABLED is off",
            )
            result["status"] = "skipped"
            result["detail"] = "Transfers disabled"
            return result

        project = getattr(donation, "project", None)
        org = getattr(project, "tree_admin_org", None) if project else None
        if org is None:
            _mark_donation_payout(
                donation,
                payout_status="skipped",
                payout_error="No Tree Admin organization on project",
            )
            result["status"] = "skipped"
            result["detail"] = "No org"
            return result

        if not getattr(org, "payouts_enabled", False) and not force:
            _mark_donation_payout(
                donation,
                payout_status="skipped",
                payout_error="Org payouts_enabled is false",
            )
            result["status"] = "skipped"
            result["detail"] = "Org payouts disabled"
            return result

        if not (org.payout_account_number or "").strip():
            _mark_donation_payout(
                donation,
                payout_status="failed",
                payout_error="Org has no payout account number",
            )
            result["status"] = "failed"
            result["detail"] = "Missing payout account"
            return result

        share = admin_share_kes(donation)
        if share <= 0:
            _mark_donation_payout(
                donation,
                payout_status="skipped",
                payout_amount_kes=share,
                payout_error="Admin share is zero",
            )
            result["status"] = "skipped"
            result["detail"] = "Zero share"
            return result

        # Amount in smallest currency unit (KES cents)
        amount_cents = int((share * 100).quantize(Decimal("1")))
        if amount_cents < 100:
            # Paystack often requires a minimum; skip tiny dust
            _mark_donation_payout(
                donation,
                payout_status="skipped",
                payout_amount_kes=share,
                payout_error="Amount below Paystack transfer minimum",
            )
            result["status"] = "skipped"
            result["detail"] = "Below minimum"
            return result

        reference = f"adminshare_{donation.payment_reference}"[:100]
        if force and current == "success":
            reference = (
                f"adminshare_{donation.payment_reference}_{int(timezone.now().timestamp())}"
            )[:100]
        _mark_donation_payout(
            donation,
            payout_status="pending",
            payout_amount_kes=share,
            payout_reference=reference,
            payout_error="",
        )

        recipient = ensure_transfer_recipient(org)
        reason = (
            f"Tree Admin share · {getattr(project, 'name', 'project')[:40]} · "
            f"{donation.payment_reference}"
        )[:80]

        data = _paystack_request(
            "POST",
            "/transfer",
            {
                "source": "balance",
                "amount": amount_cents,
                "currency": "KES",
                "recipient": recipient,
                "reason": reason,
                "reference": reference,
            },
        )
        transfer_code = (
            data.get("transfer_code") or data.get("code") or data.get("id") or ""
        )
        status = (data.get("status") or "success").lower()
        ok = status in {"success", "pending", "otp", "received"}
        _mark_donation_payout(
            donation,
            payout_status="success" if ok else "failed",
            payout_transfer_code=str(transfer_code)[:80],
            payout_at=timezone.now(),
            payout_error="" if ok else f"Transfer status: {status}",
        )
        result["ok"] = ok
        result["status"] = "success" if ok else "failed"
        result["transfer_code"] = transfer_code
        result["amount_kes"] = float(share)
        return result
    except Exception as exc:
        logger.exception(
            "Tree admin payout failed donation=%s: %s",
            getattr(donation, "id", None),
            exc,
        )
        try:
            _mark_donation_payout(
                donation,
                payout_status="failed",
                payout_error=str(exc)[:500],
            )
        except Exception:
            pass
        result["status"] = "failed"
        result["detail"] = str(exc)[:300]
        return result


def payout_on_commit(donation_id: int) -> None:
    """Schedule payout after the payment transaction commits."""
    def _run():
        try:
            from .models import TreeProjectDonation

            d = (
                TreeProjectDonation.objects.select_related("project", "project__tree_admin_org")
                .filter(pk=donation_id)
                .first()
            )
            if d:
                maybe_payout_tree_admin_share(d)
        except Exception as exc:
            logger.exception("payout_on_commit failed id=%s: %s", donation_id, exc)

    transaction.on_commit(_run)
