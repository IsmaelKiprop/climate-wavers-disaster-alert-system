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

# Fallback when FRONTEND_URL is unset.
DEFAULT_AVATAR = (
    "https://ui-avatars.com/api/?name=WaverX&background=0D9488&color=fff"
    "&size=256&bold=true&format=png"
)
DEFAULT_COVER = (
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05"
    "?auto=format&fit=crop&w=1600&q=80"
)


def _asset_url(frontend: str, path: str, fallback: str) -> str:
    path = "/" + str(path).lstrip("/")
    if frontend:
        return f"{frontend.rstrip('/')}{path}"
    return fallback


class Command(BaseCommand):
    help = "Ensure the WaverX / Climate Wavers profile exists with public details"

    def handle(self, *args, **options):
        User = get_user_model()
        username = (getattr(settings, "WAVERX_USERNAME", None) or "waverx").strip()
        email = (getattr(settings, "WAVERX_EMAIL", None) or f"{username}@climatewavers.org").strip().lower()
        frontend = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
        configured_avatar = (getattr(settings, "WAVERX_AVATAR_URL", "") or "").strip()
        configured_cover = (getattr(settings, "WAVERX_COVER_URL", "") or "").strip()
        # Prefer bot art in frontend/public (waverbot1.png), then logo, then CDN.
        avatar = configured_avatar or _asset_url(frontend, "waverbot1.png", DEFAULT_AVATAR)
        cover = configured_cover or _asset_url(frontend, "environment.jpg", DEFAULT_COVER)

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
