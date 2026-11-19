"""
Fix inflated admin_share / funds_raised from the old KES-as-USD bug.

  python manage.py repair_tree_funds
  python manage.py repair_tree_funds --project-id 12
"""

from django.core.management.base import BaseCommand

from core.models import TreeProject
from core.tree_pricing import (
    repair_all_tree_project_funds,
    repair_donation_fee_split,
    recompute_project_funds_raised,
)


class Command(BaseCommand):
    help = "Repair tree donation fee splits and recompute funds_raised in USD"

    def add_arguments(self, parser):
        parser.add_argument("--project-id", type=int, default=None)

    def handle(self, *args, **options):
        project_id = options.get("project_id")
        if project_id:
            project = TreeProject.objects.filter(pk=project_id).first()
            if not project:
                self.stderr.write(self.style.ERROR(f"Project {project_id} not found"))
                return
            fixed = 0
            for d in project.donations.filter(payment_status="completed").select_related(
                "project", "project__tree_admin_org"
            ):
                if repair_donation_fee_split(d, project, save=True):
                    fixed += 1
            total = recompute_project_funds_raised(project)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Project {project_id}: repaired {fixed} donations; "
                    f"funds_raised=${total}"
                )
            )
            return

        result = repair_all_tree_project_funds()
        self.stdout.write(
            self.style.SUCCESS(
                f"Repaired {result['donations_repaired']} donations; "
                f"recomputed {result['projects_recomputed']} projects"
            )
        )
