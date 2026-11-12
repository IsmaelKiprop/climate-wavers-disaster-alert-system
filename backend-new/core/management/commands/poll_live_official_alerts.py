from django.core.management.base import BaseCommand

from core.ai_alert_summary import generate_alert_summary
from core.alerts import dispatch_disaster_alert
from core.live_feeds import fetch_live_official_events, passes_severity_gate
from core.models import OfficialAlertEvent
from core.waverx_twitter import tweet_verified_alert


class Command(BaseCommand):
    help = "Poll USGS/NASA live feeds and fan out new alerts to opted-in users and nearby agencies."

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-magnitude",
            type=float,
            default=4.5,
            help="Minimum earthquake magnitude to alert (default 4.5)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List new events without sending",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=25,
            help="Max new events to process per run",
        )

    def handle(self, *args, **options):
        min_mag = options["min_magnitude"]
        dry = options["dry_run"]
        limit = options["limit"]

        events = fetch_live_official_events()
        new_count = 0
        sent = 0

        for event in events:
            event_id = str(event.get("id") or "").strip()
            if not event_id:
                continue
            if not passes_severity_gate(event, min_magnitude=min_mag):
                continue
            if OfficialAlertEvent.objects.filter(event_id=event_id).exists():
                continue

            new_count += 1
            if new_count > limit:
                break

            summary = generate_alert_summary(event)
            payload = {
                "id": event_id,
                "city": event.get("city") or "",
                "region": event.get("region") or "",
                "country": event.get("country") or "",
                "disasterType": event.get("disaster_type") or "disaster",
                "latitude": event.get("latitude"),
                "longitude": event.get("longitude"),
                "magnitude": event.get("magnitude"),
                "official_source": event.get("official_source"),
                "source_url": event.get("source_url"),
                "isOfficial": True,
                "aiSummary": summary,
                "deepLink": None,
            }

            self.stdout.write(
                f"NEW {event.get('official_source')} {event_id}: {event.get('title')}"
            )

            if dry:
                OfficialAlertEvent.objects.create(
                    event_id=event_id,
                    source=event.get("official_source") or "official",
                    title=(event.get("title") or "")[:300],
                    disaster_type=event.get("disaster_type") or "",
                    magnitude=event.get("magnitude"),
                    latitude=event.get("latitude"),
                    longitude=event.get("longitude"),
                    source_url=event.get("source_url") or None,
                    payload=event,
                    ai_summary=summary,
                    fanout_result={"dry_run": True},
                )
                continue

            result = dispatch_disaster_alert(payload)
            try:
                tweet_result = tweet_verified_alert(payload, dry_run=False)
                result["waverx_tweet"] = {
                    "ok": tweet_result.get("ok"),
                    "tweet_id": tweet_result.get("tweet_id"),
                    "deduped": tweet_result.get("deduped"),
                    "skipped": tweet_result.get("skipped"),
                }
            except Exception as exc:
                result["waverx_tweet"] = {"ok": False, "error": str(exc)}
                self.stderr.write(f"WaverX tweet skipped for {event_id}: {exc}")
            OfficialAlertEvent.objects.create(
                event_id=event_id,
                source=event.get("official_source") or "official",
                title=(event.get("title") or "")[:300],
                disaster_type=event.get("disaster_type") or "",
                magnitude=event.get("magnitude"),
                latitude=event.get("latitude"),
                longitude=event.get("longitude"),
                source_url=event.get("source_url") or None,
                payload=event,
                ai_summary=summary,
                fanout_result=result,
            )
            sent += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Scanned {len(events)} events; new={new_count}; sent={sent}; dry={dry}"
            )
        )
