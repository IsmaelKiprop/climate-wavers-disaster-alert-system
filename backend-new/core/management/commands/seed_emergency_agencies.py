from django.core.management.base import BaseCommand

from core.models import EmergencyAgency

# Starter Kenya / Nairobi directory — editable in admin.
KENYA_SEED = [
    {
        "name": "Kenya Red Cross Society HQ",
        "agency_type": "red_cross",
        "phone": "+254703037000",
        "email": "info@redcross.or.ke",
        "whatsapp_opt_in": False,
        "latitude": "-1.2921",
        "longitude": "36.8219",
        "country": "Kenya",
        "city": "Nairobi",
    },
    {
        "name": "Nairobi Fire Brigade",
        "agency_type": "fire",
        "phone": "+254722516939",
        "email": None,
        "whatsapp_opt_in": False,
        "latitude": "-1.2864",
        "longitude": "36.8172",
        "country": "Kenya",
        "city": "Nairobi",
    },
    {
        "name": "Kenya Police Emergency",
        "agency_type": "police",
        "phone": "999",
        "email": None,
        "whatsapp_opt_in": False,
        "latitude": "-1.2921",
        "longitude": "36.8219",
        "country": "Kenya",
        "city": "Nairobi",
    },
    {
        "name": "Nairobi County Disaster Management",
        "agency_type": "county",
        "phone": "+254202217474",
        "email": None,
        "whatsapp_opt_in": False,
        "latitude": "-1.286389",
        "longitude": "36.817223",
        "country": "Kenya",
        "city": "Nairobi",
    },
    {
        "name": "St John Ambulance Kenya",
        "agency_type": "medical",
        "phone": "+254722226285",
        "email": None,
        "whatsapp_opt_in": False,
        "latitude": "-1.2833",
        "longitude": "36.8167",
        "country": "Kenya",
        "city": "Nairobi",
    },
]


class Command(BaseCommand):
    help = "Seed starter EmergencyAgency rows for Kenya / Nairobi."

    def handle(self, *args, **options):
        created = 0
        for row in KENYA_SEED:
            obj, was_created = EmergencyAgency.objects.update_or_create(
                name=row["name"],
                defaults={
                    "agency_type": row["agency_type"],
                    "phone": row["phone"],
                    "email": row["email"],
                    "whatsapp_opt_in": row["whatsapp_opt_in"],
                    "latitude": row["latitude"],
                    "longitude": row["longitude"],
                    "country": row["country"],
                    "city": row["city"],
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Emergency agencies ready. Created {created}, total {EmergencyAgency.objects.count()}."
            )
        )
