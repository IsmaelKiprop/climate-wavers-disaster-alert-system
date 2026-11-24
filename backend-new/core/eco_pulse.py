"""Eco Pulse vendor, catalog, order and follow-up endpoints."""
import os
import uuid
import requests
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone

from django.db import transaction
from django.db.models import Count, Q
from django.conf import settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (CommunityChampion, EcoInstallCheckIn, EcoOrder, EcoProduct,
                     EcoVendor, EcoVendorEndorsement, TreeAdminMembership,
                     SocialGroup, SocialGroupMembership, SeasonalChallenge)


def product_data(product):
    vendor = product.vendor
    stamps = vendor.endorsements.count()
    return {"id": product.id, "title": product.title, "description": product.description,
        "category": product.category, "outcome_tag": product.outcome_tag,
        "price_kes": product.price_kes, "install_included": product.install_included,
        "warranty_days": product.warranty_days, "coverage_wards": product.coverage_wards,
        "photos": product.photos, "vendor": {"id": vendor.id, "name": vendor.name,
        "county": vendor.county, "city": vendor.city, "coverage_wards": vendor.coverage_wards,
        "trust_count": stamps, "community_trusted": stamps >= 3}}


class EcoCatalogView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        qs = EcoProduct.objects.filter(is_published=True, vendor__verification_status="approved").select_related("vendor").annotate(trust_count=Count("vendor__endorsements", distinct=True))
        county, outcome = request.query_params.get("county"), request.query_params.get("outcome")
        if outcome: qs = qs.filter(outcome_tag=outcome)
        products=list(qs.order_by("vendor__county", "title"))
        if county:
            needle=county.casefold()
            products=[p for p in products if p.vendor.county.casefold()==needle or any(str(w).casefold()==needle for w in p.coverage_wards)]
        return Response({"results": [product_data(p) for p in products]})


class EcoApplyView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        d = request.data
        name, county = str(d.get("name", "")).strip(), str(d.get("county", "")).strip()
        if not name or not county: return Response({"detail": "Vendor name and coverage county are required."}, status=400)
        org_type=str(d.get("org_type") or "cbo").strip()
        if org_type not in dict(EcoVendor.ORG_TYPES): return Response({"detail":"Choose a valid organization type."},status=400)
        wards=d.get("coverage_wards", [])
        if not isinstance(wards,list): return Response({"detail":"Coverage wards must be a list."},status=400)
        vendor, created = EcoVendor.objects.get_or_create(owner=request.user, defaults={
            "name": name[:200], "org_type": org_type, "county": county[:100],
            "city": str(d.get("city", ""))[:100], "coverage_wards": wards,
            "contact_email": request.user.email or "", "contact_phone": str(d.get("contact_phone", ""))[:40]})
        return Response({"id": vendor.id, "name": vendor.name, "verification_status": vendor.verification_status,
                         "message": "Application submitted for verification."}, status=201 if created else 200)


