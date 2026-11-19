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

from .models import ResponderOrganization, ResponderPlanPayment, TreeProject, TreeProjectDonation

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


def _resolve_climate_event(metadata, client_data):
    raw = (
        _metadata_value(metadata, "climate_event_id")
        or _metadata_value(metadata, "event_id")
        or (client_data or {}).get("climate_event_id")
        or (client_data or {}).get("event_id")
        or (client_data or {}).get("event")
    )
    if raw in (None, ""):
        return None
    try:
        from .models import ClimateEvent

        event = ClimateEvent.objects.filter(id=int(raw)).first()
    except (TypeError, ValueError):
        return None
    if event is None:
        return None
    if not event.allow_tree_gifts:
        return None
    return event


def _resolve_project(metadata, client_data):
    """
    Prefer project_id from Paystack metadata / client payload.
    Fall back to tree type name + planting location so orphaned charges
    (redirect without sessionStorage, webhook-only) still record.
    """
    client_data = client_data or {}
    project_id = _metadata_value(metadata, "project_id") or client_data.get("project_id")
    if project_id not in (None, ""):
        try:
            return TreeProject.objects.get(id=int(project_id))
        except (TreeProject.DoesNotExist, TypeError, ValueError):
            pass

    tree_type = str(
        _metadata_value(metadata, "tree_type")
        or client_data.get("tree_type")
        or ""
    ).strip()
    # Checkout labels projects as "{name} Tree"
    name = tree_type
    if name.lower().endswith(" tree"):
        name = name[: -len(" tree")].strip()
    location = str(
        _metadata_value(metadata, "planting_location")
        or client_data.get("planting_location")
        or ""
    ).strip()

    qs = TreeProject.objects.all()
    if name:
        match = qs.filter(name__iexact=name).first()
        if match:
            return match
        match = qs.filter(name__icontains=name).first()
        if match:
            return match

    if location and "," in location:
        city = location.split(",")[0].strip()
        country = location.split(",")[-1].strip()
        if city:
            match = qs.filter(city__iexact=city).first()
            if match:
                return match
        if city and country:
            match = qs.filter(city__iexact=city, country__icontains=country).first()
            if match:
                return match
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
    from .tree_certificate import certificate_id_for, donor_label, species_summary

    certificate_id = getattr(donation, "certificate_id", "") or certificate_id_for(donation)
    donor_name = donor_label(donation)
    emailed_at = getattr(donation, "certificate_emailed_at", None)
    return {
        "success": True,
        "message": "Payment verified successfully",
        "donation_id": donation.id,
        "payment_reference": donation.payment_reference,
        "certificate_id": certificate_id,
        "certificate_emailed_at": emailed_at.isoformat() if emailed_at else None,
        "user_total_trees": user_total_trees,
        "certificate_data": {
            "certificate_id": certificate_id,
            "tree_type": project.name,
            "project_name": project.name,
            "co2_absorption": float(project.co2_absorption_per_tree),
            "location": f"{project.city}, {project.country}",
            "planting_date": donation.created_at.strftime("%m/%d/%Y"),
            "user_name": donor_name,
            "trees_planted": donation.trees_purchased,
            "amount": float(donation.amount),
            "payer_email": payer_email,
            "species": species_summary(donation),
            "emailed": bool(emailed_at),
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
    climate_event = _resolve_climate_event(metadata, client_data)

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
        if (
            climate_event is not None
            and getattr(existing, "climate_event_id", None) is None
        ):
            existing.climate_event = climate_event
            updates.append("climate_event")
        if not existing.payer_email and payer_email:
            existing.payer_email = payer_email
            updates.append("payer_email")
        if updates:
            existing.save(update_fields=updates)
        try:
            from .tree_pricing import recompute_project_funds_raised

            if existing.project_id:
                recompute_project_funds_raised(existing.project)
        except Exception as exc:
            logger.warning("funds_raised recompute skipped: %s", exc)
        payload = _donation_payload(existing, payer_email)
        return _attach_points(payload, existing)

    project = _resolve_project(metadata, client_data)
    if project is None:
        raise PaymentRecordError(
            "This payment has no tree project attached. "
            "Ask support to recover it with the Paystack reference.",
            400,
        )

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
    from .tree_inventory import apply_species_purchase, validate_species_purchase

    try:
        selected_species, species_total = validate_species_purchase(
            project, selected_species
        )
    except ValueError as exc:
        raise PaymentRecordError(str(exc), 400) from exc
    if species_total > 0:
        trees_purchased = species_total
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
    if climate_event is not None:
        dedication = (
            f"{dedication}\n\nFor Climate day: {climate_event.title}"
        ).strip()
    if not supports_gifted_to:
        # Keep gift intent in the dedication until migration 0036 is applied.
        raw_gift = (
            _metadata_value(metadata, "gifted_to")
            or _metadata_value(metadata, "gift_for_user_id")
            or client_data.get("gifted_to")
            or client_data.get("gift_for_user_id")
        )
        if raw_gift not in (None, ""):
            dedication = f"{dedication}\n\nGifted to user id: {raw_gift}".strip()

    from .tree_pricing import (
        donation_amount_usd,
        recompute_project_funds_raised,
        split_tree_payment,
    )

    # Paystack amount is KES; funds_raised / fee split for project totals use USD.
    usd_meta = dict(metadata) if isinstance(metadata, dict) else {}
    for key in ("amount_usd", "original_usd", "usd_amount", "usd_kes_rate", "exchange_rate"):
        if client_data.get(key) not in (None, ""):
            usd_meta[key] = client_data.get(key)
    amount_usd = donation_amount_usd(
        None,
        project,
        metadata=usd_meta,
        kes_amount=amount,
    )
    org = getattr(project, "tree_admin_org", None)
    platform_fee, admin_share, fee_rate = split_tree_payment(
        amount_usd, org=org
    )

    create_kwargs = {
        "project": project,
        "donor": donor,
        "payer_email": payer_email,
        # Keep charged KES for Paystack reconciliation; fee fields are USD shares.
        "amount": amount,
        "platform_fee": platform_fee,
        "admin_share": admin_share,
        "fee_rate": fee_rate,
        "trees_purchased": trees_purchased,
        "payment_reference": reference,
        "payment_status": "completed",
        "dedication_message": dedication,
        "selected_species": selected_species or {},
        "is_anonymous": donor is None,
    }
    if supports_gifted_to and gifted_to is not None:
        create_kwargs["gifted_to"] = gifted_to
    if climate_event is not None:
        create_kwargs["climate_event"] = climate_event

    try:
        with transaction.atomic():
            locked = TreeProject.objects.select_for_update().get(pk=project.pk)
            # Re-validate against locked inventory
            selected_species, species_total = validate_species_purchase(
                locked, selected_species
            )
            if species_total > 0:
                trees_purchased = species_total
                create_kwargs["trees_purchased"] = trees_purchased
                create_kwargs["selected_species"] = selected_species
            apply_species_purchase(locked, selected_species, save=False)
            create_kwargs["project"] = locked
            donation = TreeProjectDonation.objects.create(**create_kwargs)
            locked.trees_planted += trees_purchased
            locked.save(update_fields=["trees_planted", "tree_species"])
            # Rebuild USD funds from donations (avoids KES-as-USD drift)
            recompute_project_funds_raised(locked)
            project = locked
    except ValueError as exc:
        raise PaymentRecordError(str(exc), 400) from exc
    except IntegrityError:
        donation = TreeProjectDonation.objects.select_related("project", "donor").get(
            payment_reference=reference
        )
    except (ProgrammingError, OperationalError) as exc:
        # Migration lag: retry without gifted_to / fee / selected_species fields.
        logger.exception("Donation create failed; retrying lean create: %s", exc)
        create_kwargs.pop("gifted_to", None)
        create_kwargs.pop("climate_event", None)
        for optional in ("platform_fee", "admin_share", "fee_rate", "selected_species"):
            create_kwargs.pop(optional, None)
        with transaction.atomic():
            locked = TreeProject.objects.select_for_update().get(pk=project.pk)
            apply_species_purchase(locked, selected_species, save=False)
            create_kwargs["project"] = locked
            donation = TreeProjectDonation.objects.create(**create_kwargs)
            locked.trees_planted += trees_purchased
            locked.save(update_fields=["trees_planted", "tree_species"])
            try:
                recompute_project_funds_raised(locked)
            except Exception:
                locked.funds_raised += admin_share
                locked.save(update_fields=["funds_raised"])
            project = locked

    payload = _donation_payload(donation, payer_email)
    payload["selected_species"] = getattr(donation, "selected_species", None) or selected_species or {}
    payload["tree_species"] = getattr(project, "tree_species", None)
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
    try:
        from .tree_certificate import maybe_issue_certificate, build_certificate_context

        maybe_issue_certificate(donation)
        donation.refresh_from_db()
        payload["certificate_id"] = getattr(donation, "certificate_id", "") or ""
        payload["certificate_emailed_at"] = (
            donation.certificate_emailed_at.isoformat()
            if getattr(donation, "certificate_emailed_at", None)
            else None
        )
        # Enrich certificate_data for clients / emails
        cert = payload.get("certificate_data") or {}
        ctx = build_certificate_context(donation)
        cert.update(
            {
                "certificate_id": ctx["certificate_id"],
                "user_name": ctx["donor_name"],
                "gifted_to": ctx["gifted_to"],
                "species": ctx["species"],
                "emailed": bool(donation.certificate_emailed_at),
            }
        )
        payload["certificate_data"] = cert
    except Exception as exc:
        logger.warning("Certificate hook skipped: %s", exc)
    try:
        from .paystack_transfers import payout_on_commit

        if getattr(donation, "id", None) and (
            getattr(donation, "payment_status", "") or ""
        ) == "completed":
            payout_on_commit(donation.id)
    except Exception as exc:
        logger.warning("Tree admin payout hook skipped: %s", exc)
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


def payment_product_type(payment_data):
    metadata = payment_data.get("metadata") if isinstance(payment_data, dict) else {}
    if not isinstance(metadata, dict):
        metadata = {}
    product = (
        _metadata_value(metadata, "product")
        or _metadata_value(metadata, "payment_type")
        or ""
    )
    return str(product).strip().lower()


def record_rapidbrief_payment(reference, request_user=None, client_data=None):
    """Activate / renew a RapidBrief paid plan after a successful Paystack charge."""
    from .pricing import activate_paid_plan, is_billable_plan, normalize_plan, plan_meta

    reference = str(reference or "").strip()
    if not reference:
        raise PaymentRecordError("Missing payment reference.")

    client_data = client_data or {}
    existing = ResponderPlanPayment.objects.filter(payment_reference=reference).select_related(
        "org"
    ).first()
    if existing and existing.payment_status == "completed":
        return {
            "success": True,
            "message": "RapidBrief plan already activated.",
            "payment_reference": existing.payment_reference,
            "org_id": existing.org_id,
            "plan": existing.plan,
            "plan_status": existing.org.plan_status,
            "plan_ends_at": existing.org.plan_ends_at,
        }

    payment = _verify_with_paystack(reference)
    metadata = payment.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    product = (
        _metadata_value(metadata, "product")
        or client_data.get("product")
        or ""
    )
    if str(product).strip().lower() not in {"rapidbrief", "responder_plan", "rapidbrief_plan"}:
        # Allow reference-only verify when client passes org_id + plan.
        if not (client_data.get("org_id") or _metadata_value(metadata, "org_id")):
            raise PaymentRecordError("This payment is not a RapidBrief plan charge.", 400)

    org_id = _metadata_value(metadata, "org_id") or client_data.get("org_id")
    try:
        org = ResponderOrganization.objects.get(id=int(org_id))
    except (TypeError, ValueError, ResponderOrganization.DoesNotExist):
        raise PaymentRecordError("Responder organization not found.", 404)

    if org.verification_status != "approved":
        raise PaymentRecordError("Organization must be verified before paying.", 400)

    plan = normalize_plan(
        _metadata_value(metadata, "plan") or client_data.get("plan") or org.plan,
        org.org_type,
    )
    if not is_billable_plan(plan):
        raise PaymentRecordError("Selected plan is not billable via Paystack.", 400)

    months = _as_int(
        _metadata_value(metadata, "months") or client_data.get("months"),
        1,
    )
    months = max(1, min(months, 12))
    meta = plan_meta(plan)
    expected_kes = Decimal(str(meta["price_kes_month"])) * months

    amount = _as_decimal(payment.get("amount", 0))
    if amount is None:
        raise PaymentRecordError("Paystack did not return a valid amount.", 400)
    amount = (amount / Decimal("100")).quantize(Decimal("0.01"))
    # Allow small gateway rounding; reject large underpay.
    if amount + Decimal("1.00") < expected_kes:
        raise PaymentRecordError(
            f"Paid amount KES {amount} is below plan price KES {expected_kes}.",
            400,
        )

    customer = payment.get("customer") or {}
    payer_email = (customer.get("email") or client_data.get("email") or "").strip()
    payer = _resolve_donor(request_user, payer_email)

    with transaction.atomic():
        activate_paid_plan(org, plan=plan, months=months)
        org.save()
        if existing:
            existing.plan = plan
            existing.months = months
            existing.amount = amount
            existing.payment_status = "completed"
            existing.payer_email = payer_email or existing.payer_email
            if payer is not None:
                existing.paid_by = payer
            existing.save()
            record = existing
        else:
            try:
                record = ResponderPlanPayment.objects.create(
                    org=org,
                    plan=plan,
                    months=months,
                    amount=amount,
                    currency="KES",
                    payment_reference=reference,
                    payment_status="completed",
                    payer_email=payer_email,
                    paid_by=payer,
                )
            except IntegrityError:
                record = ResponderPlanPayment.objects.select_related("org").get(
                    payment_reference=reference
                )

    return {
        "success": True,
        "message": "RapidBrief plan activated.",
        "payment_reference": record.payment_reference,
        "org_id": org.id,
        "plan": org.plan,
        "plan_label": meta.get("name"),
        "plan_status": org.plan_status,
        "plan_ends_at": org.plan_ends_at,
        "max_seats": org.max_seats,
        "max_coverage_km": meta.get("max_coverage_km"),
    }


def record_plastic_sponsorship(reference, request_user=None, client_data=None):
    """Record sponsor-a-kilo Paystack charge for Plastic Pulse."""
    from django.db import IntegrityError, transaction
    from django.contrib.auth import get_user_model

    from .models import PlasticProject, PlasticSponsorship
    from .plastic import _issue_certificate, _money, _dec
    from .tree_pricing import split_tree_payment

    User = get_user_model()
    reference = str(reference or "").strip()
    if not reference:
        raise PaymentRecordError("Missing payment reference.")

    client_data = client_data or {}
    existing = PlasticSponsorship.objects.filter(
        payment_reference=reference
    ).select_related("project").first()
    if existing and existing.payment_status == "completed":
        return {
            "success": True,
            "message": "Plastic sponsorship already recorded.",
            "payment_reference": existing.payment_reference,
            "sponsorship_id": existing.id,
            "certificate_id": existing.certificate_id,
            "kg_sponsored": float(existing.kg_sponsored),
            "product": "plastic",
        }

    payment = _verify_with_paystack(reference)
    metadata = payment.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    project_id = (
        _metadata_value(metadata, "plastic_project_id")
        or _metadata_value(metadata, "project_id")
        or client_data.get("plastic_project_id")
        or client_data.get("project_id")
    )
    try:
        project = PlasticProject.objects.select_related("tree_admin_org").get(
            pk=int(project_id)
        )
    except (TypeError, ValueError, PlasticProject.DoesNotExist) as exc:
        raise PaymentRecordError("Plastic project not found.", 404) from exc

    kg = _money(
        _metadata_value(metadata, "kg_sponsored")
        or client_data.get("kg_sponsored")
        or client_data.get("kg")
        or 0
    )
    if kg <= 0:
        raise PaymentRecordError("Invalid kg_sponsored.", 400)

    amount_kes = _as_decimal(payment.get("amount", 0))
    if amount_kes is None:
        raise PaymentRecordError("Paystack did not return a valid amount.", 400)
    amount_kes = (amount_kes / Decimal("100")).quantize(Decimal("0.01"))

    usd_meta = dict(metadata)
    for key in ("amount_usd", "original_usd", "usd_amount", "usd_kes_rate", "exchange_rate"):
        if client_data.get(key) not in (None, ""):
            usd_meta[key] = client_data.get(key)
    # Reuse tree USD resolver with a shim project price path via metadata amount_usd
    amount_usd = _money(
        _metadata_value(usd_meta, "amount_usd")
        or client_data.get("amount_usd")
        or 0
    )
    if amount_usd <= 0:
        # Fall back: kg × project sponsor price
        amount_usd = _money(_dec(project.sponsor_price_usd_per_kg) * kg)

    org = project.tree_admin_org
    platform_fee, admin_share, fee_rate = split_tree_payment(amount_usd, org=org)

    payer_email = (
        payment.get("customer", {}) or {}
    ).get("email") or client_data.get("email") or ""
    donor = request_user if getattr(request_user, "is_authenticated", False) else None
    if donor is None and payer_email:
        donor = User.objects.filter(email__iexact=payer_email).first()

    dedication = str(
        _metadata_value(metadata, "dedication_message")
        or client_data.get("dedication_message")
        or ""
    )[:2000]
    display = str(
        _metadata_value(metadata, "sponsor_name")
        or client_data.get("sponsor_name")
        or ""
    )[:200]

    try:
        with transaction.atomic():
            sponsorship = PlasticSponsorship.objects.create(
                project=project,
                sponsor=donor,
                payer_email=payer_email or "",
                sponsor_display_name=display,
                kg_sponsored=kg,
                amount=amount_kes,
                amount_usd=amount_usd,
                platform_fee=platform_fee,
                admin_share=admin_share,
                fee_rate=fee_rate,
                payment_reference=reference,
                payment_status="completed",
                dedication_message=dedication,
            )
    except IntegrityError:
        sponsorship = PlasticSponsorship.objects.select_related("project").get(
            payment_reference=reference
        )

    points_earned = 0
    try:
        from .points import credit_sponsor_points, get_or_create_account

        points_earned = credit_sponsor_points(sponsorship) or 0
    except Exception as exc:
        logger.warning("Plastic sponsor points skipped: %s", exc)

    cert_code = sponsorship.certificate_id
    if not cert_code:
        holder = display or (
            donor.get_full_name() if donor else ""
        ) or payer_email.split("@")[0]
        cert = _issue_certificate(
            project=project,
            kg=kg,
            holder_name=holder,
            holder_email=payer_email or "",
            sponsorship=sponsorship,
        )
        cert_code = cert.code
        sponsorship.refresh_from_db()

    return {
        "success": True,
        "message": "Plastic sponsorship recorded.",
        "payment_reference": reference,
        "sponsorship_id": sponsorship.id,
        "project_id": project.id,
        "kg_sponsored": float(kg),
        "amount_usd": float(amount_usd),
        "platform_fee": float(platform_fee),
        "admin_share": float(admin_share),
        "certificate_id": cert_code,
        "points_earned": points_earned,
        "product": "plastic",
    }


def record_paystack_charge(reference, request_user=None, client_data=None):
    """
    Route a verified Paystack reference to tree donation, plastic, or RapidBrief billing.
    Used by the browser verify endpoint and the webhook.
    """
    client_data = client_data or {}
    product = str(client_data.get("product") or "").strip().lower()
    if product in {"rapidbrief", "responder_plan", "rapidbrief_plan"}:
        return record_rapidbrief_payment(reference, request_user, client_data)
    if product in {"plastic", "plastic_pulse", "sponsor_plastic"}:
        return record_plastic_sponsorship(reference, request_user, client_data)

    # Peek metadata without failing tree flow when secret/network errors.
    try:
        payment = _verify_with_paystack(str(reference or "").strip())
        ptype = payment_product_type(payment)
        if ptype in {
            "rapidbrief",
            "responder_plan",
            "rapidbrief_plan",
        }:
            return record_rapidbrief_payment(reference, request_user, client_data)
        if ptype in {"plastic", "plastic_pulse", "sponsor_plastic"}:
            return record_plastic_sponsorship(reference, request_user, client_data)
    except PaymentRecordError:
        # Fall through to tree recording — tree verify will re-check Paystack.
        pass

    return record_tree_payment(reference, request_user, client_data)
