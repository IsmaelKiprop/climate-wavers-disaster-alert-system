"""Public ward / county impact map: trees, plastic hotspots, verified hazards."""

from __future__ import annotations

import logging
from collections import defaultdict

from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CommunityHazardCorroboration,
    EcoInstallCheckIn,
    Disaster,
    OfficialAlertEvent,
    PlasticHoldingZone,
    PlasticHotspot,
    PlasticProject,
    PlasticRecovery,
    TreeProject,
    TreeProjectDonation,
    TreeProjectUpdate,
)

logger = logging.getLogger(__name__)


def _f(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _recovery_kg(recovery) -> float:
    verified = getattr(recovery, "kg_verified", None)
    if verified is not None:
        return float(verified or 0)
    return float(getattr(recovery, "kg_claimed", None) or 0)


def _in_east_africa(lat, lng) -> bool:
    try:
        return -5.5 <= float(lat) <= 5.5 and 29.0 <= float(lng) <= 42.5
    except (TypeError, ValueError):
        return False


def _accurate_coords(lat, lng):
    """Only real in-region coordinates — never invent city-center guesses."""
    if lat is None or lng is None:
        return None, None
    if not _in_east_africa(lat, lng):
        return None, None
    return lat, lng


def _plastic_display_coords(lat, lng, *, hotspot=None, project=None):
    """
    Map pins must be accurate GPS.
    Use bag coords if valid; else a real hotspot/project pin that is itself in-region.
    Do not fabricate Eldoret/Nairobi city centers from text labels.
    """
    good = _accurate_coords(lat, lng)
    if good[0] is not None:
        return good
    for obj in (hotspot, project):
        if obj is None:
            continue
        plat, plng = _accurate_coords(
            _f(getattr(obj, "latitude", None)),
            _f(getattr(obj, "longitude", None)),
        )
        if plat is not None:
            return plat, plng
    return None, None


class CommunityImpactMapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        county = (request.query_params.get("county") or "").strip()
        layer = (request.query_params.get("layer") or "all").strip().lower()

        features = []
        errors = []
        skipped_inaccurate = 0

        if layer in ("all", "trees"):
            try:
                tree_feats, tree_skip = self._tree_features(county)
                features.extend(tree_feats)
                skipped_inaccurate += tree_skip
            except Exception as exc:
                logger.exception("impact-map trees layer failed: %s", exc)
                errors.append({"layer": "trees", "detail": str(exc)[:200]})

        if layer in ("all", "plastic"):
            try:
                plastic_feats, plastic_skip = self._plastic_features(county)
                features.extend(plastic_feats)
                skipped_inaccurate += plastic_skip
            except Exception as exc:
                logger.exception("impact-map plastic layer failed: %s", exc)
                errors.append({"layer": "plastic", "detail": str(exc)[:200]})

        if layer in ("all", "hazards"):
            try:
                features.extend(self._hazard_features(county))
            except Exception as exc:
                logger.exception("impact-map hazards layer failed: %s", exc)
                errors.append({"layer": "hazards", "detail": str(exc)[:200]})

        if layer in ("all", "eco"):
            try:
                eco_qs = EcoInstallCheckIn.objects.select_related("order", "order__product").filter(
                    order__status="checked_in"
                )
                if county:
                    eco_qs = eco_qs.filter(Q(order__buyer_county__icontains=county) | Q(order__buyer_ward__icontains=county))
                seen_eco_orders = set()
                for checkin in eco_qs.order_by("-created_at")[:1000]:
                    if checkin.order_id in seen_eco_orders:
                        continue
                    seen_eco_orders.add(checkin.order_id)
                    if not checkin.working:
                        continue
                    lat, lng = _accurate_coords(_f(checkin.latitude), _f(checkin.longitude))
                    if lat is None or lng is None:
                        skipped_inaccurate += 1
                        continue
                    order = checkin.order
                    features.append({"layer":"eco", "id":f"eco-{checkin.id}",
                        "title":order.product.title, "subtitle":f"Installed kit · working at day {checkin.day_mark}",
                        "county":order.buyer_county, "ward":order.buyer_ward,
                        "latitude":lat,"longitude":lng,
                        "meta":{"order_id":order.id,"product_id":order.product_id,"day_mark":checkin.day_mark}})
            except Exception as exc:
                logger.exception("impact-map Eco Pulse layer failed: %s", exc)
                errors.append({"layer":"eco", "detail":str(exc)[:200]})

        counties = defaultdict(
            lambda: {"trees": 0, "plastic_points": 0, "hazards": 0, "eco_kits": 0, "county": ""}
        )
        for f in features:
            key = (f.get("county") or "Unknown").strip() or "Unknown"
            counties[key]["county"] = key
            if f["layer"] == "trees":
                counties[key]["trees"] += int(f.get("meta", {}).get("trees") or 0)
            elif f["layer"] == "plastic":
                counties[key]["plastic_points"] += 1
            elif f["layer"] == "hazards":
                counties[key]["hazards"] += 1
            elif f["layer"] == "eco":
                counties[key]["eco_kits"] += 1

        payload = {
            "features": features,
            "count": len(features),
            "skipped_inaccurate_gps": skipped_inaccurate,
            "counties": sorted(
                counties.values(),
                key=lambda c: c["trees"] + c["plastic_points"] + c["hazards"] + c["eco_kits"],
                reverse=True,
            )[:40],
        }
        if errors:
            payload["errors"] = errors
        return Response(payload)

    def _tree_features(self, county: str):
        """
        Prefer geotagged planting proofs / survival pins on funded gifts.
        Only accurate in-region GPS is mapped — never invent city centers.
        """
        out = []
        skipped = 0
        seen_donations = set()
        seen_coords = set()

        proof_qs = (
            TreeProjectUpdate.objects.select_related("project", "donation", "donation__project")
            .filter(update_type="planting_proof")
            .exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
        )
        if county:
            proof_qs = proof_qs.filter(
                Q(project__region__icontains=county)
                | Q(project__city__icontains=county)
                | Q(donation__project__region__icontains=county)
                | Q(donation__project__city__icontains=county)
            )
        for proof in proof_qs.order_by("-created_at")[:500]:
            lat, lng = _accurate_coords(_f(proof.latitude), _f(proof.longitude))
            if lat is None or lng is None:
                skipped += 1
                continue
            donation = proof.donation
            if donation is not None:
                if donation.id in seen_donations:
                    continue
                seen_donations.add(donation.id)
                trees = donation.trees_purchased or 1
                status = donation.planting_status or "planted"
                donation_id = donation.id
                project = donation.project or proof.project
            else:
                trees = proof.trees_planted_this_update or 1
                status = "planted"
                donation_id = None
                project = proof.project
            coord_key = (round(lat, 5), round(lng, 5), donation_id or f"proof-{proof.id}")
            if coord_key in seen_coords:
                continue
            seen_coords.add(coord_key)
            out.append(
                {
                    "layer": "trees",
                    "id": f"tree-proof-{proof.id}",
                    "title": (project.name if project else None) or proof.title or "Tree gift",
                    "subtitle": f"{trees} tree(s) · {status}",
                    "county": (
                        (project.region or project.city or "") if project else ""
                    ),
                    "ward": proof.location_label
                    or getattr(donation, "survival_location_label", "")
                    or "",
                    "latitude": lat,
                    "longitude": lng,
                    "meta": {
                        "trees": trees,
                        "status": status,
                        "donation_id": donation_id,
                        "project_id": getattr(project, "id", None),
                        "proof_id": proof.id,
                    },
                }
            )

        tree_qs = TreeProjectDonation.objects.select_related("project").filter(
            payment_status="completed",
            planting_status__in=[
                "planted",
                "surviving_30",
                "surviving_90",
                "surviving_180",
            ],
        )
        if county:
            tree_qs = tree_qs.filter(
                Q(project__region__icontains=county)
                | Q(project__city__icontains=county)
            )
        for d in tree_qs.order_by("-planted_at")[:500]:
            if d.id in seen_donations:
                continue
            try:
                lat = _f(getattr(d, "survival_lat", None))
                lng = _f(getattr(d, "survival_lng", None))
                if lat is None or lng is None:
                    proof = (
                        d.planting_updates.exclude(latitude__isnull=True)
                        .exclude(longitude__isnull=True)
                        .order_by("-created_at")
                        .first()
                    )
                    if proof:
                        lat, lng = _f(proof.latitude), _f(proof.longitude)
                    else:
                        proj = d.project
                        lat, lng = _f(proj.latitude), _f(proj.longitude)
                lat, lng = _accurate_coords(lat, lng)
                if lat is None or lng is None:
                    skipped += 1
                    continue
                seen_donations.add(d.id)
                proj = d.project
                out.append(
                    {
                        "layer": "trees",
                        "id": f"tree-{d.id}",
                        "title": proj.name if proj else f"Gift #{d.id}",
                        "subtitle": f"{d.trees_purchased} tree(s) · {d.planting_status}",
                        "county": (proj.region or proj.city or "") if proj else "",
                        "ward": getattr(d, "survival_location_label", "") or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "trees": d.trees_purchased,
                            "status": d.planting_status,
                            "donation_id": d.id,
                            "project_id": d.project_id,
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip tree donation %s: %s", d.id, exc)

        # Grove sites with accurate coordinates only.
        project_qs = (
            TreeProject.objects.exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
            .filter(Q(trees_planted__gt=0) | Q(status="active"))
        )
        if county:
            project_qs = project_qs.filter(
                Q(region__icontains=county) | Q(city__icontains=county)
            )
        for proj in project_qs.order_by("-updated_at")[:200]:
            lat, lng = _accurate_coords(_f(proj.latitude), _f(proj.longitude))
            if lat is None or lng is None:
                skipped += 1
                continue
            coord_key = (round(lat, 5), round(lng, 5), f"project-{proj.id}")
            if coord_key in seen_coords:
                continue
            seen_coords.add(coord_key)
            trees = int(proj.trees_planted or 0)
            out.append(
                {
                    "layer": "trees",
                    "id": f"tree-project-{proj.id}",
                    "title": proj.name or f"Grove #{proj.id}",
                    "subtitle": f"{trees} tree(s) planted · project site",
                    "county": proj.region or proj.city or "",
                    "ward": proj.city or "",
                    "latitude": lat,
                    "longitude": lng,
                    "meta": {
                        "trees": trees or 1,
                        "status": "project_site",
                        "project_id": proj.id,
                    },
                }
            )

        return out, skipped

    def _plastic_features(self, county: str):
        """Hotspots, bag proofs, holding zones, and project sites — accurate GPS only."""
        out = []
        skipped = 0
        county_q = Q()
        if county:
            county_q = Q(project__region__icontains=county) | Q(
                project__city__icontains=county
            )

        hotspot_qs = PlasticHotspot.objects.select_related("project").all()
        if county:
            hotspot_qs = hotspot_qs.filter(county_q)
        for h in hotspot_qs.order_by("-created_at")[:400]:
            try:
                lat, lng = _plastic_display_coords(
                    _f(h.latitude),
                    _f(h.longitude),
                    hotspot=h,
                    project=getattr(h, "project", None),
                )
                if lat is None or lng is None:
                    skipped += 1
                    continue
                out.append(
                    {
                        "layer": "plastic",
                        "id": f"plastic-hotspot-{h.id}",
                        "title": h.title
                        or getattr(h.project, "name", None)
                        or "Cleanup hotspot",
                        "subtitle": f"Hotspot · {h.status}",
                        "county": getattr(h.project, "region", "")
                        or getattr(h.project, "city", "")
                        or "",
                        "ward": h.location_label or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "status": h.status,
                            "project_id": h.project_id,
                            "hotspot_id": h.id,
                            "kind": "hotspot",
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip plastic hotspot %s: %s", h.id, exc)

        recovery_qs = PlasticRecovery.objects.select_related(
            "project", "hotspot"
        ).exclude(status="rejected")
        if county:
            recovery_qs = recovery_qs.filter(county_q)
        for r in recovery_qs.order_by("-created_at")[:300]:
            try:
                lat, lng = _plastic_display_coords(
                    _f(r.latitude),
                    _f(r.longitude),
                    hotspot=getattr(r, "hotspot", None),
                    project=getattr(r, "project", None),
                )
                if lat is None or lng is None:
                    skipped += 1
                    continue
                kg = _recovery_kg(r)
                out.append(
                    {
                        "layer": "plastic",
                        "id": f"plastic-bag-{r.id}",
                        "title": f"{kg} kg recovered",
                        "subtitle": f"{getattr(r, 'polymer_type', '') or 'plastic'} · {r.status}",
                        "county": getattr(getattr(r, "project", None), "region", "")
                        or getattr(getattr(r, "project", None), "city", "")
                        or "",
                        "ward": getattr(r, "location_label", "") or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "kg": kg,
                            "status": r.status,
                            "recovery_id": r.id,
                            "kind": "bag_proof",
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip plastic recovery %s: %s", r.id, exc)

        zone_qs = PlasticHoldingZone.objects.select_related("project").all()
        if county:
            zone_qs = zone_qs.filter(county_q)
        for z in zone_qs.order_by("-updated_at")[:200]:
            try:
                lat, lng = _plastic_display_coords(
                    _f(z.latitude),
                    _f(z.longitude),
                    project=getattr(z, "project", None),
                )
                if lat is None or lng is None:
                    if z.latitude is not None or z.longitude is not None:
                        skipped += 1
                    continue
                out.append(
                    {
                        "layer": "plastic",
                        "id": f"plastic-zone-{z.id}",
                        "title": z.name or "Holding zone",
                        "subtitle": "Holding zone",
                        "county": getattr(z.project, "region", "")
                        or getattr(z.project, "city", "")
                        or "",
                        "ward": getattr(z, "location_label", "") or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "status": "holding_zone",
                            "project_id": z.project_id,
                            "zone_id": z.id,
                            "kind": "holding_zone",
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip plastic holding zone %s: %s", z.id, exc)

        project_qs = PlasticProject.objects.filter(
            status__in=["active", "completed"]
        )
        if county:
            project_qs = project_qs.filter(
                Q(region__icontains=county) | Q(city__icontains=county)
            )
        for p in project_qs.order_by("-updated_at")[:200]:
            try:
                lat, lng = _plastic_display_coords(
                    _f(p.latitude),
                    _f(p.longitude),
                    project=p,
                )
                if lat is None or lng is None:
                    if p.latitude is not None or p.longitude is not None:
                        skipped += 1
                    continue
                out.append(
                    {
                        "layer": "plastic",
                        "id": f"plastic-project-{p.id}",
                        "title": p.name or f"Plastic project #{p.id}",
                        "subtitle": f"{float(p.recovered_kg or 0):.0f} kg recovered · project site",
                        "county": p.region or p.city or "",
                        "ward": p.city or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "status": p.status,
                            "project_id": p.id,
                            "kind": "project_site",
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip plastic project %s: %s", p.id, exc)

        return out, skipped

    def _hazard_features(self, county: str):
        """
        Active disasters (incl. default monitoring), official USGS/NASA pins,
        and recent crowd corroboration GPS when present.
        """
        out = []
        # Default Disaster.status is "monitoring" — include it or the layer stays empty.
        disaster_qs = (
            Disaster.objects.exclude(status="resolved")
            .exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
        )
        if county:
            disaster_qs = disaster_qs.filter(
                Q(region__icontains=county)
                | Q(city__icontains=county)
                | Q(country__icontains=county)
            )
        for d in disaster_qs.order_by("-created_at")[:400]:
            try:
                lat, lng = _f(d.latitude), _f(d.longitude)
                if lat is None or lng is None:
                    continue
                # Verification is tracked separately from the operational status.
                # A report can remain `unconfirmed` after an admin confirms it.
                status_label = "confirmed" if d.is_verified else d.status
                out.append(
                    {
                        "layer": "hazards",
                        "id": f"hazard-{d.id}",
                        "title": d.title,
                        "subtitle": f"{d.disaster_type} · {status_label}",
                        "county": d.region or d.country or "",
                        "ward": d.city or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "status": d.status,
                            "is_verified": bool(d.is_verified),
                            "verification_source": d.verification_source or "",
                            "disaster_type": d.disaster_type,
                            "severity": d.severity,
                            "disaster_id": d.id,
                            "kind": "disaster",
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip disaster %s: %s", d.id, exc)

        alert_qs = OfficialAlertEvent.objects.exclude(latitude__isnull=True).exclude(
            longitude__isnull=True
        )
        for ev in alert_qs.order_by("-created_at")[:300]:
            try:
                lat, lng = _f(ev.latitude), _f(ev.longitude)
                if lat is None or lng is None:
                    continue
                hay = f"{ev.title or ''} {ev.disaster_type or ''}".lower()
                if county and county.lower() not in hay:
                    # Official feeds rarely store county — skip when a county filter is active.
                    continue
                out.append(
                    {
                        "layer": "hazards",
                        "id": f"official-{ev.id}",
                        "title": ev.title or f"{ev.source} alert",
                        "subtitle": f"{ev.source} · {ev.disaster_type or 'hazard'}",
                        "county": "",
                        "ward": "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "status": "official",
                            "disaster_type": ev.disaster_type,
                            "severity": "",
                            "event_id": ev.event_id,
                            "kind": "official_alert",
                            "source": ev.source,
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip official alert %s: %s", ev.id, exc)

        crowd_qs = (
            CommunityHazardCorroboration.objects.select_related("disaster")
            .filter(decision="confirm")
            .exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
        )
        if county:
            crowd_qs = crowd_qs.filter(
                Q(disaster__region__icontains=county)
                | Q(disaster__city__icontains=county)
            )
        for c in crowd_qs.order_by("-created_at")[:200]:
            try:
                lat, lng = _f(c.latitude), _f(c.longitude)
                if lat is None or lng is None:
                    continue
                d = c.disaster
                out.append(
                    {
                        "layer": "hazards",
                        "id": f"crowd-{c.id}",
                        "title": (d.title if d else None) or "Crowd-confirmed hazard",
                        "subtitle": "Community corroboration",
                        "county": (d.region if d else "") or "",
                        "ward": (d.city if d else "") or "",
                        "latitude": lat,
                        "longitude": lng,
                        "meta": {
                            "status": "corroborated",
                            "disaster_id": c.disaster_id,
                            "kind": "corroboration",
                        },
                    }
                )
            except Exception as exc:
                logger.debug("skip corroboration %s: %s", c.id, exc)

        return out
