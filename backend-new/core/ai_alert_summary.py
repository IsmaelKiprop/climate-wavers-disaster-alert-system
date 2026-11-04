"""AI short summary for official / community disaster alerts."""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def generate_alert_summary(event):
    """
    Ask response_system AI when available; otherwise return a calm template summary.
    """
    place = (
        event.get("region")
        or event.get("city")
        or event.get("country")
        or "the reported area"
    )
    dtype = event.get("disaster_type") or event.get("disasterType") or "disaster"
    is_official = bool(event.get("is_official") or event.get("isOfficial"))
    source = event.get("official_source") or event.get("source") or ""
    magnitude = event.get("magnitude")

    base = (
        f"{'Official feed' if is_official else 'Community report'}: "
        f"{dtype} near {place}."
    )
    if magnitude is not None:
        base = f"{base} Reported magnitude {magnitude}."
    base = (
        f"{base} Stay informed via local authorities. "
        "This is not a government emergency warning."
    )

    response_url = (
        getattr(settings, "RESPONSE_SYSTEM_URL", "") or ""
    ).rstrip("/")
    if not response_url:
        return base

    try:
        prompt_location = place
        prompt_type = dtype
        if source:
            prompt_type = f"{dtype} (source: {source})"
        # Soft call into response service chat helper if exposed; otherwise template.
        # response_system may not have a dedicated HTTP summary route — keep resilient.
        res = requests.post(
            f"{response_url}/api/v1/alerts/summary",
            json={
                "location": prompt_location,
                "disasterType": prompt_type,
                "isOfficial": is_official,
                "magnitude": magnitude,
            },
            timeout=12,
            headers={"Content-Type": "application/json"},
        )
        if res.ok:
            data = res.json() if res.content else {}
            text = (data.get("summary") or data.get("message") or "").strip()
            if text:
                return text[:600]
    except Exception as exc:
        logger.info("AI alert summary unavailable: %s", exc)

    return base
