import os

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand

from api.models import User

# Documented default for fixture admins (override with ADMIN_DEFAULT_PASSWORD).
DEFAULT_ADMIN_PASSWORD = "admin123"


class Command(BaseCommand):
    help = "Create or refresh staff admins from fixtures/admins.yaml"

    def handle(self, *args, **kwargs):
        file_path = os.path.join(settings.BASE_DIR, "fixtures", "admins.yaml")
        password = (
            os.environ.get("ADMIN_DEFAULT_PASSWORD")
            or os.environ.get("DJANGO_SUPERUSER_PASSWORD")
            or DEFAULT_ADMIN_PASSWORD
        )

        with open(file_path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or []

        created = 0
        updated = 0
        skip_m2m = {"groups", "user_permissions"}

        for item in data:
            fields = dict(item.get("fields") or {})
            for key in skip_m2m:
                fields.pop(key, None)

            email = (fields.get("email") or "").strip().lower()
            if not email:
                continue

            defaults = {
                "username": fields.get("username") or email.split("@")[0],
                "first_name": fields.get("first_name") or "Admin",
                "last_name": fields.get("last_name") or "User",
                "country": fields.get("country") or "Kenya",
                "state": fields.get("state") or "Nairobi",
                "gender": fields.get("gender") or "male",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
                "is_verified": True,
            }
            if fields.get("picture"):
                defaults["picture"] = fields["picture"]
            if fields.get("default_avatar"):
                defaults["default_avatar"] = fields["default_avatar"]

            user, was_created = User.objects.get_or_create(
                email=email,
                defaults=defaults,
            )
            # Always keep staff flags + known login password in sync for fixture admins
            for key, value in defaults.items():
                setattr(user, key, value)
            user.set_password(password)
            user.save()

            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Admins ready. created={created} updated={updated} "
                f"(password from ADMIN_DEFAULT_PASSWORD / default admin123)"
            )
        )