class EcoVendorDeskView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        vendor = EcoVendor.objects.filter(owner=request.user).first()
        if not vendor: return Response({"detail": "Apply to become an Eco Pulse vendor first."}, status=404)
        return Response({"vendor": {"id": vendor.id, "name": vendor.name, "county": vendor.county,
            "verification_status": vendor.verification_status, "platform_fee_rate": str(vendor.platform_fee_rate),
            "payout_channel": vendor.payout_channel, "payout_account_name": vendor.payout_account_name,
            "payout_account_number": vendor.payout_account_number, "payouts_enabled": vendor.payouts_enabled},
            "products": [product_data(p) for p in vendor.products.all()],
            "orders": list(vendor.orders.select_related("product", "buyer").values("id", "product__title", "quantity", "amount_kes", "status", "buyer_county", "buyer_ward", "buyer__email", "created_at"))})
    def post(self, request):
        vendor = EcoVendor.objects.filter(owner=request.user).first()
        if not vendor or vendor.verification_status != "approved": return Response({"detail": "Approved vendor access required."}, status=403)
        d = request.data
        title, county = str(d.get("title", "")).strip(), str(d.get("county", vendor.county)).strip()
        if not title or not county: return Response({"detail": "Title and at least one coverage county are required."}, status=400)
        if d.get("category") not in dict(EcoProduct.CATEGORIES) or d.get("outcome_tag") not in dict(EcoProduct.OUTCOMES): return Response({"detail":"Choose a valid category and community outcome."},status=400)
        try:
            price = int(d.get("price_kes")); warranty = int(d.get("warranty_days", 0))
        except (TypeError, ValueError): return Response({"detail": "Enter a valid price and warranty."}, status=400)
        if price <= 0 or warranty < 0: return Response({"detail":"Price must be positive and warranty cannot be negative."},status=400)
        photos=d.get("photos") or []
        if isinstance(photos, str): photos=[photos] if photos.strip() else []
        product = EcoProduct.objects.create(vendor=vendor, title=title[:200], description=str(d.get("description", "")), category=d.get("category"), outcome_tag=d.get("outcome_tag"), price_kes=price, install_included=str(d.get("install_included", "")).lower() in ("true","1","on"), warranty_days=max(0, warranty), coverage_wards=d.get("coverage_wards") or [county], photos=photos, is_published=True)
        return Response(product_data(product), status=201)
    def patch(self, request):
        vendor = EcoVendor.objects.filter(owner=request.user).first()
        if not vendor: return Response({"detail": "Vendor application not found."}, status=404)
        d=request.data
        for field in ("payout_channel", "payout_account_name", "payout_account_number"):
            if field in d:
                value=str(d[field])[:200]
                if field=="payout_account_number" and value != vendor.payout_account_number:
                    vendor.paystack_recipient_code=""
                setattr(vendor, field, value)
        vendor.save()
        return Response({"saved": True, "payouts_enabled": vendor.payouts_enabled})


class EcoOrderView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        d=request.data
        try: product=EcoProduct.objects.select_related("vendor").get(pk=d.get("product_id"), is_published=True, vendor__verification_status="approved")
        except (EcoProduct.DoesNotExist, ValueError, TypeError): return Response({"detail": "Product is unavailable."}, status=404)
        try: qty=max(1, min(1000, int(d.get("quantity", 1))))
        except (ValueError, TypeError): return Response({"detail": "Invalid quantity."}, status=400)
        county=str(d.get("county", "")).strip()
        covered = county.casefold() == product.vendor.county.casefold() or any(county.casefold() == str(x).casefold() for x in product.coverage_wards)
        total=product.price_kes*qty
        fee=int(Decimal(total)*product.vendor.platform_fee_rate)
        chapter=challenge=None
        if d.get("challenge_id") or d.get("chapter_id"):
            if not (d.get("challenge_id") and d.get("chapter_id")): return Response({"detail":"Choose both a chapter and an active challenge."},status=400)
            challenge=SeasonalChallenge.objects.filter(pk=d.get("challenge_id"),status="active",starts_at__lte=timezone.now(),ends_at__gte=timezone.now()).first()
            chapter=SocialGroup.objects.filter(pk=d.get("chapter_id"),is_verified=True).first()
            if not challenge or not chapter: return Response({"detail":"Choose a verified chapter and active challenge."},status=400)
            if not SocialGroupMembership.objects.filter(group=chapter,user=request.user).exists(): return Response({"detail":"Join this chapter before ordering for its challenge."},status=403)
        order=EcoOrder.objects.create(buyer=request.user, product=product, vendor=product.vendor, quantity=qty, buyer_county=county[:100], buyer_ward=str(d.get("ward", ""))[:100], amount_kes=total, platform_fee_kes=fee, vendor_share_kes=total-fee, status="pending" if covered else "lead", chapter=chapter, challenge=challenge)
        return Response({"id": order.id, "status": order.status, "amount_kes": total,
            "message": "Order request created." if covered else "This county is outside coverage. The vendor received your quote request."}, status=201)
    def patch(self, request):
        try: order=EcoOrder.objects.get(pk=request.data.get("order_id"),vendor__owner=request.user)
        except (EcoOrder.DoesNotExist,ValueError,TypeError): return Response({"detail":"Order not found."},status=404)
        state=request.data.get("status")
        allowed={"paid":"install_scheduled","install_scheduled":"installed"}
        if allowed.get(order.status)!=state: return Response({"detail":"Order status transition is not allowed."},status=400)
        order.status=state
        fields=["status"]
        if state=="installed": order.installed_at=timezone.now(); fields.append("installed_at")
        order.save(update_fields=fields)
        return Response({"id":order.id,"status":state})


