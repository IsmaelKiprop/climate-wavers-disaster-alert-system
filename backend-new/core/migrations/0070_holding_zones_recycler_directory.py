from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0069_plastic_guest_collection"),
    ]

    operations = [
        migrations.AddField(
            model_name="plasticproject",
            name="collection_days",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Weekday codes when collectors run, e.g. ["mon","wed","sat"]',
            ),
        ),
        migrations.AddField(
            model_name="plasticproject",
            name="weekly_target_kg",
            field=models.DecimalField(
                decimal_places=2,
                default=120,
                help_text="Typical weekly kg across holding zones (ground ops baseline)",
                max_digits=12,
            ),
        ),
        migrations.CreateModel(
            name="PlasticHoldingZone",
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
                ("name", models.CharField(max_length=120)),
                (
                    "code",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Short zone code, e.g. HZ-1",
                        max_length=32,
                    ),
                ),
                ("location_label", models.CharField(blank=True, default="", max_length=255)),
                (
                    "latitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                (
                    "longitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                (
                    "materials",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='Accepted materials, e.g. ["plastic","paper_bags","PET","HDPE","LDPE"]',
                    ),
                ),
                (
                    "inventory_kg",
                    models.DecimalField(decimal_places=2, default=0, max_digits=12),
                ),
                (
                    "inventory_by_polymer",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='Optional split, e.g. {"PET": 40, "HDPE": 30, "LDPE": 20}',
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="holding_zones",
                        to="core.plasticproject",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="accepts_small_lots",
            field=models.BooleanField(
                default=True,
                help_text="True if yard can take CBO-scale lots (~40–120 kg/week)",
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="address",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="is_directory",
            field=models.BooleanField(
                default=False,
                help_text="Public Kenya recycler directory entry (not org-owned partner)",
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="materials_accepted",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='e.g. ["PET","HDPE","PP","LDPE"]',
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="min_buy_kg",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Minimum lot size this yard typically buys (0 = flexible)",
                max_digits=10,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="website",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="plasticrecovery",
            name="polymer_type",
            field=models.CharField(
                choices=[
                    ("PET", "PET"),
                    ("HDPE", "HDPE"),
                    ("PP", "PP"),
                    ("LDPE", "LDPE"),
                    ("mixed", "Mixed"),
                    ("other", "Other"),
                ],
                default="mixed",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecovery",
            name="holding_zone",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="recoveries",
                to="core.plasticholdingzone",
            ),
        ),
        migrations.CreateModel(
            name="PlasticDispatch",
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
                (
                    "polymer_type",
                    models.CharField(
                        choices=[
                            ("PET", "PET"),
                            ("HDPE", "HDPE"),
                            ("PP", "PP"),
                            ("LDPE", "LDPE"),
                            ("mixed", "Mixed"),
                            ("other", "Other"),
                        ],
                        default="mixed",
                        max_length=20,
                    ),
                ),
                ("kg", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "price_kes_per_kg",
                    models.DecimalField(
                        blank=True, decimal_places=2, max_digits=10, null=True
                    ),
                ),
                (
                    "total_kes",
                    models.DecimalField(
                        blank=True, decimal_places=2, max_digits=12, null=True
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("offered", "Offered to recycler"),
                            ("accepted", "Recycler accepted"),
                            ("in_transit", "In transit"),
                            ("delivered", "Delivered"),
                            ("settled", "Settled"),
                            ("cancelled", "Cancelled"),
                        ],
                        db_index=True,
                        default="offered",
                        max_length=20,
                    ),
                ),
                (
                    "pickup_day",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Planned pickup weekday code, e.g. mon",
                        max_length=16,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("contact_phone", models.CharField(blank=True, default="", max_length=40)),
                ("offered_at", models.DateTimeField(blank=True, null=True)),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("settled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_dispatches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "holding_zone",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="dispatches",
                        to="core.plasticholdingzone",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispatches",
                        to="core.plasticproject",
                    ),
                ),
                (
                    "recycler",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="dispatches",
                        to="core.plasticrecyclerpartner",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="plasticholdingzone",
            index=models.Index(
                fields=["project", "is_active"], name="core_plasti_project_8c5b1a_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="plasticdispatch",
            index=models.Index(
                fields=["project", "status"], name="core_plasti_project_d1a2b3_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="plasticdispatch",
            index=models.Index(
                fields=["recycler", "status"], name="core_plasti_recycle_e4f5g6_idx"
            ),
        ),
    ]
