from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0071_plastic_marketplace_split"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlasticInventoryLedger",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("delta_kg", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "balance_after_kg",
                    models.DecimalField(decimal_places=2, default=0, max_digits=12),
                ),
                (
                    "polymer_type",
                    models.CharField(blank=True, default="mixed", max_length=20),
                ),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("verify_in", "CBO verified bag → stock in"),
                            ("dispatch_out", "Marketplace dispatch → stock out"),
                            ("dispatch_cancel", "Dispatch cancelled → stock restored"),
                            ("adjust", "Manual adjustment"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                ("notes", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_inventory_edits",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "dispatch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inventory_entries",
                        to="core.plasticdispatch",
                    ),
                ),
                (
                    "holding_zone",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ledger_entries",
                        to="core.plasticholdingzone",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="inventory_ledger",
                        to="core.plasticproject",
                    ),
                ),
                (
                    "recovery",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inventory_entries",
                        to="core.plasticrecovery",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="onboarding_status",
            field=models.CharField(
                choices=[
                    ("none", "Not applied"),
                    ("applied", "Application pending"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                ],
                db_index=True,
                default="none",
                help_text="Self-serve recycler platform application status",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="application_message",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="applied_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="reviewed_plastic_recyclers",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="plasticinventoryledger",
            index=models.Index(
                fields=["project", "created_at"], name="core_plasti_project_inv1_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="plasticinventoryledger",
            index=models.Index(
                fields=["holding_zone", "created_at"],
                name="core_plasti_holding_inv2_idx",
            ),
        ),
    ]