class EcoCheckoutView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request):
        try: order=EcoOrder.objects.select_related("product").get(pk=request.data.get("order_id"),buyer=request.user,status="pending")
        except (EcoOrder.DoesNotExist,ValueError,TypeError): return Response({"detail":"Eligible order not found."},status=404)
        secret=os.getenv("PAYSTACK_SECRET_KEY","").strip()
        if not secret: return Response({"detail":"Paystack is not configured."},status=503)
        email=(request.user.email or "").strip()
        if not email: return Response({"detail":"Add an email to your account before checkout."},status=400)
        reference=f"eco_{order.id}_{uuid.uuid4().hex[:16]}"
        try:
            result=requests.post("https://api.paystack.co/transaction/initialize",headers={"Authorization":f"Bearer {secret}","Content-Type":"application/json"},json={"email":email,"amount":order.amount_kes*100,"currency":"KES","reference":reference,"callback_url":f"{settings.FRONTEND_URL.rstrip('/')}/eco-pulse?eco_order={order.id}","metadata":{"product":"eco_pulse","eco_order_id":order.id,"user_id":request.user.id}},timeout=20)
            payload=result.json()
        except Exception: return Response({"detail":"Could not reach Paystack. Please try again."},status=502)
        if result.status_code!=200 or not payload.get("status"): return Response({"detail":payload.get("message","Paystack checkout failed")},status=502)
        order.payment_reference=reference; order.save(update_fields=["payment_reference"])
        return Response({"authorization_url":payload["data"].get("authorization_url"),"reference":reference})


class EcoEndorsementView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, vendor_id):
        try: vendor=EcoVendor.objects.get(pk=vendor_id, verification_status="approved")
        except EcoVendor.DoesNotExist: return Response({"detail":"Vendor not found."}, status=404)
        champion=CommunityChampion.objects.filter(user=request.user, status="active").exists()
        tree_member=bool(vendor.city or vendor.county) and TreeAdminMembership.objects.filter(user=request.user, org__verification_status="approved", org__city__gt="").filter(Q(org__city__iexact=vendor.city)|Q(org__city__iexact=vendor.county)).exists()
        cbo_member=SocialGroupMembership.objects.filter(user=request.user,group__is_verified=True,group__group_type__in=["cbo","school","chapter"]).filter(Q(group__county__iexact=vendor.county)|Q(group__ward__in=vendor.coverage_wards)).exists()
        if not (champion or tree_member or cbo_member or request.user.is_staff): return Response({"detail":"Only verified nearby champions, CBO members, or Tree Admins can endorse vendors."}, status=403)
        local_champion=CommunityChampion.objects.filter(user=request.user,status="active").first()
        champion_places={str(v).strip().casefold() for v in (getattr(local_champion,"region",""),getattr(local_champion,"city",""),getattr(local_champion,"ward","")) if v}
        if local_champion and not champion_places.intersection({vendor.county.casefold(),vendor.city.casefold(),*(str(w).casefold() for w in vendor.coverage_wards)}):
            return Response({"detail":"Endorsements are limited to vendors serving your county or ward."},status=403)
        EcoVendorEndorsement.objects.get_or_create(vendor=vendor,user=request.user,defaults={"note":str(request.data.get("note", ""))[:500]})
        count=vendor.endorsements.count()
        return Response({"trust_count":count,"community_trusted":count>=3})


