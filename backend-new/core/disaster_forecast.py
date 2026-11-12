"""
Historical disaster analysis + short-horizon risk outlook for Climate Wavers.
Not a government warning system — statistical outlook from observed events.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import timedelta
from statistics import mean

from django.utils import timezone

from .models import Disaster


def _norm_type(value: str) -> str:
    raw = (value or "unknown").strip().lower().replace("_", " ")
    aliases = {
        "quake": "earthquake",
        "seismic": "earthquake",
        "eq": "earthquake",
        "wildfire": "wildfire",
        "fire": "wildfire",
        "flooding": "flood",
        "storms": "storm",
        "cyclone": "storm",
        "hurricane": "storm",
        "typhoon": "storm",
        "volcano": "volcano",
        "volcanic": "volcano",
        "drought": "drought",
        "landslide": "landslide",
    }
    for key, label in aliases.items():
        if key in raw:
            return label
    return raw.split()[0] if raw else "unknown"


def _event_from_disaster(d: Disaster) -> dict:
    return {
        "id": str(d.id),
        "disaster_type": d.disaster_type or "",
        "country": d.country or "",
        "region": d.region or "",
        "severity": d.severity or "",
        "status": d.status or "",
        "magnitude": getattr(d, "magnitude", None),
        "created_at": (d.start_date or d.created_at or timezone.now()).isoformat(),
        "title": d.title or "",
    }


def _event_from_payload(row: dict) -> dict | None:
    if not isinstance(row, dict):
        return None
    created = (
        row.get("created_at")
        or row.get("date")
        or row.get("time")
        or row.get("updated")
        or timezone.now().isoformat()
    )
    return {
        "id": str(row.get("id") or row.get("disaster_id") or ""),
        "disaster_type": row.get("disaster_type")
        or row.get("disasterType")
        or row.get("type")
        or "",
        "country": row.get("country") or row.get("region") or "",
        "region": row.get("region") or row.get("city") or "",
        "severity": row.get("severity") or "",
        "status": row.get("status") or "",
        "magnitude": row.get("magnitude"),
        "created_at": created,
        "title": row.get("title") or row.get("name") or row.get("details") or "",
    }


def _parse_dt(value):
    if not value:
        return None
    if hasattr(value, "isoformat"):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        from datetime import datetime

        return datetime.fromisoformat(text)
    except Exception:
        return None


def build_forecast(*, live_events: list | None = None, days: int = 90) -> dict:
    now = timezone.now()
    window_start = now - timedelta(days=max(14, int(days)))

    events: list[dict] = []
    for d in Disaster.objects.filter(created_at__gte=window_start).iterator():
        events.append(_event_from_disaster(d))

    for row in live_events or []:
        ev = _event_from_payload(row)
        if ev:
            events.append(ev)

    # Deduplicate by id+title
    seen = set()
    unique = []
    for ev in events:
        key = (ev.get("id") or "") + "|" + (ev.get("title") or "")[:80]
        if key in seen:
            continue
        seen.add(key)
        unique.append(ev)
    events = unique

    type_counts: Counter = Counter()
    country_counts: Counter = Counter()
    day_counts: Counter = Counter()
    type_by_week: dict[str, Counter] = defaultdict(Counter)
    recent_7 = 0
    recent_30 = 0
    mag_samples = []

    for ev in events:
        dtype = _norm_type(ev.get("disaster_type") or ev.get("title") or "")
        country = (ev.get("country") or "Unknown").strip() or "Unknown"
        if len(country) > 48:
            country = country[:45] + "…"
        type_counts[dtype] += 1
        country_counts[country] += 1

        dt = _parse_dt(ev.get("created_at"))
        if dt is not None:
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            age = (now - dt).total_seconds()
            if age <= 7 * 86400:
                recent_7 += 1
            if age <= 30 * 86400:
                recent_30 += 1
            day_key = dt.date().isoformat()
            day_counts[day_key] += 1
            week_key = f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"
            type_by_week[week_key][dtype] += 1

        mag = ev.get("magnitude")
        try:
            if mag is not None and mag != "":
                mag_samples.append(float(mag))
        except (TypeError, ValueError):
            pass

    # Build last 14 days series (fill zeros)
    series_labels = []
    series_values = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date().isoformat()
        series_labels.append(day[5:])  # MM-DD
        series_values.append(day_counts.get(day, 0))

    # Outlook: project next 7 days from recent daily average with type mix
    daily_avg_14 = mean(series_values) if series_values else 0.0
    daily_avg_7 = mean(series_values[-7:]) if len(series_values) >= 7 else daily_avg_14
    projected_7 = round(max(0.0, daily_avg_7) * 7, 1)
    projected_14 = round(max(0.0, (daily_avg_7 * 0.7 + daily_avg_14 * 0.3)) * 14, 1)

    total = sum(type_counts.values()) or 1
    type_outlook = []
    for dtype, count in type_counts.most_common(8):
        share = count / total
        next_7_est = round(projected_7 * share, 1)
        # Momentum: compare last 7 vs previous 7 in series
        last7 = sum(series_values[-7:]) if series_values else 0
        prev7 = sum(series_values[-14:-7]) if len(series_values) >= 14 else last7
        if prev7 <= 0:
            trend = "stable"
        elif last7 > prev7 * 1.15:
            trend = "rising"
        elif last7 < prev7 * 0.85:
            trend = "easing"
        else:
            trend = "stable"
        risk = "elevated" if trend == "rising" and share >= 0.15 else (
            "watch" if share >= 0.2 or trend == "rising" else "baseline"
        )
        type_outlook.append(
            {
                "type": dtype,
                "historical_count": count,
                "share_pct": round(share * 100, 1),
                "projected_next_7_days": next_7_est,
                "trend": trend,
                "risk_band": risk,
            }
        )

    hotspots = [
        {"country": c, "count": n, "share_pct": round(n / total * 100, 1)}
        for c, n in country_counts.most_common(10)
    ]

    narrative = _compose_narrative(
        total=len(events),
        recent_7=recent_7,
        recent_30=recent_30,
        projected_7=projected_7,
        type_outlook=type_outlook,
        hotspots=hotspots,
        mag_avg=round(mean(mag_samples), 1) if mag_samples else None,
    )
    narrative = _maybe_ai_polish(narrative)

    return {
        "generated_at": now.isoformat(),
        "window_days": days,
        "disclaimer": (
            "Statistical outlook from historical and live feed patterns. "
            "Not a government emergency warning. Always follow local authorities."
        ),
        "summary": {
            "events_analyzed": len(events),
            "last_7_days": recent_7,
            "last_30_days": recent_30,
            "projected_next_7_days": projected_7,
            "projected_next_14_days": projected_14,
            "avg_magnitude": round(mean(mag_samples), 1) if mag_samples else None,
        },
        "charts": {
            "daily_activity": {
                "labels": series_labels,
                "values": series_values,
            },
            "by_type": {
                "labels": [t for t, _ in type_counts.most_common(8)],
                "values": [n for _, n in type_counts.most_common(8)],
            },
            "by_country": {
                "labels": [c for c, _ in country_counts.most_common(8)],
                "values": [n for _, n in country_counts.most_common(8)],
            },
            "outlook_by_type": {
                "labels": [row["type"] for row in type_outlook],
                "values": [row["projected_next_7_days"] for row in type_outlook],
            },
        },
        "type_outlook": type_outlook,
        "hotspots": hotspots,
        "narrative": narrative,
    }


def _compose_narrative(*, total, recent_7, recent_30, projected_7, type_outlook, hotspots, mag_avg):
    top = type_outlook[0] if type_outlook else None
    hot = hotspots[0] if hotspots else None
    lines = [
        f"Climate Wavers analyzed {total} historical and live disaster signals.",
        f"Activity in the last 7 days: {recent_7} events (30-day window: {recent_30}).",
        f"Short-horizon outlook suggests about {projected_7} events over the next week "
        f"if recent pacing continues.",
    ]
    if top:
        lines.append(
            f"Dominant pattern: {top['type']} ({top['share_pct']}% of observed events), "
            f"trend {top['trend']}, risk band {top['risk_band']}."
        )
    if hot:
        lines.append(
            f"Geographic concentration is highest around {hot['country']} "
            f"({hot['count']} events in the analysis window)."
        )
    if mag_avg is not None:
        lines.append(f"Average reported earthquake magnitude in sample: M{mag_avg}.")
    rising = [t for t in type_outlook if t["trend"] == "rising"]
    if rising:
        names = ", ".join(t["type"] for t in rising[:3])
        lines.append(f"Rising signals to watch: {names}.")
    else:
        lines.append("No sharp acceleration across major types — maintain routine vigilance.")
    lines.append(
        "Use this as context for preparedness and community awareness, "
        "not as an official evacuation or warning order."
    )
    return " ".join(lines)


def _maybe_ai_polish(text: str) -> str:
    try:
        from django.conf import settings
        import requests

        api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
        if not api_key:
            return text
        res = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "temperature": 0.5,
                "max_tokens": 420,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are WaverX, Climate Wavers' analyst. Rewrite the disaster "
                            "outlook to be clear, calm, and insightful. Keep all numbers. "
                            "Do not invent events. End by reminding readers this is not a "
                            "government warning. Return plain paragraphs only."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
            },
            timeout=20,
        )
        if not res.ok:
            return text
        polished = (
            res.json()
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        return polished or text
    except Exception:
        return text
