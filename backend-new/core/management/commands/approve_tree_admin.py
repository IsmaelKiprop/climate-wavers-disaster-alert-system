"""
Approve Tree Admin for a user (optional CLI). Prefer Django admin after deploy:
  Api → Users → select user → Action → Approve as Tree Admin

Usage:
  python manage.py approve_tree_admin --email sheegobo2018@gmail.com
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core.tree_admin import approve_user_as_tree_admin

User = get_user_model()


class Command(BaseCommand):
    help = "Approve Tree Admin access for a user (creates org if none exists)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User email to approve")
        parser.add_argument("--org-name", default="", help="Organization name override")
        parser.add_argument("--plan", default="pilot", help="Plan key (default: pilot)")

    def handle(self, *args, **options):
        email = (options["email"] or "").strip().lower()
        if not email:
            raise CommandError("--email is required")

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user found with email {email}")

        org, _membership, created = approve_user_as_tree_admin(
            user,
            org_name=options.get("org_name") or "",
            plan=options.get("plan") or "pilot",
        )
        verb = "Created + approved" if created else "Approved"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} Tree Admin for {user.email} · org={org.name} · "
                f"plan={org.plan} · status={org.verification_status}"
            )
        )
