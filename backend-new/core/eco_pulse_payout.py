"""Pay verified Eco Pulse vendor shares through the existing Paystack transfer rail."""
from .paystack_transfers import _paystack_request, ensure_mpesa_recipient, transfers_enabled


def payout_eco_vendor_order(order):
    if order.payout_status == "success":
        return {"status": "success"}
    vendor = order.vendor
    if not transfers_enabled():
        order.payout_status = "skipped"
        order.payout_error = "PAYSTACK_TRANSFER_ENABLED is off"
        order.save(update_fields=["payout_status", "payout_error"])
        return {"status": "skipped"}
    if not vendor.payouts_enabled:
        order.payout_status = "skipped"
        order.payout_error = "Vendor payouts are not enabled"
        order.save(update_fields=["payout_status", "payout_error"])
        return {"status": "skipped"}
    if not vendor.payout_account_number.strip():
        order.payout_status = "failed"
        order.payout_error = "Vendor M-Pesa number is missing"
        order.save(update_fields=["payout_status", "payout_error"])
        return {"status": "failed"}
    try:
        recipient = vendor.paystack_recipient_code.strip() or ensure_mpesa_recipient(
            vendor.payout_account_number, vendor.payout_account_name or vendor.name
        )
        vendor.paystack_recipient_code = recipient
        vendor.save(update_fields=["paystack_recipient_code", "updated_at"])
        reference = order.payout_reference or f"cw-eco-order-{order.id}"
        order.payout_reference = reference
        order.save(update_fields=["payout_reference"])
        transfer = _paystack_request("POST", "/transfer", {
            "source": "balance", "amount": int(order.vendor_share_kes) * 100,
            "recipient": recipient, "reason": f"Eco Pulse order {order.id}",
            "reference": reference,
        })
        order.payout_status = "success" if transfer.get("status") in ("success", "pending") else "pending"
        order.payout_error = ""
        order.save(update_fields=["payout_status", "payout_error"])
        return {"status": order.payout_status}
    except Exception as exc:
        order.payout_status = "failed"
        order.payout_error = str(exc)[:1000]
        order.save(update_fields=["payout_status", "payout_error"])
        return {"status": "failed", "detail": order.payout_error}
