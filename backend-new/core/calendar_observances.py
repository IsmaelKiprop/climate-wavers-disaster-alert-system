"""International / government climate calendar observances."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time, timezone as dt_timezone

from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import CalendarObservance

# Curated UN / international + African Union / government environment days.
# Recur every year on month-day. Synced via sync_calendar_observances.
OBSERVANCE_CATALOG = [
    {
        "slug": "world-wetlands-day",
        "title": "World Wetlands Day",
        "month": 2,
        "day": 2,
        "category": "international",
        "authority": "United Nations / Ramsar",
        "description": "Raise awareness of wetlands for people and planet.",
        "source_url": "https://www.worldwetlandsday.org/",
    },
    {
        "slug": "world-wildlife-day",
        "title": "World Wildlife Day",
        "month": 3,
        "day": 3,
        "category": "international",
        "authority": "United Nations",
        "description": "Celebrate wild animals and plants and their contribution to livelihoods.",
        "source_url": "https://www.wildlifeday.org/",
    },
    {
        "slug": "africa-environment-day",
        "title": "Africa Environment Day / Wangari Maathai Day",
        "month": 3,
        "day": 3,
        "category": "regional",
        "authority": "African Union",
        "description": "AU day for environmental action across Africa, honouring Wangari Maathai.",
        "source_url": "https://au.int/",
    },
    {
        "slug": "international-day-of-forests",
        "title": "International Day of Forests",
        "month": 3,
        "day": 21,
        "category": "international",
        "authority": "United Nations",
        "description": "Celebrate and raise awareness of the importance of all types of forests.",
        "source_url": "https://www.un.org/en/observances/forests-and-trees-day",
    },
    {
        "slug": "world-water-day",
        "title": "World Water Day",
        "month": 3,
        "day": 22,
        "category": "international",
        "authority": "United Nations",
        "description": "Focus on the importance of freshwater and sustainable water management.",
        "source_url": "https://www.un.org/en/observances/water-day",
    },
    {
        "slug": "world-meteorological-day",
        "title": "World Meteorological Day",
        "month": 3,
        "day": 23,
        "category": "international",
        "authority": "WMO / United Nations",
        "description": "Highlight the role of weather, climate and water services.",
        "source_url": "https://wmo.int/world-meteorological-day",
    },
    {
        "slug": "earth-day",
        "title": "Earth Day",
        "month": 4,
        "day": 22,
        "category": "international",
        "authority": "EarthDay.org / global",
        "description": "Global day of action for environmental protection and climate.",
        "source_url": "https://www.earthday.org/",
    },
    {
        "slug": "international-day-for-biological-diversity",
        "title": "International Day for Biological Diversity",
        "month": 5,
        "day": 22,
        "category": "international",
        "authority": "United Nations / CBD",
        "description": "Promote biodiversity and its sustainable use.",
        "source_url": "https://www.cbd.int/biodiversity-day",
    },
    {
        "slug": "world-environment-day",
        "title": "World Environment Day",
        "month": 6,
        "day": 5,
        "category": "international",
        "authority": "United Nations / UNEP",
        "description": "UN's principal vehicle for encouraging worldwide awareness and action for the environment.",
        "source_url": "https://www.worldenvironmentday.global/",
    },
    {
        "slug": "world-oceans-day",
        "title": "World Oceans Day",
        "month": 6,
        "day": 8,
        "category": "international",
        "authority": "United Nations",
        "description": "Celebrate the ocean and support sustainable management of marine resources.",
        "source_url": "https://www.un.org/en/observances/oceans-day",
    },
    {
        "slug": "world-day-combat-desertification",
        "title": "World Day to Combat Desertification and Drought",
        "month": 6,
        "day": 17,
        "category": "international",
        "authority": "United Nations / UNCCD",
        "description": "Promote solutions to desertification and drought.",
        "source_url": "https://www.unccd.int/events/world-day-combat-desertification",
    },
    {
        "slug": "international-day-clean-air",
        "title": "International Day of Clean Air for Blue Skies",
        "month": 9,
        "day": 7,
        "category": "international",
        "authority": "United Nations",
        "description": "Raise awareness and promote action for clean air.",
        "source_url": "https://www.un.org/en/observances/clean-air-day",
    },
    {
        "slug": "ozone-layer-day",
        "title": "International Day for the Preservation of the Ozone Layer",
        "month": 9,
        "day": 16,
        "category": "international",
        "authority": "United Nations",
        "description": "Commemorate the Montreal Protocol and ozone protection.",
        "source_url": "https://www.un.org/en/observances/ozone-day",
    },
    {
        "slug": "international-day-disaster-risk-reduction",
        "title": "International Day for Disaster Risk Reduction",
        "month": 10,
        "day": 13,
        "category": "international",
        "authority": "United Nations / UNDRR",
        "description": "Promote a global culture of disaster risk reduction.",
        "source_url": "https://www.undrr.org/idrdr",
    },
    {
        "slug": "world-food-day",
        "title": "World Food Day",
        "month": 10,
        "day": 16,
        "category": "international",
        "authority": "FAO / United Nations",
        "description": "Action for food security and resilient food systems amid climate change.",
        "source_url": "https://www.fao.org/world-food-day",
    },
    {
        "slug": "world-soil-day",
        "title": "World Soil Day",
        "month": 12,
        "day": 5,
        "category": "international",
        "authority": "FAO / United Nations",
        "description": "Focus attention on the importance of healthy soil.",
        "source_url": "https://www.fao.org/world-soil-day",
    },
    {
        "slug": "international-mountain-day",
        "title": "International Mountain Day",
        "month": 12,
        "day": 11,
        "category": "international",
        "authority": "United Nations",
        "description": "Highlight the importance of sustainable mountain development.",
        "source_url": "https://www.un.org/en/observances/mountain-day",
    },
    # Government / national climate & tree days (Africa focus)
    {
        "slug": "kenya-national-tree-growing-day",
        "title": "Kenya National Tree Growing Day",
        "month": 11,
        "day": 13,
        "category": "government",
        "authority": "Republic of Kenya",
        "description": "National tree growing mobilisation supporting Kenya's 15 billion trees goal.",
        "source_url": "https://www.environment.go.ke/",
    },
    {
        "slug": "kenya-environment-day",
        "title": "Kenya National Environment Day",
        "month": 6,
        "day": 5,
        "category": "government",
        "authority": "Republic of Kenya",
        "description": "National observance aligned with World Environment Day for local climate action.",
        "source_url": "https://www.environment.go.ke/",
    },
    {
        "slug": "sa-national-arbor-week-start",
        "title": "South Africa National Arbor Week (start)",
        "month": 9,
        "day": 1,
        "category": "government",
        "authority": "Republic of South Africa",
        "description": "Start of National Arbor Week — plant and protect trees across South Africa.",
        "source_url": "https://www.dffe.gov.za/",
    },
    {
        "slug": "ghana-green-ghana-day",
        "title": "Green Ghana Day",
        "month": 6,
        "day": 7,
        "category": "government",
        "authority": "Republic of Ghana",
        "description": "Nationwide tree planting day under Ghana's Green Ghana initiative.",
        "source_url": "https://www.fcghana.org/",
    },
    {
        "slug": "nigeria-national-tree-planting-day",
        "title": "Nigeria National Tree Planting Day",
        "month": 7,
        "day": 14,
        "category": "government",
        "authority": "Federal Republic of Nigeria",
        "description": "National day promoting afforestation and environmental restoration.",
        "source_url": "https://environment.gov.ng/",
    },
    {
        "slug": "uganda-world-environment-alignment",
        "title": "Uganda National Environment Action Day",
        "month": 6,
        "day": 5,
        "category": "government",
        "authority": "Republic of Uganda",
        "description": "National environment mobilisation aligned with World Environment Day.",
        "source_url": "https://www.nema.go.ug/",
    },
    {
        "slug": "tanzania-uhuru-torch-environment",
        "title": "Tanzania National Tree Planting Campaign Day",
        "month": 4,
        "day": 1,
        "category": "government",
        "authority": "United Republic of Tanzania",
        "description": "National tree planting push for forest cover and climate resilience.",
        "source_url": "https://www.maliasili.go.tz/",
    },
]


def sync_observance_catalog() -> dict:
    created = 0
    updated = 0
    for item in OBSERVANCE_CATALOG:
        obj, was_created = CalendarObservance.objects.update_or_create(
            slug=item["slug"],
            defaults={
                "title": item["title"],
                "description": item.get("description") or "",
                "month": item["month"],
                "day": item["day"],
                "category": item.get("category") or "international",
                "authority": item.get("authority") or "",
                "source_url": item.get("source_url") or "",
                "is_active": True,
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1
    return {"created": created, "updated": updated, "total": CalendarObservance.objects.count()}


def occurrence_for(obs: CalendarObservance, year: int) -> date | None:
    last_day = monthrange(year, obs.month)[1]
    day = min(obs.day, last_day)
    try:
        return date(year, obs.month, day)
    except ValueError:
        return None


def observances_for_range(start: date, end: date):
    """Expand active observances into concrete dates within [start, end]."""
    if end < start:
        return []
    years = range(start.year, end.year + 1)
    qs = CalendarObservance.objects.filter(is_active=True)
    rows = []
    for obs in qs:
        for year in years:
            occurs = occurrence_for(obs, year)
            if occurs and start <= occurs <= end:
                rows.append((occurs, obs))
    rows.sort(key=lambda item: (item[0], item[1].title))
    return rows


class CalendarObservanceSerializer(serializers.ModelSerializer):
    occurs_on = serializers.SerializerMethodField()
    kind = serializers.SerializerMethodField()

    class Meta:
        model = CalendarObservance
        fields = (
            "id",
            "slug",
            "title",
            "description",
            "month",
            "day",
            "category",
            "authority",
            "source_url",
            "is_active",
            "occurs_on",
            "kind",
        )

    def get_occurs_on(self, obj):
        return self.context.get("occurs_on")

    def get_kind(self, obj):
        return "observance"


class CalendarObservanceViewSet(viewsets.ReadOnlyModelViewSet):
    """Public calendar of international & government environment days."""

    permission_classes = [IsAuthenticatedOrReadOnly]
    serializer_class = CalendarObservanceSerializer
    queryset = CalendarObservance.objects.filter(is_active=True)
    lookup_field = "slug"

    def list(self, request, *args, **kwargs):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        from_param = request.query_params.get("from")
        to_param = request.query_params.get("to")

        today = timezone.now().date()
        if from_param and to_param:
            try:
                start = date.fromisoformat(from_param[:10])
                end = date.fromisoformat(to_param[:10])
            except ValueError:
                return Response(
                    {"detail": "from/to must be YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif year and month:
            try:
                y, m = int(year), int(month)
                start = date(y, m, 1)
                end = date(y, m, monthrange(y, m)[1])
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Invalid year/month"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif year:
            try:
                y = int(year)
                start = date(y, 1, 1)
                end = date(y, 12, 31)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Invalid year"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # Default: current month ± buffer for calendar UI
            start = date(today.year, today.month, 1)
            end_month = today.month
            end_year = today.year
            if end_month == 12:
                end = date(end_year, 12, 31)
            else:
                end = date(end_year, end_month, monthrange(end_year, end_month)[1])
            # expand to full year for richer calendar
            start = date(today.year, 1, 1)
            end = date(today.year + 1, 12, 31)

        category = (request.query_params.get("category") or "").strip()
        rows = observances_for_range(start, end)
        if category:
            rows = [r for r in rows if r[1].category == category]

        payload = []
        for occurs, obs in rows:
            data = CalendarObservanceSerializer(
                obs, context={"occurs_on": occurs.isoformat(), "request": request}
            ).data
            # Fake event-shaped fields so the calendar can merge cleanly
            noon = datetime.combine(occurs, time(12, 0), tzinfo=dt_timezone.utc)
            data["starts_at"] = noon.isoformat().replace("+00:00", "Z")
            data["event_type"] = "observance"
            data["status"] = "scheduled"
            data["visibility"] = "public"
            data["host_name"] = obs.authority or "Official observance"
            data["allow_tree_gifts"] = True
            data["trees_gifted"] = 0
            data["gift_count"] = 0
            data["can_join"] = False
            data["jitsi_room"] = None
            data["is_observance"] = True
            payload.append(data)
        return Response(payload)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def sync(self, request):
        """Idempotent catalog sync (safe to call from deploy / cron)."""
        # Allow unauthenticated on Render cron; no secrets required for curated list.
        result = sync_observance_catalog()
        return Response({"ok": True, **result})
