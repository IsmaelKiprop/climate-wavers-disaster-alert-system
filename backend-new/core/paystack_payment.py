"""Record a verified Paystack tree payment exactly once."""

import hashlib
import hmac
import json
import logging
import os
from decimal import Decimal, InvalidOperation

import requests
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.db.models import Sum
from django.db.utils import OperationalError, ProgrammingError
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import TreeProject, TreeProjectDonation

logger = logging.getLogger(__name__)


def _gifted_to_column_ready():
    """True once migration 0036 has added core_treeprojectdonation.gifted_to_id."""
    try:
        table = TreeProjectDonation._meta.db_table
        columns = {column.name for column in connection.introspection.get_table_description(connection.cursor(), table)}
        return "gifted_to_id" in columns
    except Exception:
        return False


class PaymentRecordError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def user_from_request(request):
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    try:
        authenticated = JWTAuthentication().authenticate(request)
    except Exception:
        return None
    if authenticated:
        return authenticated[0]
    return None


def claim_tree_donations(user):
    if not user or not getattr(user, "is_authenticated", False):
        return
    email = (getattr(user, "email", "") or "").strip()
    if not email:
        return
    TreeProjectDonation.objects.filter(
        donor__isnull=True,
        payer_email__iexact=email,
    ).update(donor=user)


def _metadata_value(metadata, key, default=None):
    if not isinstance(metadata, dict):
        return default
    value = metadata.get(key)
    if value not in (None, ""):
        return value
    for field in metadata.get("custom_fields") or []:
        if isinstance(field, dict) and field.get("variable_name") == key:
            field_value = field.get("value")
            if field_value not in (None, ""):
                return field_value
    return default


