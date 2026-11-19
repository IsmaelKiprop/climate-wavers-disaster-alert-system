"""
Platform Admin engagement outreach — segment users and send creative, unique emails.

Segments: unverified, incomplete_profile, no_posts, quiet_week, new_unstarted.
Each segment has several copy variants; variant is stable per user+day so bulk
sends feel personal without repeating the same subject to everyone.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.db.models import Count, Exists, OuterRef, Q, QuerySet
from django.utils import timezone

logger = logging.getLogger(__name__)

SEGMENTS = {
    "unverified": {
        "id": "unverified",
        "label": "Unverified email",
        "description": "Signed up but never confirmed their email — can't fully use the app.",
        "cta_path": "/verify-email",
        "cta_fallback": "/signin",
    },
    "incomplete_profile": {
        "id": "incomplete_profile",
        "label": "Incomplete profile",
        "description": "Missing name, photo, bio, or location — hard to connect with the community.",
        "cta_path": "/app/profile",
        "cta_fallback": "/app",
    },
    "no_posts": {
        "id": "no_posts",
        "label": "Never posted",
        "description": "Active accounts that have not shared a climate post yet.",
        "cta_path": "/app",
        "cta_fallback": "/app",
    },
    "quiet_week": {
        "id": "quiet_week",
        "label": "Quiet 14+ days",
        "description": "No recent posts — invite them back into the conversation.",
        "cta_path": "/app",
        "cta_fallback": "/app",
    },
    "new_unstarted": {
        "id": "new_unstarted",
        "label": "New · not started",
        "description": "Joined in the last 21 days, verified, but still no profile polish or first post.",
        "cta_path": "/app",
        "cta_fallback": "/app",
    },
}


# Creative variants: (subject, headline, content, cta_text, preheader, reply_hint)
# {name} is replaced with first name or "friend".
VARIANTS: Dict[str, List[Dict[str, str]]] = {
    "unverified": [
        {
            "subject": "{name}, your Climate Wavers seat is still warm",
            "headline": "One tap unlocks the feed",
            "preheader": "Confirm your email and step into climate action.",
            "cta_text": "Verify my email",
            "reply_hint": "Can't find the code? Reply and we'll resend a fresh one.",
            "content": (
                "You started something important — a place in a community that reports disasters, "
                "plants trees, and keeps each other informed.\n\n"
                "Your inbox just needs one quiet confirmation so we know it's really you. "
                "After that: live alerts, planting projects, and people near you who care about the same sky."
            ),
        },
        {
            "subject": "Still locked out of Climate Wavers?",
            "headline": "Let's open the door",
            "preheader": "Thirty seconds. Then the climate network is yours.",
            "cta_text": "Confirm email now",
            "reply_hint": "Stuck on verification? Reply — a human will help.",
            "content": (
                "Half-finished signups happen. We get it.\n\n"
                "When you verify, you unlock disaster alerts, tree certificates, and a feed "
                "built for people who refuse to look away. No spam theater — just the climate "
                "signal you signed up for."
            ),
        },
        {
            "subject": "Your planet-shaped invite is waiting",
            "headline": "Prove it's you — then explore",
            "preheader": "Climate Wavers is ready when you are.",
            "cta_text": "Verify & enter",
            "reply_hint": "Wrong email? Reply with the right one and we'll sort it.",
            "content": (
                "Somewhere between \"I'll do it later\" and now, a whole feed of climate "
                "stories, responders, and tree projects has been waiting for you.\n\n"
                "Verify once. Then plant, report, or simply watch the map light up."
            ),
        },
    ],
    "incomplete_profile": [
        {
            "subject": "{name}, your Climate Wavers face is still a silhouette",
            "headline": "Finish the portrait",
            "preheader": "Name, photo, place — then the community can find you.",
            "cta_text": "Complete my profile",
            "reply_hint": "Need a hand with photos or privacy? Reply anytime.",
            "content": (
                "People connect with people — not empty avatars.\n\n"
                "Add your name, a real photo, a short bio, and where you stand on the map. "
                "That's how neighbors, champions, and tree partners recognize you when you speak up."
            ),
        },
        {
            "subject": "Make Climate Wavers recognize you",
            "headline": "A complete profile is a louder voice",
            "preheader": "Two minutes. Much stronger presence.",
            "cta_text": "Polish my profile",
            "reply_hint": "Prefer private location? Country alone is enough — reply if unsure.",
            "content": (
                "Incomplete profiles drift to the bottom of every conversation.\n\n"
                "Fill in the blanks Climate Wavers asks for — then your posts, gifts, and "
                "alerts carry a face and a story. The planet noticeboard works better when "
                "we know who's speaking."
            ),
        },
        {
            "subject": "{name}, show up as yourself",
            "headline": "You're almost there",
            "preheader": "Bio + photo + place = trust.",
            "cta_text": "Update profile",
            "reply_hint": "We read every reply — ask us anything.",
            "content": (
                "Climate work is local and human. A blank profile makes it harder for "
                "responders, planters, and fellow Wavers to trust and tag you.\n\n"
                "Open your profile, add the missing pieces, and come back to the feed as you."
            ),
        },
    ],
    "no_posts": [
        {
            "subject": "{name}, the feed is quieter without you",
            "headline": "Your first climate note",
            "preheader": "One post. A thousand ripples.",
            "cta_text": "Share something",
            "reply_hint": "Not sure what to write? Reply — we'll suggest a starter.",
            "content": (
                "You've been watching. Now the community needs your signal.\n\n"
                "A photo from your street after rain. A question about heat. A thank-you to "
                "a planter. First posts don't need to be perfect — they need to be true."
            ),
        },
        {
            "subject": "Plant words. Grow a conversation.",
            "headline": "Break the silence",
            "preheader": "Climate Wavers thrives on real voices.",
            "cta_text": "Write my first post",
            "reply_hint": "Camera shy? Text-only posts count too.",
            "content": (
                "Every quiet account is a missing weather vane.\n\n"
                "Open the app, tap compose, and leave one honest note about climate where "
                "you live. Someone scrolling tonight might need exactly that."
            ),
        },
        {
            "subject": "Your first Climate Wavers post is overdue (in a good way)",
            "headline": "Say it out loud",
            "preheader": "Reports, trees, wins — start anywhere.",
            "cta_text": "Post now",
            "reply_hint": "Want a prompt? Reply with your city and we'll send one.",
            "content": (
                "Accounts without posts are like weather stations with the sensor off.\n\n"
                "Flip it on: share a disaster tip, a tree you gifted, or a question the "
                "community can answer. We'll be right there with you."
            ),
        },
    ],
    "quiet_week": [
        {
            "subject": "The climate didn't pause — we missed you",
            "headline": "Welcome back to the signal",
            "preheader": "Fresh disasters, trees, and voices since you last posted.",
            "cta_text": "Catch up on the feed",
            "reply_hint": "Busy season? Reply and we'll keep it light.",
            "content": (
                "It's been a little while since your last post on Climate Wavers.\n\n"
                "The map moved. Storms were tracked. Trees were funded. Drop back in — "
                "even a short update from your corner of the world keeps the network awake."
            ),
        },
        {
            "subject": "{name}, your corner of the map went quiet",
            "headline": "Rejoin the watch",
            "preheader": "Fourteen days is a long time in climate time.",
            "cta_text": "I'm back",
            "reply_hint": "Prefer alerts only? Update preferences from the link below.",
            "content": (
                "Silence can mean peace — or it can mean we lost a lookout.\n\n"
                "If you're still with us, say hi with a post, a reaction, or a tree gift. "
                "The community is stronger when every region checks in."
            ),
        },
        {
            "subject": "A soft nudge from Climate Wavers",
            "headline": "Still here when you are",
            "preheader": "No guilt — just an open door.",
            "cta_text": "Open Climate Wavers",
            "reply_hint": "Want fewer emails? Reply \"pause\" and we'll note it.",
            "content": (
                "We noticed you haven't posted in a bit. No lecture — just a reminder that "
                "the feed, the alerts, and the planting projects are still yours.\n\n"
                "Come for two minutes. Leave when you're ready. The planet keeps score either way."
            ),
        },
    ],
    "new_unstarted": [
        {
            "subject": "Day one energy, {name} — let's use it",
            "headline": "Three small starts",
            "preheader": "Verify ✓ · Profile · First post",
            "cta_text": "Start inside the app",
            "reply_hint": "New here? Reply with your goal and we'll guide you.",
            "content": (
                "Welcome to Climate Wavers. You've joined — now make it real.\n\n"
                "1) Finish your profile so people know you.\n"
                "2) Share one first post from your place.\n"
                "3) Explore a tree project or a live alert.\n\n"
                "Tiny steps. Real climate network."
            ),
        },
        {
            "subject": "Don't let your Climate Wavers account go idle",
            "headline": "Your first week checklist",
            "preheader": "We saved you a path in.",
            "cta_text": "Take me in",
            "reply_hint": "Prefer WhatsApp tips later? Just say so in a reply.",
            "content": (
                "New accounts that stay empty rarely come back.\n\n"
                "Before the week ends: add a photo, drop one post, and peek at Plant a Tree "
                "or the disaster desk. We'll meet you there."
            ),
        },
        {
            "subject": "{name}, Climate Wavers is waiting for your first move",
            "headline": "Pick a door",
            "preheader": "Report · Plant · Follow · Post",
            "cta_text": "Explore the app",
            "reply_hint": "Overwhelmed? Reply \"simple\" for a one-step plan.",
            "content": (
                "There's no wrong first action — only the ones you never take.\n\n"
                "Open the app and choose: follow a champion, gift a mangrove, or tell the "
                "feed what the weather feels like where you stand. We'll amplify the rest."
            ),
        },
    ],
}


def _frontend_base() -> str:
    from .email_html import frontend_base

    return frontend_base()


def _display_name(user) -> str:
    first = (getattr(user, "first_name", None) or "").strip()
    if first:
        return first
    uname = (getattr(user, "username", None) or "").strip()
    if uname and "@" not in uname:
        return uname
    return "friend"


def _variant_index(user_id: int, segment: str, n: int) -> int:
    if n <= 1:
        return 0
    day = timezone.now().strftime("%Y-%m-%d")
    digest = hashlib.sha256(f"{segment}:{user_id}:{day}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % n


def build_email_for_user(user, segment: str) -> Dict[str, Any]:
    meta = SEGMENTS.get(segment) or SEGMENTS["no_posts"]
    variants = VARIANTS.get(segment) or VARIANTS["no_posts"]
    pick = variants[_variant_index(user.id, segment, len(variants))]
    name = _display_name(user)
    base = _frontend_base()
    cta_path = meta.get("cta_path") or "/app"
    # Unverified users may not reach /app — prefer public verify/signin paths
    if segment == "unverified":
        cta_url = f"{base}/signin"
    else:
        cta_url = f"{base}{cta_path}"

    def fill(text: str) -> str:
        return (text or "").replace("{name}", name)

    return {
        "email": (user.email or "").strip(),
        "data": {
            "subject": fill(pick["subject"]),
            "headline": fill(pick["headline"]),
            "content": fill(pick["content"]),
            "preheader": fill(pick.get("preheader") or ""),
            "cta_text": fill(pick.get("cta_text") or "Open Climate Wavers"),
            "cta_url": cta_url,
            "reply_hint": fill(pick.get("reply_hint") or ""),
            "name": name,
            "segment": segment,
            "variant": _variant_index(user.id, segment, len(variants)),
        },
    }


def base_user_qs() -> QuerySet:
    from api.models import User

    return (
        User.objects.filter(is_active=True)
        .exclude(email__isnull=True)
        .exclude(email="")
        .exclude(is_staff=True)
        .exclude(is_superuser=True)
    )


def segment_queryset(segment: str) -> QuerySet:
    from .models import Post

    qs = base_user_qs()
    now = timezone.now()

    if segment == "unverified":
        return qs.filter(is_verified=False).order_by("-date_joined")

    if segment == "incomplete_profile":
        no_photo = (Q(profile_pic__isnull=True) | Q(profile_pic="")) & (
            Q(picture__isnull=True) | Q(picture="")
        )
        no_place = (Q(country__isnull=True) | Q(country="")) & (
            Q(location__isnull=True) | Q(location="")
        )
        return (
            qs.filter(is_verified=True)
            .filter(
                Q(first_name__isnull=True)
                | Q(first_name="")
                | Q(last_name__isnull=True)
                | Q(last_name="")
                | Q(bio__isnull=True)
                | Q(bio="")
                | no_place
                | no_photo
            )
            .order_by("-date_joined")
        )

    if segment == "no_posts":
        has_post = Post.objects.filter(user_id=OuterRef("pk"))
        return (
            qs.filter(is_verified=True)
            .annotate(_has_post=Exists(has_post))
            .filter(_has_post=False)
            .order_by("-date_joined")
        )

    if segment == "quiet_week":
        cutoff = now - timedelta(days=14)
        recent = Post.objects.filter(user_id=OuterRef("pk"), created_at__gte=cutoff)
        ever = Post.objects.filter(user_id=OuterRef("pk"))
        return (
            qs.filter(is_verified=True, date_joined__lt=cutoff)
            .annotate(_recent=Exists(recent), _ever=Exists(ever))
            .filter(_ever=True, _recent=False)
            .order_by("date_joined")
        )

    if segment == "new_unstarted":
        joined_after = now - timedelta(days=21)
        has_post = Post.objects.filter(user_id=OuterRef("pk"))
        no_photo = (Q(profile_pic__isnull=True) | Q(profile_pic="")) & (
            Q(picture__isnull=True) | Q(picture="")
        )
        incomplete = (
            Q(first_name__isnull=True)
            | Q(first_name="")
            | Q(bio__isnull=True)
            | Q(bio="")
            | no_photo
        )
        return (
            qs.filter(is_verified=True, date_joined__gte=joined_after)
            .annotate(_has_post=Exists(has_post))
            .filter(Q(_has_post=False) | incomplete)
            .order_by("-date_joined")
        )

    return qs.none()


def segment_counts() -> List[Dict[str, Any]]:
    rows = []
    for key, meta in SEGMENTS.items():
        try:
            count = segment_queryset(key).count()
        except Exception as exc:
            logger.exception("segment count failed %s: %s", key, exc)
            count = 0
        rows.append({**meta, "count": count})
    return rows


def preview_segment(segment: str, *, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    if segment not in SEGMENTS:
        raise ValueError("Unknown segment")
    qs = segment_queryset(segment)
    total = qs.count()
    users = list(qs[offset : offset + limit])
    samples = []
    for u in users:
        mail = build_email_for_user(u, segment)
        samples.append(
            {
                "id": u.id,
                "email": u.email,
                "username": u.username,
                "name": mail["data"]["name"],
                "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                "is_verified": bool(u.is_verified),
                "preview_subject": mail["data"]["subject"],
                "preview_headline": mail["data"]["headline"],
                "variant": mail["data"]["variant"],
            }
        )
    return {
        "segment": SEGMENTS[segment],
        "count": total,
        "limit": limit,
        "offset": offset,
        "results": samples,
    }


def send_segment_emails(
    segment: str,
    *,
    limit: int = 50,
    offset: int = 0,
    user_ids: Optional[Iterable[int]] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    if segment not in SEGMENTS:
        raise ValueError("Unknown segment")
    limit = max(1, min(int(limit or 50), 200))
    offset = max(0, int(offset or 0))

    qs = segment_queryset(segment)
    if user_ids is not None:
        ids = []
        for x in user_ids:
            try:
                ids.append(int(x))
            except (TypeError, ValueError):
                continue
        users = list(qs.filter(id__in=ids)[:limit])
    else:
        users = list(qs[offset : offset + limit])

    from api.tasks import send_message

    sent = 0
    failed = 0
    previews = []
    errors = []

    for u in users:
        payload = build_email_for_user(u, segment)
        if not payload.get("email"):
            failed += 1
            errors.append({"id": u.id, "detail": "missing email"})
            continue
        previews.append(
            {
                "id": u.id,
                "email": payload["email"],
                "subject": payload["data"]["subject"],
                "variant": payload["data"]["variant"],
            }
        )
        if dry_run:
            sent += 1
            continue
        try:
            send_message("custom_mail", payload)
            sent += 1
        except Exception as exc:
            failed += 1
            errors.append({"id": u.id, "email": payload["email"], "detail": str(exc)[:200]})
            logger.exception("outreach send failed user=%s", u.id)

    return {
        "segment": segment,
        "dry_run": dry_run,
        "attempted": len(users),
        "sent": sent,
        "failed": failed,
        "results": previews[:40],
        "errors": errors[:20],
    }
