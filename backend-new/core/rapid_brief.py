"""AI RapidBrief — 30-minute mobilization brief for verified responders."""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

ORG_ACTIONS = {
    "fire": [
        "Confirm scene access routes and hydrant / water sources.",
        "Stage suppression assets outside the hazard perimeter.",
        "Coordinate with police on traffic and civilian exclusion.",
    ],
    "police": [
        "Secure perimeter and clear evacuation corridors.",
        "Establish incident command liaison with medical / fire.",
        "Verify reports before amplifying on public channels.",
    ],
    "medical": [
        "Stand up triage staging and ambulance surge capacity.",
        "Identify nearest receiving hospitals and bed status.",
        "Prepare mass-casualty kits for the reported hazard type.",
    ],
    "red_cross": [
        "Activate volunteer rapid-response roster for the zone.",
        "Pre-position shelter, water, and first-aid stocks.",
        "Open a family-reunification / tracing channel.",
    ],
    "county": [
        "Notify county emergency ops and open the EOC channel.",
        "Confirm evacuation centres and open status.",
        "Push localized public guidance via verified channels.",
    ],
    "government": [
        "Brief the duty officer and confirm jurisdiction ownership.",
        "Align with national / county emergency protocols.",
        "Authorize public messaging only after source verification.",
    ],
    "un": [
        "Map humanitarian partners already in the affected area.",
        "Assess protection / displacement needs from the report.",
        "Coordinate with national disaster authority before deployment.",
    ],
    "ngo": [
        "Confirm mandate fit (relief type) before mobilizing teams.",
        "Check access, security, and partner duplication.",
        "Prepare needs-assessment kit for the reported hazard.",
    ],
    "other": [
        "Verify the report against official and community sources.",
        "Contact the nearest specialized responder if outside mandate.",
        "Document actions and share status back on Climate Wavers.",
    ],
}


def _template_brief(org, event, distance_km=None):
    place = (
        event.get("place")
        or event.get("region")
        or event.get("city")
        or event.get("country")
        or "the reported area"
    )
    dtype = event.get("disaster_type") or event.get("disasterType") or "disaster"
    is_official = bool(event.get("is_official") or event.get("isOfficial"))
    confidence = (
        "Confirmed official feed"
        if is_official
        else "Community report — unconfirmed"
    )
    magnitude = event.get("magnitude")
    org_type = getattr(org, "org_type", None) or event.get("org_type") or "other"
    actions = ORG_ACTIONS.get(org_type, ORG_ACTIONS["other"])

    lines = [
        f"RapidBrief for {getattr(org, 'name', 'Responder')}",
        f"Confidence: {confidence}",
        f"Event: {dtype} near {place}.",
    ]
    if magnitude is not None and magnitude != "":
        lines.append(f"Reported magnitude: {magnitude}.")
    if distance_km is not None:
        lines.append(f"Distance from your coverage HQ: ~{float(distance_km):.1f} km.")
    lines.append(
        f"Match reason: {org_type.replace('_', ' ')} coverage"
        + (
            f" within {getattr(org, 'coverage_radius_km', 150)} km"
            if getattr(org, "coverage_radius_km", None)
            else ""
        )
        + "."
    )
    lines.append("First 30 minutes:")
    for i, step in enumerate(actions[:5], 1):
        lines.append(f"{i}. {step}")
    lines.append(
        "This is not a government emergency order. Follow local authorities."
    )
    return "\n".join(lines)


def generate_rapid_brief(org, event, distance_km=None):
    """
    Prefer response_system LLM brief; always fall back to structured template.
    """
    base = _template_brief(org, event, distance_km=distance_km)
    response_url = (getattr(settings, "RESPONSE_SYSTEM_URL", "") or "").rstrip("/")
    if not response_url:
        return base

    place = (
        event.get("place")
        or event.get("region")
        or event.get("city")
        or event.get("country")
        or "the reported area"
    )
    dtype = event.get("disaster_type") or event.get("disasterType") or "disaster"
    is_official = bool(event.get("is_official") or event.get("isOfficial"))
    org_type = getattr(org, "org_type", "other")
    org_name = getattr(org, "name", "Responder")

    prompt = (
        f"Write a concise 30-minute mobilization brief for {org_name} "
        f"({org_type.replace('_', ' ')}) responding to a "
        f"{'confirmed official' if is_official else 'unconfirmed community'} "
        f"{dtype} near {place}. "
        f"Include confidence, what/where, distance if known "
        f"({distance_km if distance_km is not None else 'unknown'} km), "
        f"and 3-5 first actions. No sensational language. "
        f"End with: not a government emergency order."
    )

    try:
        res = requests.post(
            f"{response_url}/api/v1/alerts/summary",
            json={
                "location": place,
                "disasterType": dtype,
                "isOfficial": is_official,
                "magnitude": event.get("magnitude"),
                "prompt": prompt,
                "audience": "responder",
                "orgType": org_type,
                "orgName": org_name,
                "distanceKm": distance_km,
            },
            timeout=12,
            headers={"Content-Type": "application/json"},
        )
        if res.ok:
            data = res.json() if res.content else {}
            text = (data.get("summary") or data.get("message") or data.get("brief") or "").strip()
            if text:
                disclaimer = (
                    "This is not a government emergency order. Follow local authorities."
                )
                if disclaimer.lower() not in text.lower():
                    text = f"{text}\n{disclaimer}"
                return text[:2500]
    except Exception as exc:
        logger.info("RapidBrief LLM unavailable: %s", exc)

    return base
