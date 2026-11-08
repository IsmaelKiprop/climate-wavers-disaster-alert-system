from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0036_treeprojectdonation_gifted_to"),
    ]

    operations = [
        migrations.CreateModel(
            name="WaversPointsAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("balance", models.PositiveIntegerField(default=0)),
                ("lifetime_earned", models.PositiveIntegerField(default=0)),
                ("lifetime_redeemed", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="wavers_points",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="WaversPointsLedger",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("delta", models.IntegerField()),
                ("balance_after", models.PositiveIntegerField()),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("gift_earn", "Gift reward"),
                            ("redeem_tree", "Redeem tree"),
                            ("adjustment", "Adjustment"),
                        ],
                        max_length=32,
                    ),
                ),
                ("note", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "donation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="points_entries",
                        to="core.treeprojectdonation",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="wavers_points_ledger",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
