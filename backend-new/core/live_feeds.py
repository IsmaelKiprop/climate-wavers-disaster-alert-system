"""Shared USGS + NASA EONET live event fetch for map API and alert poller."""

from datetime import datetime

import requests
from django.core.cache import cache

USGS_URL = (
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
)
EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=80"
LIVE_CACHE_KEY = "cw_live_official_events_v1"
LIVE_CACHE_TTL = 90  # seconds — avoids re-fetch storms that OOM free Render


def fetch_live_official_events(timeout=20):
    cached = cache.get(LIVE_CACHE_KEY)
    if cached is not None:
        return cached
    events = []
    events.extend(_fetch_usgs(timeout))
    events.extend(_fetch_eonet(timeout))
    cache.set(LIVE_CACHE_KEY, events, LIVE_CACHE_TTL)
    return events


def _fetch_usgs(timeout):
    events = []
    try:
        response = requests.get(USGS_URL, timeout=timeout)
        if not response.ok:
            return events
        for feature in response.json().get("features", []):
            props = feature.get("properties") or {}
            coords = (feature.get("geometry") or {}).get("coordinates") or []
            mag = props.get("mag") or 0
            event_id = feature.get("id") or ""
            place = (props.get("place") or "").strip()
            place_parts = [part.strip() for part in place.split(",") if part.strip()]
            # Prefer human event page; USGS "detail" is raw GeoJSON.
            human_url = (props.get("url") or "").strip()
            if human_url.endswith(".geojson"):
                human_url = ""
            source_url = (
                human_url
                or (
                    f"https://earthquake.usgs.gov/earthquakes/eventpage/{event_id}"
                    if event_id
                    else ""
                )
            )
            events.append(
                {
                    "id": event_id,
                    "title": props.get("title") or "Earthquake",
                    "disaster_type": "earthquake",
                    "severity": (
                        "catastrophic"
                        if mag >= 7
                        else "high"
                        if mag >= 6
                        else "moderate"
                    ),
                    "status": "ongoing",
                    "country": place_parts[-1] if place_parts else "",
                    # Keep place once; avoid city+region+country duplication in UI.
                    "region": place,
                    "city": "",
                    "latitude": coords[1] if len(coords) > 1 else None,
                    "longitude": coords[0] if coords else None,
                    "description": props.get("title"),
                    "magnitude": mag,
                    "start_date": (
                        datetime.utcfromtimestamp(
                            (props.get("time") or 0) / 1000
                        ).isoformat()
                        if props.get("time")
                        else None
                    ),
                    "official_source": "USGS",
                    "source_url": source_url,
                    "is_official": True,
                }
            )
    except Exception:
        pass
    return events


def _fetch_eonet(timeout):
    events = []
    try:
        response = requests.get(EONET_URL, timeout=timeout)
        if not response.ok:
            return events
        for item in response.json().get("events", []):
            geos = item.get("geometry") or []
            geo = geos[-1] if geos else {}
            coords = geo.get("coordinates") or []
            lng = lat = None
            if geo.get("type") == "Point" and len(coords) >= 2:
                lng, lat = coords[0], coords[1]
            category = ((item.get("categories") or [{}])[0]).get("id") or "other"
            event_id = item.get("id") or ""
            events.append(
                {
                    "id": event_id,
                    "title": item.get("title") or category,
                    "disaster_type": category,
                    "severity": "high",
                    "status": "ongoing",
                    "region": item.get("title") or "",
                    "city": "",
                    "country": "",
                    "latitude": lat,
                    "longitude": lng,
                    "description": item.get("description") or item.get("title"),
                    "magnitude": None,
                    "start_date": geo.get("date"),
                    "official_source": "NASA EONET",
                    "source_url": f"https://eonet.gsfc.nasa.gov/api/v3/events/{event_id}",
                    "is_official": True,
                }
            )
    except Exception:
        pass
    return events


def passes_severity_gate(event, min_magnitude=4.5):
    dtype = (event.get("disaster_type") or "").lower()
    if dtype == "earthquake":
        try:
            return float(event.get("magnitude") or 0) >= float(min_magnitude)
        except (TypeError, ValueError):
            return False
    # NASA categories worth alerting
    interesting = {
        "wildfires",
        "severeStorms",
        "floods",
        "volcanoes",
        "landslides",
        "earthquakes",
        "dustHaze",
        "tempExtremes",
    }
    return dtype in interesting or dtype.replace(" ", "") in {
        x.lower() for x in interesting
    }
