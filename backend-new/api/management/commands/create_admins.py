import os

import yaml
from django.conf import settings
from django.core.management.base import BaseCommand

from api.models import User

# Documented default for fixture admins + FlowOps superadmin.
# Override with ADMIN_DEFAULT_PASSWORD / FLOWOPS_SUPERADMIN_PASSWORD / DJANGO_SUPERUSER_PASSWORD.
DEFAULT_ADMIN_PASSWORD = "admin123"
FLOWOPS_SUPERADMIN_EMAIL = "hello@flowops.africa"


class Command(BaseCommand):
    help = (
        "Create staff admins from fixtures/admins.yaml. "
        "By default only creates missing accounts (never recreates deleted users "
        "as an update). Use --force-update to refresh flags/password on existing."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help="Create missing fixture admins only; skip existing (default behavior).",
        )
        parser.add_argument(
            "--force-update",
            action="store_true",
            help="Also refresh flags + password on accounts that already exist.",
        )

    def handle(self, *args, **options):
        force_update = bool(options.get("force_update"))
        # --only-missing is the safe default; kept as an explicit flag for entrypoint docs.
        only_missing = bool(options.get("only_missing")) or not force_update

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
        skipped = 0
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

            existing = User.objects.filter(email__iexact=email).first()
            if existing:
                if only_missing and not force_update:
                    skipped += 1
                    continue
                for key, value in defaults.items():
                    setattr(existing, key, value)
                existing.set_password(password)
                existing.save()
                updated += 1
                continue

            user = User.objects.create(email=email, **defaults)
            user.set_password(password)
            user.save()
            created += 1

        # Primary FlowOps superadmin — create only if missing unless --force-update.
        flowops_defaults = {
            "username": "flowops",
            "first_name": "FlowOps",
            "last_name": "Admin",
            "country": "Kenya",
            "state": "Nairobi",
            "gender": "male",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "is_verified": True,
            "is_onboarded": True,
        }
        flowops_password = os.environ.get("FLOWOPS_SUPERADMIN_PASSWORD") or password
        flowops = User.objects.filter(email__iexact=FLOWOPS_SUPERADMIN_EMAIL).first()
        if flowops:
            if force_update:
                for key, value in flowops_defaults.items():
                    setattr(flowops, key, value)
                flowops.set_password(flowops_password)
                flowops.save()
                updated += 1
            else:
                skipped += 1
        else:
            flowops = User.objects.create(
                email=FLOWOPS_SUPERADMIN_EMAIL, **flowops_defaults
            )
            flowops.set_password(flowops_password)
            flowops.save()
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Admins ready. created={created} updated={updated} skipped={skipped} "
                f"(force_update={force_update}); superadmin={FLOWOPS_SUPERADMIN_EMAIL}"
            )
        )
