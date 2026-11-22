"""
Null out offshore / IP-blunder GPS on Kenya (East Africa) plastic + tree records.

Desktop Chrome often saves Mumbai/India coords for Eldoret field work.
Those pins must not stay on the public impact map as if they were accurate.

Usage:
  python manage.py clear_inaccurate_gps
  python manage.py clear_inaccurate_gps --dry-run
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from core.models import (
    PlasticHoldingZone,
    PlasticHotspot,
    PlasticProject,
    PlasticRecovery,
    TreeProject,
    TreeProjectDonation,
    TreeProjectUpdate,
)


def _in_east_africa(lat, lng) -> bool:
    try:
        return -5.5 <= float(lat) <= 5.5 and 29.0 <= float(lng) <= 42.5
    except (TypeError, ValueError):
        return False


def _bad(lat, lng) -> bool:
    if lat is None or lng is None:
        return False
    return not _in_east_africa(lat, lng)


class Command(BaseCommand):
    help = "Clear inaccurate (non–East Africa) GPS pins on local projects"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report only; do not write",
        )

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        cleared = 0

        # Only nullable coordinate fields — PlasticHotspot lat/lng are required.
        targets = (
            (PlasticRecovery, ("latitude", "longitude"), True),
            (PlasticHoldingZone, ("latitude", "longitude"), True),
            (PlasticProject, ("latitude", "longitude"), True),
            (TreeProject, ("latitude", "longitude"), True),
            (TreeProjectUpdate, ("latitude", "longitude"), True),
            (TreeProjectDonation, ("survival_lat", "survival_lng"), True),
        )

        for model, fields, _nullable in targets:
            qs = model.objects.exclude(
                **{f"{fields[0]}__isnull": True}
            ).exclude(**{f"{fields[1]}__isnull": True})
            if hasattr(model, "country"):
                qs = qs.filter(
                    Q(country__icontains="kenya")
                    | Q(country__iexact="KE")
                    | Q(country="")
                    | Q(country__isnull=True)
                )
            elif hasattr(model, "project"):
                qs = qs.filter(
                    Q(project__country__icontains="kenya")
                    | Q(project__country__iexact="KE")
                    | Q(project__country="")
                    | Q(project__region__icontains="eldoret")
                    | Q(project__city__icontains="eldoret")
                    | Q(project__city__icontains="nairobi")
                )

            for row in qs.iterator(chunk_size=200):
                lat = getattr(row, fields[0], None)
                lng = getattr(row, fields[1], None)
                if not _bad(lat, lng):
                    continue
                cleared += 1
                self.stdout.write(
                    f"{'Would clear' if dry else 'Clearing'} "
                    f"{model.__name__}#{row.pk} ({lat}, {lng})"
                )
                if not dry:
                    setattr(row, fields[0], None)
                    setattr(row, fields[1], None)
                    row.save(update_fields=list(fields))

        # Hotspots require lat/lng — report bad ones so they can be re-pinned on site.
        for h in PlasticHotspot.objects.select_related("project").iterator(
            chunk_size=200
        ):
            if _bad(h.latitude, h.longitude):
                self.stdout.write(
                    self.style.WARNING(
                        f"Hotspot#{h.id} has inaccurate GPS ({h.latitude}, {h.longitude}) "
                        f"— re-pin on site with precise phone GPS."
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"{'Dry-run: ' if dry else ''}{cleared} inaccurate GPS pin(s) handled."
            )
        )
