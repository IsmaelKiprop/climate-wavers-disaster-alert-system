"""
Seed Kenya plastic recycler directory for direct CBO → recycler sales
(Nairobi, Eldoret, Mombasa, Kisumu).

Run: python manage.py seed_plastic_recyclers
"""

from django.core.management.base import BaseCommand

from core.models import PlasticRecyclerPartner

# Research snapshot for Plastic Pulse ground ops (~120 kg/week across 3 zones).
# accepts_small_lots=True = realistic for CBO-scale lots; False = usually needs
# aggregation or larger volumes (often 1+ tonne/week).
DIRECTORY = [
    # --- Nairobi ---
    {
        "name": "Mr. Green Africa",
        "city": "Nairobi",
        "contact_phone": "+254757204782",
        "contact_email": "contact@mrgreentrading.com",
        "website": "https://www.mrgreenafrica.com/",
        "address": "Old Yana Tyres Complex, Mombasa Rd & Enterprise Rd Junction, Nairobi",
        "materials_accepted": ["PET", "HDPE", "PP"],
        "buy_rates": {"PET": 28, "HDPE": 25, "PP": 20},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": (
            "Site lists email + WhatsApp/phone +254 757 204 782. "
            "Also +254 715 330 871 on some directories. Mon–Fri 8am–5pm."
        ),
    },
    {
        "name": "EcoPost Limited",
        "city": "Nairobi",
        "contact_phone": "+254725351032",
        "contact_email": "info@ecopost.co.ke",
        "website": "https://www.ecopost.co.ke/",
        "address": "Baba Dogo Rd, Ruaraka, Nairobi",
        "materials_accepted": ["HDPE", "PP", "LDPE"],
        "buy_rates": {"HDPE": 25, "PP": 20, "LDPE": 15},
        "min_buy_kg": 1000,
        "accepts_small_lots": False,
        "notes": (
            "Explicit WhatsApp for suppliers: +254 725 351 032 or +254 721 953 768. "
            "Email photos + KES/kg offer to info@ecopost.co.ke. Often wants 1+ tonne/week."
        ),
    },
    {
        "name": "Dawn to Glow International",
        "city": "Nairobi",
        "contact_phone": "+254726686922",
        "contact_email": "sales@dawntoglow.co.ke",
        "website": "https://dawntoglow.co.ke/",
        "address": "Industrial Area, Road C off Likoni, Adjacent to Winners Chapel, Nairobi",
        "materials_accepted": ["PET", "HDPE", "PP"],
        "buy_rates": {"PET": 22, "HDPE": 20, "PP": 15},
        "min_buy_kg": 100,
        "accepts_small_lots": True,
        "notes": "Call/WhatsApp +254 726 686 922 · sales@dawntoglow.co.ke. PET flakes / HDPE / PP.",
    },
    {
        "name": "Kaspulkhan Scrap Metals — Plastics",
        "city": "Nairobi",
        "contact_phone": "+254715628364",
        "contact_email": "info@kaspulkhan-scrapmetals.co.ke",
        "website": "https://kaspulkhan-scrapmetals.co.ke/",
        "address": "Utawala Shopping Center, Kincar Opposite Utawala Health Center, Nairobi",
        "materials_accepted": ["PET", "HDPE", "LDPE", "PP", "PVC"],
        "buy_rates": {"PET": 18, "HDPE": 20, "LDPE": 12, "PP": 15},
        "min_buy_kg": 20,
        "accepts_small_lots": True,
        "notes": (
            "Explicit WhatsApp +254 715 628 364. Also 0759 117 930. "
            "Email info@kaspulkhan-scrapmetals.co.ke."
        ),
    },
    {
        "name": "Ovision EcoSmart Africa",
        "city": "Nairobi",
        "contact_phone": "+254717366984",
        "contact_email": "info@ovisionecosmartafrica.com",
        "website": "https://ovisionecosmartafrica.com/",
        "address": "Namarayan Warehouse, Nairobi",
        "materials_accepted": ["HDPE", "PP", "LDPE", "PET"],
        "buy_rates": {"PET": 20, "HDPE": 25, "PP": 18, "LDPE": 12},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": "Phone/WhatsApp +254 717 366 984 · info@ovisionecosmartafrica.com. Multi-county network.",
    },
    {
        "name": "Vintz Plastics",
        "city": "Nairobi",
        "contact_phone": "+254724764862",
        "contact_email": "info@vintzplastics.com",
        "website": "https://vintzplastics.com/",
        "address": "Off Airport North Road / Vintz Recycling Centre, Embakasi, Nairobi",
        "materials_accepted": ["HDPE", "PP", "LDPE", "hard_plastics"],
        "buy_rates": {},
        "min_buy_kg": 100,
        "accepts_small_lots": True,
        "notes": (
            "Emails: info@vintzplastics.com, recycle@vintzplastics.com. "
            "Phones: +254 724 764 862, +254 702 676 767 (secretary). "
            "Also Vanita Halai +254 717 243 365. Centres in Nairobi, Mombasa, Kisumu, Nakuru."
        ),
    },
    # --- Eldoret ---
    {
        "name": "Old Uganda Road Enterprises Limited",
        "city": "Eldoret",
        "contact_phone": "+254710883989",
        "contact_email": "oldugandaroadentltd@gmail.com",
        "website": "https://ourel.co.ke/",
        "address": "Along Mitaa Road, next to RVC / Prince of Peace Church, Mwanzo, Eldoret",
        "materials_accepted": ["PET", "HDPE", "glass", "mixed"],
        "buy_rates": {"PET": 15, "HDPE": 18, "mixed": 12},
        "min_buy_kg": 30,
        "accepts_small_lots": True,
        "notes": (
            "WhatsApp/phone: 0710883989 (also 0714401345, 0717636367). "
            "Email: oldugandaroadentltd@gmail.com. Best first Eldoret contact."
        ),
    },
    {
        "name": "Mazingira Recyclers (Uasin Gishu supply)",
        "city": "Eldoret",
        "contact_phone": "+254113941934",
        "contact_email": "sales@mazingirarecyclers.com",
        "website": "https://www.mazingirarecyclers.com/",
        "address": "Serves Eldoret / Uasin Gishu (yards mainly Mt Kenya region + Nairobi Wangige)",
        "materials_accepted": ["HDPE", "PP", "LDPE", "mixed"],
        "buy_rates": {},
        "min_buy_kg": 200,
        "accepts_small_lots": False,
        "notes": (
            "Phone/WhatsApp: +254 113 941 934 · sales@mazingirarecyclers.com. "
            "Confirm scrap buy terms; may need larger/pre-shredded lots."
        ),
    },
    {
        "name": "Kiseki Limited (Eldoret network)",
        "city": "Eldoret",
        "contact_phone": "+254780315744",
        "contact_email": "info@kiseki.co.ke",
        "website": "https://kiseki.co.ke/",
        "address": "HQ: Warehouse 5&6 Velka Business Park, Maanzoni, Athi River (network includes Eldoret)",
        "materials_accepted": ["PET", "HDPE", "glass", "cans"],
        "buy_rates": {},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": "Nationwide centres incl. Eldoret/Mombasa/Kisumu/Nairobi. Phone +254 780 315 744.",
    },
    # --- Mombasa ---
    {
        "name": "Jil Industries Ltd",
        "city": "Mombasa",
        "contact_phone": "+254708267507",
        "contact_email": "",
        "website": "https://www.jilindustries.co.ke/",
        "address": "Bamburi Mtambo, Mombasa",
        "materials_accepted": ["PP", "HDPE", "LDPE"],
        "buy_rates": {"PP": 20, "HDPE": 22, "LDPE": 12},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": (
            "WhatsApp/phone: +254 708 267 507 (listed Call on WhatsApp). "
            "No public email on website — use WhatsApp for CBO supply offers."
        ),
    },
    {
        "name": "Vintz Plastics — Mombasa",
        "city": "Mombasa",
        "contact_phone": "+254724764862",
        "contact_email": "recycle@vintzplastics.com",
        "website": "https://vintzplastics.com/",
        "address": "Mombasa collection centre",
        "materials_accepted": ["HDPE", "PP", "LDPE", "hard_plastics"],
        "buy_rates": {},
        "min_buy_kg": 100,
        "accepts_small_lots": True,
        "notes": "Use Vintz HQ contacts; ask for Mombasa intake days before dispatch.",
    },
    {
        "name": "Ovision EcoSmart Africa — Mombasa",
        "city": "Mombasa",
        "contact_phone": "+254717366984",
        "contact_email": "info@ovisionecosmartafrica.com",
        "website": "https://ovisionecosmartafrica.com/",
        "address": "Mombasa coastal operations",
        "materials_accepted": ["HDPE", "PP", "LDPE", "PET"],
        "buy_rates": {"PET": 20, "HDPE": 25, "PP": 18, "LDPE": 12},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": "Phone +254 717 366 984 · info@ovisionecosmartafrica.com. Ask for coastal aggregation point.",
    },
    # --- Kisumu ---
    {
        "name": "Gasia Poa — Kondele MRF",
        "city": "Kisumu",
        "contact_phone": "+254726801299",
        "contact_email": "",
        "website": "https://www.kisumu.go.ke/",
        "address": "Kondele West MRF, Kisumu Central (also Manyatta Community Biocentre)",
        "materials_accepted": ["PET", "HDPE", "heavy_plastics"],
        "buy_rates": {"PET": 10, "HDPE": 30, "heavy_plastics": 30},
        "min_buy_kg": 5,
        "accepts_small_lots": True,
        "notes": (
            "Phone: 0726 801 299 (Gasia Poa). Manager Dickens Ochieng. "
            "PET KSh 10/kg, heavy plastics KSh 30/kg. No public email found — call/WhatsApp."
        ),
    },
    {
        "name": "Vintz Plastics — Kisumu",
        "city": "Kisumu",
        "contact_phone": "+254702676767",
        "contact_email": "recycle@vintzplastics.com",
        "website": "https://vintzplastics.com/",
        "address": "Kisumu collection centre",
        "materials_accepted": ["HDPE", "PP", "LDPE", "hard_plastics"],
        "buy_rates": {},
        "min_buy_kg": 100,
        "accepts_small_lots": True,
        "notes": "Use Vintz HQ: info@ / recycle@vintzplastics.com · +254 724 764 862 / 702 676 767.",
    },
    {
        "name": "Ovision EcoSmart Africa — Kisumu",
        "city": "Kisumu",
        "contact_phone": "+254717366984",
        "contact_email": "info@ovisionecosmartafrica.com",
        "website": "https://ovisionecosmartafrica.com/",
        "address": "Kisumu lakeside network",
        "materials_accepted": ["HDPE", "PP", "LDPE", "PET"],
        "buy_rates": {"PET": 20, "HDPE": 25, "PP": 18, "LDPE": 12},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": "Same HQ contacts for Kisumu network: +254 717 366 984.",
    },
    {
        "name": "Kiseki Limited (Kisumu network)",
        "city": "Kisumu",
        "contact_phone": "+254780315744",
        "contact_email": "info@kiseki.co.ke",
        "website": "https://kiseki.co.ke/",
        "address": "Collection centre network includes Kisumu",
        "materials_accepted": ["PET", "HDPE", "glass", "cans"],
        "buy_rates": {},
        "min_buy_kg": 50,
        "accepts_small_lots": True,
        "notes": "info@kiseki.co.ke · +254 780 315 744 — ask for Kisumu centre hours.",
    },
]


class Command(BaseCommand):
    help = "Seed Nairobi / Eldoret / Mombasa / Kisumu plastic recycler directory"

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for row in DIRECTORY:
            obj, was_created = PlasticRecyclerPartner.objects.update_or_create(
                name=row["name"],
                city=row["city"],
                defaults={
                    "contact_phone": row.get("contact_phone") or "",
                    "contact_email": row.get("contact_email") or "",
                    "website": row.get("website") or "",
                    "address": row.get("address") or "",
                    "materials_accepted": row.get("materials_accepted") or [],
                    "buy_rates": row.get("buy_rates") or {},
                    "min_buy_kg": row.get("min_buy_kg") or 0,
                    "accepts_small_lots": bool(row.get("accepts_small_lots", True)),
                    "notes": row.get("notes") or "",
                    "is_directory": True,
                    "is_active": True,
                    "organization": None,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
            self.stdout.write(f"  {'+' if was_created else '~'} {obj.city}: {obj.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Recycler directory ready: {created} created, {updated} updated "
                f"({len(DIRECTORY)} total)."
            )
        )
