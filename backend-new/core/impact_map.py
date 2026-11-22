"""Public ward / county impact map: trees, plastic hotspots, verified hazards."""

from __future__ import annotations

from collections import defaultdict

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Disaster, PlasticHotspot, PlasticRecovery, TreeProjectDonation


class CommunityImpactMapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        county = (request.query_params.get("county") or "").strip()
        layer = (request.query_params.get("layer") or "all").strip().lower()

        features = []

        if layer in ("all", "trees"):
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
                from django.db.models import Q

                tree_qs = tree_qs.filter(
                    Q(project__region__icontains=county)
                    | Q(project__city__icontains=county)
                )
            for d in tree_qs.order_by("-planted_at")[:500]:
                lat = d.survival_lat
                lng = d.survival_lng
                if lat is None or lng is None:
                    proof = (
                        d.planting_updates.exclude(latitude__isnull=True)
                        .order_by("-created_at")
                        .first()
                    )
                    if not proof:
                        proj = d.project
                        if proj.latitude is None or proj.longitude is None:
                            continue
                        lat, lng = proj.latitude, proj.longitude
                    else:
                        lat, lng = proof.latitude, proof.longitude
                features.append(
                    {
                        "layer": "trees",
                        "id": f"tree-{d.id}",
                        "title": d.project.name,
                        "subtitle": f"{d.trees_purchased} tree(s) · {d.planting_status}",
                        "county": d.project.region or d.project.city or "",
                        "ward": d.survival_location_label or "",
                        "latitude": float(lat),
                        "longitude": float(lng),
                        "meta": {
                            "trees": d.trees_purchased,
                            "status": d.planting_status,
                            "donation_id": d.id,
                            "project_id": d.project_id,
                        },
                    }
                )

        if layer in ("all", "plastic"):
            hotspot_qs = PlasticHotspot.objects.select_related("project").all()
            if county:
                from django.db.models import Q

                hotspot_qs = hotspot_qs.filter(
                    Q(project__region__icontains=county)
                    | Q(project__city__icontains=county)
                )
            for h in hotspot_qs.order_by("-created_at")[:400]:
                if h.latitude is None or h.longitude is None:
                    continue
                features.append(
                    {
                        "layer": "plastic",
                        "id": f"plastic-hotspot-{h.id}",
                        "title": h.title
                        or getattr(h.project, "name", "Cleanup hotspot"),
                        "subtitle": f"Status: {h.status}",
                        "county": getattr(h.project, "region", "")
                        or getattr(h.project, "city", "")
                        or "",
                        "ward": h.location_label or "",
                        "latitude": float(h.latitude),
                        "longitude": float(h.longitude),
                        "meta": {
                            "status": h.status,
                            "project_id": h.project_id,
                            "hotspot_id": h.id,
                        },
                    }
                )
            recovery_qs = PlasticRecovery.objects.select_related("project").exclude(
                latitude__isnull=True
            )
            for r in recovery_qs.order_by("-created_at")[:300]:
                features.append(
                    {
                        "layer": "plastic",
                        "id": f"plastic-bag-{r.id}",
                        "title": f"{r.kg or 0} kg recovered",
                        "subtitle": getattr(r, "polymer_type", "") or "plastic",
                        "county": getattr(getattr(r, "project", None), "region", "")
                        or getattr(getattr(r, "project", None), "city", "")
                        or "",
                        "ward": "",
                        "latitude": float(r.latitude),
                        "longitude": float(r.longitude),
                        "meta": {
                            "kg": float(r.kg or 0),
                            "status": r.status,
                            "recovery_id": r.id,
                        },
                    }
                )

        if layer in ("all", "hazards"):
            disaster_qs = Disaster.objects.filter(
                status__in=["alert", "warning", "ongoing", "investigating"]
            ).exclude(latitude__isnull=True)
            if county:
                from django.db.models import Q

                disaster_qs = disaster_qs.filter(
                    Q(region__icontains=county) | Q(city__icontains=county)
                )
            for d in disaster_qs.order_by("-created_at")[:400]:
                features.append(
                    {
                        "layer": "hazards",
                        "id": f"hazard-{d.id}",
                        "title": d.title,
                        "subtitle": f"{d.disaster_type} · {d.status}",
                        "county": d.region or "",
                        "ward": d.city or "",
                        "latitude": float(d.latitude),
                        "longitude": float(d.longitude),
                        "meta": {
                            "status": d.status,
                            "disaster_type": d.disaster_type,
                            "severity": d.severity,
                            "disaster_id": d.id,
                        },
                    }
                )

        # County rollups for choropleth-style chips
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

        return Response(
            {
                "features": features,
                "count": len(features),
                "counties": sorted(
                    counties.values(),
                    key=lambda c: c["trees"] + c["plastic_points"] + c["hazards"],
                    reverse=True,
                )[:40],
            }
        )
