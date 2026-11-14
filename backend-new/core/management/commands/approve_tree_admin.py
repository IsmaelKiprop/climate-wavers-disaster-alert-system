"""
Create (if missing) and approve a Tree Admin org for a user.

Usage (Render Shell):
  python manage.py approve_tree_admin --email sheegobo2018@gmail.com
  python manage.py approve_tree_admin --email sheegobo2018@gmail.com --org-name "Shee Gobo Mz"
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.models import TreeAdminMembership, TreeAdminOrganization
from core.tree_pricing import start_tree_pilot

User = get_user_model()


class Command(BaseCommand):
    help = "Approve Tree Admin access for a user (creates pending org if none exists)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User email to approve")
        parser.add_argument(
            "--org-name",
            default="",
            help="Organization name (defaults to user full name / email)",
        )
        parser.add_argument(
            "--plan",
            default="pilot",
            help="Tree Admin plan key (default: pilot)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = (options["email"] or "").strip().lower()
        if not email:
            raise CommandError("--email is required")

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f"No user found with email {email}")

        membership = (
            TreeAdminMembership.objects.filter(user=user)
            .select_related("org")
            .order_by("-created_at")
            .first()
        )

        if membership:
            org = membership.org
            self.stdout.write(f"Found existing org: {org.name} (id={org.id})")
        else:
            org_name = (options["org_name"] or "").strip()
            if not org_name:
                org_name = (
                    f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
                    or user.username
                    or email.split("@")[0]
                )
            org = TreeAdminOrganization.objects.create(
                name=org_name[:200],
                org_type="cbo",
                country=(user.country or "Kenya")[:100] or "Kenya",
                city=(user.state or user.location or "")[:100] or None,
                contact_email=user.email,
                contact_phone=(user.phone or None),
                plan=(options["plan"] or "pilot"),
                plan_status="pending",
                verification_status="pending",
                created_by=user,
            )
            membership = TreeAdminMembership.objects.create(
                org=org, user=user, role="owner"
            )
            self.stdout.write(self.style.SUCCESS(f"Created org: {org.name} (id={org.id})"))

        org.verification_status = "approved"
        org.verified_at = timezone.now()
        start_tree_pilot(org)
        org.save()

        user.is_staff = True
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_staff", "is_verified", "is_active"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Approved Tree Admin for {user.email} · org={org.name} · "
                f"plan={org.plan} · plan_status={org.plan_status}"
            )
        )
