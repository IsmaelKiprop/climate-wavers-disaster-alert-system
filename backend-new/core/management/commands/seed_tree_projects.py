from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from core.models import TreeProject

User = get_user_model()

OFFICIAL_CONTACT = "hello@flowops.africa"
SEED_APPLIED_GROUP = "cw_tree_seed_applied"


class Command(BaseCommand):
    help = (
        "Seed official Climate Wavers / FlowOps Africa tree campaigns. "
        "Safe by default: does not recreate campaigns you deleted, "
        "and does not overwrite existing projects on each deploy."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--recreate-missing",
            action="store_true",
            help="Recreate seed campaigns that were deleted (off by default).",
        )
        parser.add_argument(
            "--update-existing",
            action="store_true",
            help="Overwrite fields on seed campaigns that still exist.",
        )

    def handle(self, *args, **options):
        recreate_missing = bool(options["recreate_missing"])
        update_existing = bool(options["update_existing"])

        org_user, created = User.objects.get_or_create(
            email=OFFICIAL_CONTACT,
            defaults={
                "username": "climatewavers",
                "first_name": "Ismael",
                "last_name": "Kiprop",
                "country": "Kenya",
                "state": "Nairobi",
                "gender": "male",
                "is_staff": True,
                "is_verified": True,
                "is_active": True,
            },
        )
        if created:
            org_user.set_unusable_password()
            org_user.save()
            self.stdout.write(self.style.SUCCESS("Created Climate Wavers organization user"))

        campaigns = [
            {
                "name": "Nairobi Urban Canopy",
                "description": (
                    "Official Climate Wavers campaign, run from Nairobi with FlowOps Africa. "
                    "Funds plant indigenous shade trees in public corridors around Karura and "
                    "adjacent neighbourhoods. Trees planted stay at zero until a verified "
                    "planting update is posted."
                ),
                "short_description": "Indigenous shade trees for Nairobi public corridors.",
                "organization_name": "Climate Wavers",
                "organization_description": (
                    "Climate Wavers is the live disaster-alert product of FlowOps Africa, based in Nairobi."
                ),
                "organization_website": "https://www.flowops.africa/",
                "country": "Kenya",
                "region": "Nairobi County",
                "city": "Nairobi",
                "latitude": Decimal("-1.2500"),
                "longitude": Decimal("36.8300"),
                "address": "Karura Forest, Nairobi",
                "project_type": "urban_greening",
                "target_trees": 2500,
                "trees_planted": 0,
                "tree_species": ["Croton megalocarpus", "Markhamia lutea", "Acacia xanthophloea"],
                "tree_price": Decimal("5.00"),
                "co2_absorption_per_tree": Decimal("22.0"),
                "biodiversity_impact": "Native canopy for urban birds and pollinators along Nairobi forest edges.",
                "soil_improvement": "Reduces runoff on compacted roadside soils.",
                "water_conservation": "Shade slows evaporation on exposed public ground.",
                "cover_image": "/nairobi-urban-canopy.jpg",
                "start_date": date.today() - timedelta(days=21),
                "expected_completion": date.today() + timedelta(days=365),
                "total_budget": Decimal("12500.00"),
                "funds_raised": Decimal("0.00"),
                "funding_goal": Decimal("12500.00"),
                "contact_person": "Ismael Kiprop",
                "contact_email": OFFICIAL_CONTACT,
                "status": "active",
                "is_verified": True,
            },
            {
                "name": "Nairobi School Shade Belt",
                "description": (
                    "A Climate Wavers school-yard planting belt in Nairobi. Each donation is tied "
                    "to a named school plot. Counts stay at zero until Climate Wavers posts a "
                    "verified planting update."
                ),
                "short_description": "Shade trees for Nairobi school yards.",
                "organization_name": "Climate Wavers",
                "organization_description": (
                    "Climate Wavers is the live disaster-alert product of FlowOps Africa, based in Nairobi."
                ),
                "organization_website": "https://www.flowops.africa/",
                "country": "Kenya",
                "region": "Nairobi County",
                "city": "Nairobi",
                "latitude": Decimal("-1.2921"),
                "longitude": Decimal("36.8219"),
                "address": "Nairobi public schools",
                "project_type": "school_garden",
                "target_trees": 1200,
                "trees_planted": 0,
                "tree_species": ["Grevillea robusta", "Mango", "Neem"],
                "tree_price": Decimal("4.00"),
                "co2_absorption_per_tree": Decimal("18.0"),
                "biodiversity_impact": "School-yard canopy and fruit trees for learners and local pollinators.",
                "soil_improvement": "Mulched pits on compacted school grounds.",
                "water_conservation": "Shade reduces irrigation demand in dry terms.",
                "cover_image": "/nairobi-school-shade.jpg",
                "start_date": date.today() - timedelta(days=7),
                "expected_completion": date.today() + timedelta(days=300),
                "total_budget": Decimal("4800.00"),
                "funds_raised": Decimal("0.00"),
                "funding_goal": Decimal("4800.00"),
                "contact_person": "Ismael Kiprop",
                "contact_email": OFFICIAL_CONTACT,
                "status": "active",
                "is_verified": True,
            },
        ]

        seed_group, _ = Group.objects.get_or_create(name=SEED_APPLIED_GROUP)
        seed_already_applied = seed_group.user_set.filter(pk=org_user.pk).exists()

        # Snapshot before this run: if seed ran before (or org already has
        # projects), missing seed names were intentionally deleted.
        already_managed = (
            seed_already_applied
            or TreeProject.objects.filter(organization=org_user).exists()
            or TreeProject.objects.filter(contact_email__iexact=OFFICIAL_CONTACT).exists()
        )

        created_n = 0
        updated_n = 0
        skipped_n = 0

        for project_data in campaigns:
            existing = TreeProject.objects.filter(name=project_data["name"]).first()
            if existing:
                if update_existing:
                    for key, value in project_data.items():
                        setattr(existing, key, value)
                    existing.organization = org_user
                    existing.save()
                    updated_n += 1
                    self.stdout.write(self.style.SUCCESS(f"Updated campaign: {existing.name}"))
                else:
                    skipped_n += 1
                    self.stdout.write(f"Keep existing campaign: {existing.name}")
                continue

            if already_managed and not recreate_missing:
                skipped_n += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Skip recreating deleted campaign: {project_data['name']} "
                        "(pass --recreate-missing to force)"
                    )
                )
                continue

            TreeProject.objects.create(**project_data, organization=org_user)
            created_n += 1
            self.stdout.write(self.style.SUCCESS(f"Created campaign: {project_data['name']}"))

        if created_n or already_managed or seed_already_applied:
            org_user.groups.add(seed_group)

        self.stdout.write(
            self.style.SUCCESS(
                f"Tree seed done — created={created_n}, updated={updated_n}, skipped={skipped_n}."
            )
        )
