"""Public ward / county impact map: trees, plastic hotspots, verified hazards."""

from __future__ import annotations

import logging
from collections import defaultdict

from django.db.models import Q
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Disaster, PlasticHotspot, PlasticRecovery, TreeProjectDonation

logger = logging.getLogger(__name__)


def _f(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


class CommunityImpactMapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        county = (request.query_params.get("county") or "").strip()
        layer = (request.query_params.get("layer") or "all").strip().lower()

        features = []
        errors = []

        if layer in ("all", "trees"):
            try:
                features.extend(self._tree_features(county))
            except Exception as exc:
                logger.exception("impact-map trees layer failed: %s", exc)
                errors.append({"layer": "trees", "detail": str(exc)[:200]})

        if layer in ("all", "plastic"):
            try:
                features.extend(self._plastic_features(county))
            except Exception as exc:
                logger.exception("impact-map plastic layer failed: %s", exc)
                errors.append({"layer": "plastic", "detail": str(exc)[:200]})

        if layer in ("all", "hazards"):
            try:
                features.extend(self._hazard_features(county))
            except Exception as exc:
                logger.exception("impact-map hazards layer failed: %s", exc)
                errors.append({"layer": "hazards", "detail": str(exc)[:200]})

        counties = defaultdict(
            lambda: {"trees": 0, "plastic_points": 0, "hazards": 0, "county": ""}
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

        payload = {
            "features": features,
            "count": len(features),
            "counties": sorted(
                counties.values(),
                key=lambda c: c["trees"] + c["plastic_points"] + c["hazards"],
                reverse=True,
            )[:40],
        }
        if errors:
            payload["errors"] = errors
        return Response(payload)

    def _tree_features(self, county: str):
        out = []
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
                if lat is None or lng is None:
                    continue
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
        return out

    def _plastic_features(self, county: str):
        out = []
        hotspot_qs = PlasticHotspot.objects.select_related("project").all()
        if county:
            hotspot_qs = hotspot_qs.filter(
                Q(project__region__icontains=county)
                | Q(project__city__icontains=county)
            )
        for h in hotspot_qs.order_by("-created_at")[:400]:
            lat, lng = _f(h.latitude), _f(h.longitude)
            if lat is None or lng is None:
                continue
            out.append(
                {
                    "layer": "plastic",
                    "id": f"plastic-hotspot-{h.id}",
                    "title": h.title
                    or getattr(h.project, "name", None)
                    or "Cleanup hotspot",
                    "subtitle": f"Status: {h.status}",
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
                    },
                }
            )

        recovery_qs = (
            PlasticRecovery.objects.select_related("project")
            .exclude(latitude__isnull=True)
            .exclude(longitude__isnull=True)
        )
        for r in recovery_qs.order_by("-created_at")[:300]:
            lat, lng = _f(r.latitude), _f(r.longitude)
            if lat is None or lng is None:
                continue
            out.append(
                {
                    "layer": "plastic",
                    "id": f"plastic-bag-{r.id}",
                    "title": f"{r.kg or 0} kg recovered",
                    "subtitle": getattr(r, "polymer_type", "") or "plastic",
                    "county": getattr(getattr(r, "project", None), "region", "")
                    or getattr(getattr(r, "project", None), "city", "")
                    or "",
                    "ward": "",
                    "latitude": lat,
                    "longitude": lng,
                    "meta": {
                        "kg": float(r.kg or 0),
                        "status": r.status,
                        "recovery_id": r.id,
                    },
                }
            )
        return out

    def _hazard_features(self, county: str):
        out = []
        disaster_qs = Disaster.objects.filter(
            status__in=["alert", "warning", "ongoing", "investigating"]
        ).exclude(latitude__isnull=True)
        if county:
            disaster_qs = disaster_qs.filter(
                Q(region__icontains=county) | Q(city__icontains=county)
            )
        for d in disaster_qs.order_by("-created_at")[:400]:
            lat, lng = _f(d.latitude), _f(d.longitude)
            if lat is None or lng is None:
                continue
            out.append(
                {
                    "layer": "hazards",
                    "id": f"hazard-{d.id}",
                    "title": d.title,
                    "subtitle": f"{d.disaster_type} · {d.status}",
                    "county": d.region or "",
                    "ward": d.city or "",
                    "latitude": lat,
                    "longitude": lng,
                    "meta": {
                        "status": d.status,
                        "disaster_type": d.disaster_type,
                        "severity": d.severity,
                        "disaster_id": d.id,
                    },
                }
            )
        return out