def _as_dict(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip().startswith("{"):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _as_int(value, default=1):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return number if number > 0 else default


def _as_decimal(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _resolve_donor(request_user, email):
    if request_user is not None and getattr(request_user, "is_authenticated", False):
        return request_user
    email = (email or "").strip()
    if not email:
        return None
    return get_user_model().objects.filter(email__iexact=email).first()


def _resolve_gifted_to(metadata, client_data):
    raw = (
        _metadata_value(metadata, "gifted_to")
        or _metadata_value(metadata, "gift_for_user_id")
        or (client_data or {}).get("gifted_to")
        or (client_data or {}).get("gift_for_user_id")
    )
    if raw in (None, ""):
        return None
    try:
        return get_user_model().objects.filter(id=int(raw)).first()
    except (TypeError, ValueError):
        return None


def _verify_with_paystack(reference):
    secret = os.getenv("PAYSTACK_SECRET_KEY", "").strip()
    if not secret:
        raise PaymentRecordError("Paystack is not configured.", 500)
    response = requests.get(
        f"https://api.paystack.co/transaction/verify/{reference}",
        headers={"Authorization": f"Bearer {secret}"},
        timeout=20,
    )
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if response.status_code != 200 or not payload.get("status"):
        message = payload.get("message") or "Payment verification failed"
        raise PaymentRecordError(message, 400)
    data = payload.get("data") or {}
    if data.get("status") != "success":
        raise PaymentRecordError("Payment is not successful yet.", 400)
    return data


def _donation_payload(donation, payer_email):
    project = donation.project
    user = donation.donor
    user_total_trees = 0
    if user is not None:
        user_total_trees = (
            TreeProjectDonation.objects.filter(donor=user).aggregate(total=Sum("trees_purchased"))["total"]
            or 0
        )
    certificate_id = f"CW{donation.payment_reference}{donation.id}"
    donor_name = "Anonymous"
    if user is not None:
        donor_name = f"{user.first_name} {user.last_name}".strip() or user.username
    return {
        "success": True,
        "message": "Payment verified successfully",
        "donation_id": donation.id,
        "payment_reference": donation.payment_reference,
        "certificate_id": certificate_id,
        "user_total_trees": user_total_trees,
        "certificate_data": {
            "certificate_id": certificate_id,
            "tree_type": project.name,
            "co2_absorption": float(project.co2_absorption_per_tree),
            "location": f"{project.city}, {project.country}",
            "planting_date": donation.created_at.strftime("%m/%d/%Y"),
            "user_name": donor_name,
            "trees_planted": donation.trees_purchased,
            "amount": float(donation.amount),
            "payer_email": payer_email,
        },
    }


def record_tree_payment(reference, request_user=None, client_data=None):
    reference = str(reference or "").strip()
    if not reference:
        raise PaymentRecordError("Missing payment reference.")

    client_data = client_data or {}
    payment = _verify_with_paystack(reference)
    metadata = payment.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    customer = payment.get("customer") or {}
    payer_email = (customer.get("email") or client_data.get("email") or "").strip()
    donor = _resolve_donor(request_user, payer_email)

    supports_gifted_to = _gifted_to_column_ready()
    gifted_to = _resolve_gifted_to(metadata, client_data) if supports_gifted_to else None

    existing = TreeProjectDonation.objects.filter(payment_reference=reference).select_related("project", "donor").first()
    if existing:
        updates = []
        if existing.donor_id is None and donor is not None:
            existing.donor = donor
            updates.append("donor")
        if (
            supports_gifted_to
            and gifted_to is not None
            and getattr(existing, "gifted_to_id", None) is None
        ):
            existing.gifted_to = gifted_to
            updates.append("gifted_to")
        if not existing.payer_email and payer_email:
            existing.payer_email = payer_email
            updates.append("payer_email")
        if updates:
            existing.save(update_fields=updates)
        payload = _donation_payload(existing, payer_email)
        return _attach_points(payload, existing)

    project_id = _metadata_value(metadata, "project_id") or client_data.get("project_id")
    if not project_id:
        raise PaymentRecordError("This payment has no tree project attached.", 400)
    try:
        project = TreeProject.objects.get(id=project_id)
    except (TreeProject.DoesNotExist, ValueError, TypeError):
        raise PaymentRecordError("Project not found.", 404)

    amount = _as_decimal(payment.get("amount", 0))
    if amount is None:
        raise PaymentRecordError("Paystack did not return a valid amount.", 400)
    amount = (amount / Decimal("100")).quantize(Decimal("0.01"))

    trees_purchased = _as_int(
        _metadata_value(metadata, "trees_purchased") or client_data.get("trees_purchased"),
        1,
    )
    dedication = str(
        _metadata_value(metadata, "dedication_message", "")
        or client_data.get("dedication_message")
        or ""
    )
    selected_species = _as_dict(
        _metadata_value(metadata, "selected_species", {}) or client_data.get("selected_species")
    )
    if selected_species:
        species_text = ", ".join(
            f"{species}: {qty}" for species, qty in selected_species.items() if _as_int(qty, 0) > 0
        )
        if species_text:
            dedication = f"{dedication}\n\nSelected Species: {species_text}".strip()
    if gifted_to is not None:
        gift_label = (
            f"{gifted_to.first_name} {gifted_to.last_name}".strip()
            or gifted_to.username
        )
        dedication = f"{dedication}\n\nGifted to: {gift_label}".strip()
    elif not supports_gifted_to:
        # Keep gift intent in the dedication until migration 0036 is applied.
        raw_gift = (
            _metadata_value(metadata, "gifted_to")
            or _metadata_value(metadata, "gift_for_user_id")
            or client_data.get("gifted_to")
            or client_data.get("gift_for_user_id")
        )
        if raw_gift not in (None, ""):
            dedication = f"{dedication}\n\nGifted to user id: {raw_gift}".strip()

    from .tree_pricing import split_tree_payment

    platform_fee, admin_share, fee_rate = split_tree_payment(amount)

    create_kwargs = {
        "project": project,
        "donor": donor,
        "payer_email": payer_email,
        "amount": amount,
        "platform_fee": platform_fee,
        "admin_share": admin_share,
        "fee_rate": fee_rate,
        "trees_purchased": trees_purchased,
        "payment_reference": reference,
        "payment_status": "completed",
        "dedication_message": dedication,
        "is_anonymous": donor is None,
    }
    if supports_gifted_to and gifted_to is not None:
        create_kwargs["gifted_to"] = gifted_to

    try:
        with transaction.atomic():
            donation = TreeProjectDonation.objects.create(**create_kwargs)
            project.trees_planted += trees_purchased
            # Attribute only the Tree Admin share to project funds
            project.funds_raised += admin_share
            project.save(update_fields=["trees_planted", "funds_raised"])
    except IntegrityError:
        donation = TreeProjectDonation.objects.select_related("project", "donor").get(
            payment_reference=reference
        )
    except (ProgrammingError, OperationalError) as exc:
        # Migration lag: retry without gifted_to / fee fields rather than failing a paid charge.
        logger.exception("Donation create failed; retrying lean create: %s", exc)
        create_kwargs.pop("gifted_to", None)
        for optional in ("platform_fee", "admin_share", "fee_rate"):
            create_kwargs.pop(optional, None)
        with transaction.atomic():
            donation = TreeProjectDonation.objects.create(**create_kwargs)
            project.trees_planted += trees_purchased
            project.funds_raised += admin_share
            project.save(update_fields=["trees_planted", "funds_raised"])

    payload = _donation_payload(donation, payer_email)
    payload["platform_fee"] = float(getattr(donation, "platform_fee", platform_fee) or platform_fee)
    payload["admin_share"] = float(getattr(donation, "admin_share", admin_share) or admin_share)
    payload["fee_rate"] = float(getattr(donation, "fee_rate", fee_rate) or fee_rate)
    return _attach_points(payload, donation)


def _attach_points(payload, donation):
    points_earned = 0
    points_balance = None
    try:
        from .points import credit_gift_points, get_or_create_account

        points_earned = credit_gift_points(donation) or 0
        if donation.donor_id:
            points_balance = get_or_create_account(donation.donor).balance
    except Exception as exc:
        logger.warning("Points credit skipped: %s", exc)
        points_earned = 0
    payload["points_earned"] = points_earned
    payload["points_balance"] = points_balance
    return payload


def webhook_signature_ok(body, signature):
    secret = os.getenv("PAYSTACK_SECRET_KEY", "").strip()
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha512).hexdigest()
    try:
        return hmac.compare_digest(signature, expected)
    except (TypeError, ValueError):
        return False
