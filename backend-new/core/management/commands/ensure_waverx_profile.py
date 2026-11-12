"""
Create / refresh the official WaverX (Climate Wavers) account with full profile details.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


WAVERX_BIO = (
    "Official voice of Climate Wavers. I share verified disaster alerts from USGS & NASA EONET, "
    "plus creative climate and environment tips — never rumors. Ask me in chat, follow for calm "
    "truth from Nairobi to the world."
)

# Stable public HTTPS defaults (work in API responses; not localhost).
DEFAULT_AVATAR = (
    "https://ui-avatars.com/api/?name=WaverX&background=0D9488&color=fff"
    "&size=256&bold=true&format=png"
)
DEFAULT_COVER = (
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05"
    "?auto=format&fit=crop&w=1600&q=80"
)


def _public_asset(url: str, fallback: str) -> str:
    value = (url or "").strip()
    if not value:
        return fallback
    lowered = value.lower()
    if "localhost" in lowered or "127.0.0.1" in lowered:
        return fallback
    if value.startswith("http://"):
        value = f"https://{value[7:]}"
    return value


class Command(BaseCommand):
    help = "Ensure the WaverX / Climate Wavers profile exists with public details"

    def handle(self, *args, **options):
        User = get_user_model()
        username = (getattr(settings, "WAVERX_USERNAME", None) or "waverx").strip()
        email = (getattr(settings, "WAVERX_EMAIL", None) or f"{username}@climatewavers.org").strip().lower()
        frontend = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
        configured_avatar = (getattr(settings, "WAVERX_AVATAR_URL", "") or "").strip()
        configured_cover = (getattr(settings, "WAVERX_COVER_URL", "") or "").strip()
        # Prefer explicit env; else production frontend assets; else stable CDN.
        if configured_avatar:
            avatar = _public_asset(configured_avatar, DEFAULT_AVATAR)
        elif frontend and "localhost" not in frontend and "127.0.0.1" not in frontend:
            avatar = _public_asset(f"{frontend}/waverx-avatar.svg", DEFAULT_AVATAR)
        else:
            avatar = DEFAULT_AVATAR

        if configured_cover:
            cover = _public_asset(configured_cover, DEFAULT_COVER)
        elif frontend and "localhost" not in frontend and "127.0.0.1" not in frontend:
            cover = _public_asset(f"{frontend}/waverx-cover.svg", DEFAULT_COVER)
        else:
            cover = DEFAULT_COVER

        defaults = {
            "username": username,
            "first_name": "WaverX",
            "last_name": "Climate Wavers",
            "country": "Kenya",
            "state": "Nairobi",
            "gender": "male",
            "profession": "Climate & disaster assistant · Climate Wavers",
            "bio": WAVERX_BIO,
            "website": frontend,
            "location": "Nairobi, Kenya",
            "profile_pic": avatar,
            "picture": avatar,
            "cover": cover,
            "is_verified": True,
            "is_active": True,
            "is_staff": False,
            "is_superuser": False,
            "is_onboarded": True,
        }

        user = User.objects.filter(username__iexact=username).first()
        if not user:
            user = User.objects.filter(email__iexact=email).first()

        if user:
            for key, value in defaults.items():
                setattr(user, key, value)
            user.save()
            created = False
        else:
            user = User.objects.create_user(
                email=email,
                first_name=defaults["first_name"],
                last_name=defaults["last_name"],
                country=defaults["country"],
                state=defaults["state"],
                password=None,
                username=defaults["username"],
                gender=defaults["gender"],
                profession=defaults["profession"],
                bio=defaults["bio"],
                website=defaults["website"],
                location=defaults["location"],
                profile_pic=defaults["profile_pic"],
                picture=defaults["picture"],
                cover=defaults["cover"],
                is_verified=True,
                is_active=True,
                is_onboarded=True,
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
            created = True

        self.stdout.write(
            self.style.SUCCESS(
                f"WaverX profile {'created' if created else 'updated'}: "
                f"id={user.id} @{user.username} email={user.email}"
            )
        )
        return str(user.id)
