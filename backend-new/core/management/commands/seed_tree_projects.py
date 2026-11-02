from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from core.models import TreeProject

User = get_user_model()


class Command(BaseCommand):
    help = "Seed official Climate Wavers / FlowOps Africa tree campaigns"

    def handle(self, *args, **options):
        org_user, created = User.objects.get_or_create(
            email="hello@flowops.africa",
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
                "cover_image": "/environment.jpg",
                "start_date": date.today() - timedelta(days=21),
                "expected_completion": date.today() + timedelta(days=365),
                "total_budget": Decimal("12500.00"),
                "funds_raised": Decimal("0.00"),
                "funding_goal": Decimal("12500.00"),
                "contact_person": "Ismael Kiprop",
                "contact_email": "hello@flowops.africa",
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
                "cover_image": "/community-respond.jpg",
                "start_date": date.today() - timedelta(days=7),
                "expected_completion": date.today() + timedelta(days=300),
                "total_budget": Decimal("4800.00"),
                "funds_raised": Decimal("0.00"),
                "funding_goal": Decimal("4800.00"),
                "contact_person": "Ismael Kiprop",
                "contact_email": "hello@flowops.africa",
                "status": "active",
                "is_verified": True,
            },
        ]

        for project_data in campaigns:
            project, created_project = TreeProject.objects.get_or_create(
                name=project_data["name"],
                defaults={**project_data, "organization": org_user},
            )
            if created_project:
                self.stdout.write(self.style.SUCCESS(f"Created campaign: {project.name}"))
            else:
                self.stdout.write(self.style.WARNING(f"Campaign already exists: {project.name}"))

        self.stdout.write(self.style.SUCCESS("Official tree campaigns are ready."))
