"""
WaverX public voice for X (Twitter).

Creative, verified, calm — never rumor. Alert tweets cite official sources.
Climate tips rotate so the feed feels unique and inspiring, not corporate.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone as dt_timezone

TWEET_SOFT_LIMIT = 270

ALERT_OPENERS = [
    "Signal verified. Wave noted.",
    "WaverX checked the source. Sharing with care.",
    "Official feed → community awareness.",
    "Verified pulse from the planet:",
    "We only amplify what we can source.",
    "A clear signal, not a rumor:",
    "Ground-truth first. Then the wave.",
]

ALERT_CLOSERS = [
    "Follow local authorities. This is not a government emergency warning.",
    "Stay calm, stay informed, trust official guidance first.",
    "Use local emergency channels for decisions. We share context, not commands.",
    "Verify locally. Act with care. #ClimateWavers",
]

TIP_BANK = [
    # Nature metaphors + action
    "Rivers remember every root that holds their banks. Plant one tree this week — a quiet vote for tomorrow’s shade. #ClimateWavers",
    "A single reusable bottle is a tiny rebellion against throwaway culture. Carry yours like a badge of future. #ClimateWavers",
    "Open a window before you open the AC. Sometimes the breeze is the first climate solution. #ClimateWavers",
    "Food waste is a silent emission. Tonight: cook what you have, share what you can’t finish. #ClimateWavers",
    "Walk one errand you’d usually drive. Your lungs, your street, and the sky all notice. #ClimateWavers",
    "Switch one light to LED. Small wattage, long echo. #ClimateWavers",
    "Talk climate without doom. Curiosity grows action faster than fear. #ClimateWavers",
    "Gift a tree in someone’s name. Love that outlives a birthday cake. #ClimateWavers",
    "Unplug chargers at night. Ghost power is real — and avoidable. #ClimateWavers",
    "Choose one meal plant-forward this week. The plate can be a climate tool. #ClimateWavers",
    "Repair before replace. A stitch today is less landfill tomorrow. #ClimateWavers",
    "Follow a local river or wetland update. Knowing your watershed is belonging. #ClimateWavers",
    "Shade is infrastructure. Support trees on your street like you support Wi‑Fi. #ClimateWavers",
    "Carry a cloth bag like you carry your keys — until it’s muscle memory. #ClimateWavers",
    "Ask your workplace one climate question this month. Culture shifts start awkward and end normal. #ClimateWavers",
    "Clean air is a human right with local habits. Sweep less dust into the wind; plant more barriers. #ClimateWavers",
    "Rainwater is a gift. If you can catch a little, you’re already adapting. #ClimateWavers",
    "Biodiversity starts in a balcony pot. One native plant invites a whole food web. #ClimateWavers",
    "Skip one impulse package this week. The carbon of ‘next day’ rarely matches the joy. #ClimateWavers",
    "Share a verified alert, never a rumor. Clarity is climate care too. #ClimateWavers",
    "Compost peels into soil stories. Waste becomes welcome. #ClimateWavers",
    "Cool your home with curtains at noon. Ancient tech. Still brilliant. #ClimateWavers",
    "Support a community tree project. Forests grow faster with friends. #ClimateWavers",
    "Listen to elders on weather lore — then check the official forecast. Wisdom + science. #ClimateWavers",
    "Your commute can be a climate habit: transit, bike, or carpool once this week. #ClimateWavers",
    "Turn climate anxiety into climate company. Join a group. Hope is a team sport. #ClimateWavers",
    "Leave leaves where they can shelter insects. Winter quiet is future spring. #ClimateWavers",
    "Buy secondhand once before buying new. History has style and a smaller footprint. #ClimateWavers",
    "Protect mangroves and wetlands in conversation — they are living seawalls. #ClimateWavers",
    "Drink tap when it’s safe. Bottled water often travels farther than you do. #ClimateWavers",
    "Teach a child one bird’s name. Attention is the first form of stewardship. #ClimateWavers",
    "Celebrate quiet victories: a day without plastic, a tree planted, a rumor not shared. #ClimateWavers",
    "Energy thrift is elegance. Dim one room and watch the night soften. #ClimateWavers",
    "Advocate for safe sidewalks and shade. Cities that walk well emit less. #ClimateWavers",
    "Soil health is climate health. Mulch, cover crops, less bare earth. #ClimateWavers",
    "When heat rises, check on neighbors. Adaptation is a relationship. #ClimateWavers",
    "Read one page of climate science this week — wonder beats overwhelm. #ClimateWavers",
    "Choose local produce when you can. Short miles, full flavors, quieter trucks. #ClimateWavers",
    "Digital declutter: delete unused cloud files. Data centers drink power. #ClimateWavers",
    "Stand with frontline communities. Climate justice is climate action. #ClimateWavers",
]

SIGNATURES = [
    "— WaverX",
    "— WaverX · Climate Wavers",
    "WaverX, listening for truth.",
]


def _clip(text: str, limit: int = TWEET_SOFT_LIMIT) -> str:
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0]
    return (cut or text[: limit - 1]).rstrip(".,;:") + "…"


def _pick(items, seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16) % len(items)
    return items[idx]


def _place(event: dict) -> str:
    return (
        event.get("region")
        or event.get("city")
        or event.get("country")
        or event.get("title")
        or "a reported area"
    )


def compose_alert_tweet(event: dict, *, deep_link: str | None = None) -> str:
    """Creative verified-alert copy grounded in official source metadata."""
    place = _place(event)
    dtype = (event.get("disaster_type") or event.get("disasterType") or "event").replace(
        "_", " "
    )
    source = event.get("official_source") or event.get("source") or "official feed"
    magnitude = event.get("magnitude")
    source_url = (event.get("source_url") or "").strip()
    summary = (event.get("aiSummary") or event.get("ai_summary") or "").strip()
    event_id = str(event.get("id") or event.get("event_id") or place)

    opener = _pick(ALERT_OPENERS, f"open:{event_id}")
    closer = _pick(ALERT_CLOSERS, f"close:{event_id}")
    sig = _pick(SIGNATURES, f"sig:{event_id}")

    mag_bit = f" · M{magnitude}" if magnitude not in (None, "") else ""
    headline = f"{dtype.title()} near {place}{mag_bit}."
    source_bit = f"Source: {source}."

    # Prefer a short original line over dumping the full AI summary.
    spark = ""
    if summary:
        short = summary.split(".")[0].strip()
        if short and short.lower() not in headline.lower():
            spark = short[:120]

    parts = [opener, headline, source_bit]
    if spark:
        parts.append(spark + ".")
    if source_url:
        parts.append(source_url)
    elif deep_link:
        parts.append(deep_link)
    parts.append(closer)
    parts.append(sig)
    parts.append("#VerifiedAlert #ClimateWavers")

    return _clip(" ".join(parts))


def compose_tip_tweet(*, when: datetime | None = None, force_index: int | None = None) -> str:
    """Rotating climate / environment tip with day-based uniqueness."""
    when = when or datetime.now(dt_timezone.utc)
    day_key = when.strftime("%Y-%j")
    if force_index is not None:
        tip = TIP_BANK[force_index % len(TIP_BANK)]
    else:
        # Two-layer rotation: day picks a band, hour nudges within it.
        base = int(hashlib.sha256(day_key.encode()).hexdigest()[:8], 16)
        hour_nudge = when.hour % 7
        tip = TIP_BANK[(base + hour_nudge) % len(TIP_BANK)]

    # Light remix so identical tips don't feel copy-pasted across seasons.
    month = when.month
    if month in (3, 4, 5):
        season_label = "Spring energy:"
    elif month in (6, 7, 8):
        season_label = "Warm-season note:"
    elif month in (9, 10, 11):
        season_label = "Harvest-season note:"
    else:
        season_label = "Quiet-season note:"

    prefix = ""
    if when.day % 3 == 0:
        prefix = f"{season_label} "

    sig = _pick(SIGNATURES, f"tip:{day_key}:{when.hour}")
    body = f"{prefix}{tip}"
    if "WaverX" not in body:
        body = f"{body} {sig}"
    return _clip(body)


def compose_tip_variants(n: int = 3) -> list[str]:
    """Generate a few tip candidates (useful for dry-run / admin)."""
    now = datetime.now(dt_timezone.utc)
    out = []
    for i in range(n):
        out.append(compose_tip_tweet(when=now, force_index=(now.timetuple().tm_yday + i) % len(TIP_BANK)))
    return out


def maybe_ai_polish(text: str, kind: str = "tip") -> str:
    """
    Optional OpenAI polish. Falls back to the crafted text on any failure.
    Kept short, branded, and under the soft limit.
    """
    try:
        from django.conf import settings
        import requests

        api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
        if not api_key:
            return text

        system = (
            "You are WaverX, Climate Wavers' public voice on X. "
            "Rewrite the draft to be more creative, unique, and inspiring — "
            "but keep facts, source URLs, and the calm verified tone. "
            "No fear-mongering. No fake urgency. Stay under 260 characters. "
            "Return only the tweet text."
            if kind == "alert"
            else
            "You are WaverX, Climate Wavers' public voice on X. "
            "Rewrite this climate tip to feel poetic, original, and motivating — "
            "practical but never preachy. Keep #ClimateWavers if present. "
            "Stay under 260 characters. Return only the tweet text."
        )
        res = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "temperature": 0.85,
                "max_tokens": 180,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": text},
                ],
            },
            timeout=20,
        )
        if not res.ok:
            return text
        data = res.json()
        polished = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
            .strip('"')
        )
        if not polished:
            return text
        return _clip(polished)
    except Exception:
        return text
