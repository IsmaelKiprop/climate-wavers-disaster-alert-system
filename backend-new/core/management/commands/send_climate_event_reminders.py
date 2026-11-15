from django.core.management.base import BaseCommand

from core.climate_events import send_climate_event_reminders


class Command(BaseCommand):
    help = "Send T-60 / T-10 Climate Action Calendar reminders"

    def handle(self, *args, **options):
        result = send_climate_event_reminders()
        self.stdout.write(self.style.SUCCESS(str(result)))
