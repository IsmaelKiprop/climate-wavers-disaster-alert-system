from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

DEFAULT_EMAILS = (
    "hello@flowops.africa",
    "flowopsafrica@gmail.com",
)


class Command(BaseCommand):
    help = "Grant Tree Admin (is_staff) to Climate Wavers organizer accounts"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            action="append",
            dest="emails",
            help="Email to promote. Can be passed multiple times.",
        )

    def handle(self, *args, **options):
        emails = options.get("emails") or list(DEFAULT_EMAILS)
        for email in emails:
            email = str(email or "").strip().lower()
            if not email:
                continue
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                self.stdout.write(self.style.WARNING(f"No user for {email}"))
                continue
            user.is_staff = True
            user.is_verified = True
            user.is_active = True
            user.save(update_fields=["is_staff", "is_verified", "is_active"])
            self.stdout.write(self.style.SUCCESS(f"Granted Tree Admin to {email} (id={user.id})"))
