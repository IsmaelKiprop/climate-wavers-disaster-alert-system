from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0039_responder_plans"),
    ]

    operations = [
        migrations.CreateModel(
            name="TreeAdminOrganization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                (
                    "org_type",
                    models.CharField(
                        choices=[
                            ("nursery", "Tree Nursery"),
                            ("cbo", "Community CBO"),
                            ("school", "School / Campus"),
                            ("church", "Faith Group"),
                            ("county", "County / Government"),
                            ("ngo", "NGO"),
                            ("other", "Other"),
                        ],
                        default="cbo",
                        max_length=20,
                    ),
                ),
                ("website", models.URLField(blank=True, max_length=500, null=True)),
                ("country", models.CharField(default="Kenya", max_length=100)),
                ("city", models.CharField(blank=True, max_length=100, null=True)),
                ("contact_email", models.EmailField(blank=True, max_length=254, null=True)),
                ("contact_phone", models.CharField(blank=True, max_length=40, null=True)),
                (
                    "planting_sites_note",
                    models.TextField(
                        blank=True,
                        help_text="Where they can plant (school, farm, riverbank, etc.)",
                        null=True,
                    ),
                ),
                (
                    "verification_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                (
                    "plan",
                    models.CharField(
                        choices=[
                            ("pilot", "Tree Admin Pilot"),
                            ("growth", "Tree Admin Growth"),
                            ("partner", "Tree Admin Partner"),
                        ],
                        default="pilot",
                        max_length=20,
                    ),
                ),
                (
                    "plan_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending verification"),
                            ("trial", "Trial"),
                            ("active", "Active"),
                            ("expired", "Expired"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("plan_started_at", models.DateTimeField(blank=True, null=True)),
                ("plan_ends_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_tree_admin_orgs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="TreeAdminMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("owner", "Owner"),
                            ("manager", "Manager"),
                            ("viewer", "Viewer"),
                        ],
                        default="owner",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "org",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="memberships",
                        to="core.treeadminorganization",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tree_admin_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("org", "user")},
            },
        ),
        migrations.AddField(
            model_name="treeproject",
            name="tree_admin_org",
            field=models.ForeignKey(
                blank=True,
                help_text="Verified Tree Admin org that owns this project",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="projects",
                to="core.treeadminorganization",
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="admin_share",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Amount attributed to the Tree Admin project",
                max_digits=10,
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="fee_rate",
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal("0.18"),
                help_text="Platform fee rate applied at payment time",
                max_digits=5,
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="platform_fee",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Climate Wavers platform fee share",
                max_digits=10,
            ),
        ),
        migrations.AddIndex(
            model_name="treeadminorganization",
            index=models.Index(fields=["verification_status"], name="core_treead_verific_idx"),
        ),
        migrations.AddIndex(
            model_name="treeadminorganization",
            index=models.Index(fields=["country", "city"], name="core_treead_country_idx"),
        ),
        migrations.AddIndex(
            model_name="treeadminorganization",
            index=models.Index(fields=["plan", "plan_status"], name="core_treead_plan_idx"),
        ),
    ]
