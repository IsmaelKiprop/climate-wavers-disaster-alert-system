"""
WaverX public broadcasts — free by default.

Posts creative verified alerts and climate tips to the Climate Wavers feed
as the WaverX user. Paid X API posting stays OFF unless explicitly enabled.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .waverx_voice import compose_alert_tweet, compose_tip_tweet, maybe_ai_polish

logger = logging.getLogger(__name__)

TWEETS_URL = "https://api.x.com/2/tweets"


def twitter_enabled() -> bool:
    """Paid X API write path — off unless WAVERX_TWITTER_ENABLED and keys are set."""
    return bool(
        getattr(settings, "WAVERX_TWITTER_ENABLED", False)
        and getattr(settings, "TWITTER_API_KEY", "")
        and getattr(settings, "TWITTER_API_SECRET", "")
        and getattr(settings, "TWITTER_ACCESS_TOKEN", "")
        and getattr(settings, "TWITTER_ACCESS_TOKEN_SECRET", "")
    )


def feed_enabled() -> bool:
    return bool(getattr(settings, "WAVERX_MIRROR_FEED", True))


def x_intent_url(text: str) -> str:
    """Free share link — opens X compose; no API keys or payment."""
    return f"https://twitter.com/intent/tweet?text={quote((text or '').strip())}"


def post_tweet_text(text: str) -> dict[str, Any]:
    """Optional paid X API post. Disabled by default."""
    if not twitter_enabled():
        return {"ok": False, "skipped": True, "error": "Paid X API posting is disabled"}

    import requests
    from requests_oauthlib import OAuth1

    text = (text or "").strip()
    if not text:
        return {"ok": False, "error": "Empty tweet"}

    try:
        auth = OAuth1(
            settings.TWITTER_API_KEY,
            settings.TWITTER_API_SECRET,
            settings.TWITTER_ACCESS_TOKEN,
            settings.TWITTER_ACCESS_TOKEN_SECRET,
        )
        res = requests.post(
            TWEETS_URL,
            auth=auth,
            json={"text": text},
            timeout=30,
        )
        payload = res.json() if res.content else {}
        if res.status_code == 201:
            tweet_id = (payload.get("data") or {}).get("id")
            return {"ok": True, "tweet_id": tweet_id, "response": payload}
        logger.warning("WaverX X API post failed %s: %s", res.status_code, payload)
        return {"ok": False, "status_code": res.status_code, "error": payload}
    except Exception as exc:
        logger.exception("WaverX X API request error")
        return {"ok": False, "error": str(exc)}


def ensure_waverx_user():
    """Create/refresh the official WaverX profile if missing."""
    from django.core.management import call_command
    from io import StringIO

    out = StringIO()
    call_command("ensure_waverx_profile", stdout=out)
    from django.contrib.auth import get_user_model

    username = (getattr(settings, "WAVERX_USERNAME", "") or "waverx").strip()
    return get_user_model().objects.filter(username__iexact=username).first()


def _create_feed_post(text: str, *, kind: str) -> str | None:
    """Create a Post as the WaverX user (free, in-app)."""
    try:
        from .models import Post

        user = ensure_waverx_user()
        if not user:
            logger.warning("WaverX user could not be ensured")
            return None
        title = "Verified alert" if kind == "alert" else "Climate tip"
        post = Post.objects.create(
            user=user,
            title=title,
            content=text,
            visibility="Everyone",
        )
        return str(post.id)
    except Exception as exc:
        logger.exception("WaverX feed post failed: %s", exc)
        return None


def _publish(
    *,
    kind: str,
    fingerprint: str,
    text: str,
    event_id: str = "",
    dry_run: bool = False,
) -> dict:
    from .models import WaverXTweet

    intent = x_intent_url(text)
    if dry_run:
        result = {
            "ok": True,
            "dry_run": True,
            "text": text,
            "intent_url": intent,
            "channel": "dry_run",
        }
        status = "dry_run"
        post_id = ""
        tweet_id = ""
    else:
        post_id = _create_feed_post(text, kind=kind) if feed_enabled() else None
        tweet_id = ""
        x_result = None
        if twitter_enabled():
            x_result = post_tweet_text(text)
            if x_result.get("ok"):
                tweet_id = x_result.get("tweet_id") or ""

        ok = bool(post_id) or bool(tweet_id)
        result = {
            "ok": ok,
            "text": text,
            "intent_url": intent,
            "feed_post_id": post_id or "",
            "tweet_id": tweet_id,
            "channel": "feed" if post_id else ("x_api" if tweet_id else "none"),
            "x_api": x_result,
        }
        status = "posted" if ok else "failed"

    with transaction.atomic():
        WaverXTweet.objects.update_or_create(
            fingerprint=fingerprint,
            defaults={
                "kind": kind,
                "event_id": event_id or "",
                "text": text,
                "tweet_id": tweet_id if not dry_run else "",
                "status": status,
                "response": result,
                "feed_post_id": (post_id or "") if not dry_run else "",
                "posted_at": timezone.now() if status == "posted" else None,
            },
        )
    return result


def tweet_verified_alert(event: dict, *, dry_run: bool = False, polish: bool = True) -> dict:
    """Compose + publish a verified official alert (deduped by event id)."""
    from .models import WaverXTweet

    event_id = str(event.get("id") or event.get("event_id") or "").strip()
    if not event_id:
        return {"ok": False, "error": "Missing event id"}

    fingerprint = f"alert:{event_id}"
    existing = WaverXTweet.objects.filter(fingerprint=fingerprint, status="posted").first()
    if existing:
        return {
            "ok": True,
            "deduped": True,
            "tweet_id": existing.tweet_id,
            "feed_post_id": existing.feed_post_id,
            "text": existing.text,
            "intent_url": x_intent_url(existing.text),
        }

    frontend = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    deep = f"{frontend}/disasters" if frontend else None
    text = compose_alert_tweet(event, deep_link=deep)
    if polish and getattr(settings, "WAVERX_TWITTER_AI_POLISH", False):
        text = maybe_ai_polish(text, kind="alert")

    return _publish(
        kind="alert",
        fingerprint=fingerprint,
        text=text,
        event_id=event_id,
        dry_run=dry_run,
    )


def tweet_climate_tip(*, dry_run: bool = False, polish: bool = True, force: bool = False) -> dict:
    """Publish one rotating climate tip (at most one posted tip per UTC day unless force)."""
    from .models import WaverXTweet

    day = timezone.now().strftime("%Y-%m-%d")
    fingerprint = f"tip:{day}"
    if not force:
        existing = WaverXTweet.objects.filter(fingerprint=fingerprint, status="posted").first()
        if existing:
            return {
                "ok": True,
                "deduped": True,
                "tweet_id": existing.tweet_id,
                "feed_post_id": existing.feed_post_id,
                "text": existing.text,
                "intent_url": x_intent_url(existing.text),
            }

    if force:
        fingerprint = f"tip:{day}:{timezone.now().strftime('%H%M%S')}"

    text = compose_tip_tweet()
    if polish and getattr(settings, "WAVERX_TWITTER_AI_POLISH", False):
        text = maybe_ai_polish(text, kind="tip")

    return _publish(kind="tip", fingerprint=fingerprint, text=text, dry_run=dry_run)
