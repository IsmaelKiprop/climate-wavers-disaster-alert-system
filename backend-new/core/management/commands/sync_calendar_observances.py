from django.core.management.base import BaseCommand

from core.calendar_observances import sync_observance_catalog


class Command(BaseCommand):
    help = "Sync curated UN / government climate calendar observances"

    def handle(self, *args, **options):
        result = sync_observance_catalog()
        self.stdout.write(
            self.style.SUCCESS(
                f"Observances synced — created={result['created']}, "
                f"updated={result['updated']}, total={result['total']}"
            )
        )
