from django.core.management.base import BaseCommand

from core.models import OfficialAlertEvent
from core.waverx_twitter import tweet_climate_tip, tweet_verified_alert, twitter_enabled
from core.waverx_voice import compose_tip_variants


class Command(BaseCommand):
    help = "Publish WaverX broadcasts to the free in-app feed (verified alerts / climate tips)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tip",
            action="store_true",
            help="Post today's climate / environment tip",
        )
        parser.add_argument(
            "--alerts",
            action="store_true",
            help="Tweet recent official alerts that have not been posted yet",
        )
        parser.add_argument(
            "--event-id",
            type=str,
            default="",
            help="Tweet a specific OfficialAlertEvent.event_id",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=5,
            help="Max alerts to tweet when using --alerts",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force a new tip even if one was already posted today",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Compose without calling the X API",
        )
        parser.add_argument(
            "--preview-tips",
            type=int,
            default=0,
            help="Print N tip variants and exit",
        )
        parser.add_argument(
            "--no-polish",
            action="store_true",
            help="Skip optional OpenAI polish even if enabled",
        )

    def handle(self, *args, **options):
        polish = not options["no_polish"]
        dry = options["dry_run"]

        if options["preview_tips"]:
            for tip in compose_tip_variants(options["preview_tips"]):
                self.stdout.write(tip)
                self.stdout.write("---")
            return

        if not options["tip"] and not options["alerts"] and not options["event_id"]:
            options["tip"] = True

        self.stdout.write(
            f"feed=on paid_x_api={twitter_enabled()} dry_run={dry}"
        )

        if options["tip"]:
            result = tweet_climate_tip(dry_run=dry, polish=polish, force=options["force"])
            self.stdout.write(self.style.SUCCESS(f"TIP: {result}"))

        if options["event_id"]:
            ev = OfficialAlertEvent.objects.filter(event_id=options["event_id"]).first()
            if not ev:
                self.stderr.write(f"No OfficialAlertEvent for {options['event_id']}")
            else:
                result = tweet_verified_alert(self._event_dict(ev), dry_run=dry, polish=polish)
                self.stdout.write(self.style.SUCCESS(f"ALERT: {result}"))

        if options["alerts"]:
            qs = OfficialAlertEvent.objects.order_by("-created_at")[: max(1, options["limit"] * 3)]
            posted = 0
            for ev in qs:
                if posted >= options["limit"]:
                    break
                result = tweet_verified_alert(self._event_dict(ev), dry_run=dry, polish=polish)
                if result.get("deduped"):
                    continue
                self.stdout.write(f"ALERT {ev.event_id}: {result.get('text') or result}")
                posted += 1
            self.stdout.write(self.style.SUCCESS(f"Processed up to {posted} alert tweets"))

    def _event_dict(self, ev: OfficialAlertEvent) -> dict:
        payload = ev.payload if isinstance(ev.payload, dict) else {}
        return {
            "id": ev.event_id,
            "event_id": ev.event_id,
            "title": ev.title,
            "disaster_type": ev.disaster_type or payload.get("disaster_type"),
            "magnitude": float(ev.magnitude) if ev.magnitude is not None else payload.get("magnitude"),
            "city": payload.get("city"),
            "region": payload.get("region"),
            "country": payload.get("country"),
            "official_source": ev.source,
            "source": ev.source,
            "source_url": ev.source_url or payload.get("source_url"),
            "ai_summary": ev.ai_summary,
            "aiSummary": ev.ai_summary,
            "isOfficial": True,
            "is_official": True,
        }