class EcoCheckInView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self, request, order_id):
        try: order=EcoOrder.objects.get(pk=order_id,buyer=request.user,status__in=["installed","checked_in"])
        except EcoOrder.DoesNotExist: return Response({"detail":"Installed order not found."},status=404)
        try: day=int(request.data.get("day_mark"))
        except (ValueError,TypeError): return Response({"detail":"day_mark must be 30 or 90."},status=400)
        if day not in (30,90): return Response({"detail":"day_mark must be 30 or 90."},status=400)
        if not order.installed_at or timezone.now() < order.installed_at + timedelta(days=day):
            return Response({"detail":f"The {day}-day check-in is not due yet."},status=400)
        row,_=EcoInstallCheckIn.objects.update_or_create(order=order,day_mark=day,defaults={"working":bool(request.data.get("working")),"note":str(request.data.get("note", ""))[:500],"latitude":request.data.get("latitude"),"longitude":request.data.get("longitude")})
        order.status="checked_in"; order.save(update_fields=["status"])
        return Response({"id":row.id,"working":row.working,"day_mark":day})


class EcoMyOrdersView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        rows=EcoOrder.objects.filter(buyer=request.user).select_related("product","vendor").order_by("-created_at")
        return Response([{"id":o.id,"product":o.product.title,"vendor":o.vendor.name,"status":o.status,
            "amount_kes":o.amount_kes,"installed_at":o.installed_at,"checkins":list(o.checkins.values("day_mark","working"))} for o in rows])


class EcoChallengeOptionsView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        groups=SocialGroup.objects.filter(is_verified=True,memberships__user=request.user).distinct().order_by("name")
        challenges=SeasonalChallenge.objects.filter(status="active",starts_at__lte=timezone.now(),ends_at__gte=timezone.now()).order_by("title")
        return Response({"groups":[{"id":g.id,"name":g.name,"county":g.county} for g in groups],"challenges":[{"id":c.id,"title":c.title,"county":c.county} for c in challenges]})


class EcoAdminView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser): return Response({"detail":"Staff access required."},status=403)
        return Response({"vendors":list(EcoVendor.objects.values("id","name","county","verification_status","payouts_enabled","platform_fee_rate","created_at")),"products":list(EcoProduct.objects.values("id","title","vendor__name","is_published")),"orders":list(EcoOrder.objects.values("id","product__title","vendor__name","amount_kes","status","created_at"))})
    def post(self, request, vendor_id):
        if not (request.user.is_staff or request.user.is_superuser): return Response({"detail":"Staff access required."},status=403)
        try: vendor=EcoVendor.objects.get(pk=vendor_id)
        except EcoVendor.DoesNotExist:return Response({"detail":"Vendor not found."},status=404)
        state=request.data.get("verification_status")
        if state is not None:
            if state not in ("approved","rejected","pending"): return Response({"detail":"Invalid verification status."},status=400)
            vendor.verification_status=state
        if "payouts_enabled" in request.data:
            vendor.payouts_enabled = bool(request.data.get("payouts_enabled")) and vendor.verification_status == "approved"
        updates=["verification_status","payouts_enabled","updated_at"]
        if "platform_fee_rate" in request.data:
            try: rate=Decimal(str(request.data["platform_fee_rate"]))
            except Exception: return Response({"detail":"Fee rate must be a percentage from 0 to 50."},status=400)
            if rate<0 or rate>Decimal("0.5"): return Response({"detail":"Fee rate must be between 0 and 50%."},status=400)
            vendor.platform_fee_rate=rate; updates.append("platform_fee_rate")
        vendor.save(update_fields=updates)
        if vendor.verification_status=="approved": vendor.products.filter(is_published=False).update(is_published=True)
        return Response({"id":vendor.id,"verification_status":vendor.verification_status,"payouts_enabled":vendor.payouts_enabled})
