from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import EmergencyAgency, ResponderOrganization

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
    help = "Seed starter EmergencyAgency rows and approved RapidBrief sample for Kenya Red Cross."

    def handle(self, *args, **options):
        created = 0
        red_cross = None
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
            if row["agency_type"] == "red_cross" and row.get("email"):
                red_cross = obj

        responder_msg = "No RapidBrief sample (need Red Cross with email)."
        if red_cross:
            from core.pricing import start_pilot

            org, org_created = ResponderOrganization.objects.update_or_create(
                name=red_cross.name,
                defaults={
                    "org_type": "red_cross",
                    "agency": red_cross,
                    "country": red_cross.country,
                    "city": red_cross.city,
                    "latitude": red_cross.latitude,
                    "longitude": red_cross.longitude,
                    "coverage_radius_km": 150,
                    "disaster_types": [],
                    "contact_email": red_cross.email,
                    "contact_phone": red_cross.phone,
                    "whatsapp_opt_in": False,
                    "verification_status": "approved",
                    "verified_at": timezone.now(),
                    "plan": "ngo",
                },
            )
            start_pilot(org, "ngo")
            org.save()
            responder_msg = (
                f"RapidBrief sample {'created' if org_created else 'updated'}: {org.name} "
                f"(approved, {org.plan_status})."
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Emergency agencies ready. Created {created}, total {EmergencyAgency.objects.count()}. {responder_msg}"
            )
        )
