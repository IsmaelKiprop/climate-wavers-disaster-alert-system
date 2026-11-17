"""Ensure hello@flowops.africa is the Platform superadmin (bootstrap only)."""

import os

from django.core.management.base import BaseCommand

from api.models import User

EMAIL = "hello@flowops.africa"
DEFAULT_PASSWORD = "admin123"


class Command(BaseCommand):
    help = (
        "Create hello@flowops.africa as superuser + staff if missing. "
        "Does not recreate after delete unless --force-update."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=(
                os.environ.get("FLOWOPS_SUPERADMIN_PASSWORD")
                or os.environ.get("ADMIN_DEFAULT_PASSWORD")
                or os.environ.get("DJANGO_SUPERUSER_PASSWORD")
                or DEFAULT_PASSWORD
            ),
            help="Password to set when creating / force-updating",
        )
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help="Create only if the account does not exist (default).",
        )
        parser.add_argument(
            "--force-update",
            action="store_true",
            help="Refresh flags + password even if the account already exists.",
        )

    def handle(self, *args, **options):
        password = options["password"]
        force_update = bool(options.get("force_update"))
        only_missing = bool(options.get("only_missing")) or not force_update

        defaults = {
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
        user = User.objects.filter(email__iexact=EMAIL).first()
        if user:
            if only_missing and not force_update:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Skipped {EMAIL} (already exists; use --force-update to refresh)"
                    )
                )
                return
            for key, value in defaults.items():
                setattr(user, key, value)
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated {EMAIL} (superuser={user.is_superuser}, staff={user.is_staff})"
                )
            )
            return

        user = User.objects.create(email=EMAIL, **defaults)
        user.set_password(password)
        user.save()
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {EMAIL} (superuser={user.is_superuser}, staff={user.is_staff})"
            )
        )
