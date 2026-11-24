"""
Discover *publicly listed* nearby webcams / traffic cams.

Sources: OpenStreetMap (Overpass) — tourism=webcam and similar tags with public URLs.
This does NOT access private partner NVR/RTSP or unauthorized CCTV networks.
"""

from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

import requests

from .champions import haversine_km

logger = logging.getLogger(__name__)

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Soft cap so Verify desk stays usable on low bandwidth
MAX_PUBLIC = 20
DEFAULT_RADIUS_M = 15000


def _safe_http_url(value: str) -> str:
    url = (value or "").strip()
    if not url:
        return ""
    if url.startswith("//"):
        url = "https:" + url
    if not re.match(r"^https?://", url, re.I):
        return ""
    # Block obvious credentialed / local targets
    if "@" in url.split("://", 1)[-1].split("/", 1)[0]:
        return ""
    host = url.split("://", 1)[-1].split("/", 1)[0].lower()
    if host.startswith("192.168.") or host.startswith("10.") or host.endswith(".local"):
        return ""
    return url[:1000]


def _tags_stream(tags: dict) -> tuple[str, str]:
    """Return (stream_type, url) from OSM tags."""
    candidates = [
        tags.get("url"),
        tags.get("website"),
        tags.get("contact:webcam"),
        tags.get("image"),
        tags.get("webcam"),
        tags.get("webcam:url"),
        tags.get("camera:url"),
    ]
    for raw in candidates:
        url = _safe_http_url(str(raw or ""))
        if not url:
            continue
        lower = url.lower()
        if ".m3u8" in lower:
            return "hls", url
        if any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp")):
            return "mjpeg", url
        if "youtube.com" in lower or "youtu.be" in lower:
            return "hls", url
        return "mjpeg", url
    return "", ""


def _public_id(osm_type: str, osm_id: int) -> str:
    return f"public-osm-{osm_type}-{osm_id}"


def fetch_public_webcams(
    lat: float,
    lng: float,
    *,
    radius_m: int = DEFAULT_RADIUS_M,
    timeout: float = 12.0,
    raise_on_error: bool = False,
) -> list[dict[str, Any]]:
    radius_m = max(500, min(int(radius_m or DEFAULT_RADIUS_M), 50000))
    query = f"""
    [out:json][timeout:20];
    (
      node["tourism"="webcam"](around:{radius_m},{lat},{lng});
      node["man_made"="surveillance"]["camera:type"~"webcam|fixed",i](around:{radius_m},{lat},{lng});
      node["webcam"](around:{radius_m},{lat},{lng});
      node["camera:type"="webcam"](around:{radius_m},{lat},{lng});
    );
    out body;
    """
    payload = None
    last_err = None
    for endpoint in OVERPASS_URLS:
        try:
            res = requests.post(
                endpoint,
                data={"data": query},
                timeout=timeout,
                headers={"User-Agent": "ClimateWaversChampions/1.0 (verify desk)"},
            )
            if res.status_code >= 400:
                last_err = f"{endpoint} HTTP {res.status_code}"
                continue
            payload = res.json()
            break
        except Exception as exc:
            last_err = str(exc)
            continue
    if payload is None:
        logger.warning("Public CCTV Overpass failed: %s", last_err)
        if raise_on_error:
            raise requests.RequestException(last_err or "Public webcam lookup failed")
        return []

    results = []
    for el in payload.get("elements") or []:
        if el.get("type") != "node":
            continue
        tags = el.get("tags") or {}
        osm_id = el.get("id")
        ela = el.get("lat")
        elo = el.get("lon")
        if osm_id is None or ela is None or elo is None:
            continue
        stream_type, stream_url = _tags_stream(tags)
        # Keep cams even without URL so champions know a public cam exists nearby
        name = (
            tags.get("name")
            or tags.get("description")
            or tags.get("operator")
            or f"Public webcam {osm_id}"
        )
        dist = haversine_km(lat, lng, ela, elo)
        results.append(
            {
                "id": _public_id("node", int(osm_id)),
                "public": True,
                "source": "openstreetmap",
                "osm_id": int(osm_id),
                "name": str(name)[:200],
                "latitude": float(ela),
                "longitude": float(elo),
                "coverage_radius_m": 150,
                "stream_type": stream_type or "mjpeg",
                "status": "active" if stream_url else "offline",
                "distance_km": round(dist, 2),
                "has_stream": bool(stream_url),
                "preview_url": stream_url,
                "stream_url": stream_url,
                "note": "Publicly listed OpenStreetMap webcam — not a private partner feed",
            }
        )

    results.sort(key=lambda x: (not x["has_stream"], x["distance_km"]))
    return results[:MAX_PUBLIC]


def capture_public_snapshot(url: str) -> dict[str, Any]:
    """
    Fetch a public still (or first bytes of a feed URL) for evidence attachment.
    Returns metadata; does not store binary on disk in v1 — stores source URL + fingerprint.
    """
    safe = _safe_http_url(url)
    if not safe:
        return {"ok": False, "detail": "Invalid or blocked URL"}
    try:
        res = requests.get(
            safe,
            timeout=15,
            stream=True,
            headers={"User-Agent": "ClimateWaversChampions/1.0"},
        )
        if res.status_code >= 400:
            return {"ok": False, "detail": f"Upstream HTTP {res.status_code}"}
        # Read a small chunk to prove reachability without downloading huge videos
        chunk = next(res.iter_content(chunk_size=64 * 1024), b"")
        digest = hashlib.sha256(chunk or safe.encode()).hexdigest()[:16]
        content_type = (res.headers.get("Content-Type") or "")[:80]
        return {
            "ok": True,
            "url": safe,
            "content_type": content_type,
            "fingerprint": digest,
            "bytes_sampled": len(chunk or b""),
        }
    except Exception as exc:
        return {"ok": False, "detail": str(exc)[:200]}
