"""Ensure hello@flowops.africa is the Platform superadmin with a known password."""

import os

from django.core.management.base import BaseCommand

from api.models import User

EMAIL = "hello@flowops.africa"
DEFAULT_PASSWORD = "admin123"


class Command(BaseCommand):
    help = "Create/update hello@flowops.africa as superuser + staff"

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=(
                os.environ.get("FLOWOPS_SUPERADMIN_PASSWORD")
                or os.environ.get("ADMIN_DEFAULT_PASSWORD")
                or os.environ.get("DJANGO_SUPERUSER_PASSWORD")
                or DEFAULT_PASSWORD
            ),
            help="Password to set (default: env or admin123)",
        )

    def handle(self, *args, **options):
        password = options["password"]
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
        user, created = User.objects.get_or_create(email=EMAIL, defaults=defaults)
        for key, value in defaults.items():
            setattr(user, key, value)
        user.set_password(password)
        user.save()
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Created' if created else 'Updated'} {EMAIL} "
                f"(superuser={user.is_superuser}, staff={user.is_staff})"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                "Password set from --password / FLOWOPS_SUPERADMIN_PASSWORD / "
                "ADMIN_DEFAULT_PASSWORD (change after login)."
            )
        )
