from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0061_tree_admin_payouts"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlasticProject",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("short_description", models.CharField(blank=True, default="", max_length=500)),
                ("organization_name", models.CharField(blank=True, default="", max_length=200)),
                ("country", models.CharField(default="Kenya", max_length=100)),
                ("region", models.CharField(blank=True, default="", max_length=100)),
                ("city", models.CharField(blank=True, default="", max_length=100)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("address", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("completed", "Completed"),
                            ("paused", "Paused"),
                            ("pending_approval", "Pending Approval"),
                        ],
                        default="active",
                        max_length=20,
                    ),
                ),
                ("goal_kg", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("recovered_kg", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                (
                    "sponsor_price_usd_per_kg",
                    models.DecimalField(
                        decimal_places=2,
                        default=1.0,
                        help_text="Impact sponsorship price USD per verified kg",
                        max_digits=10,
                    ),
                ),
                (
                    "scrap_pet_kes_per_kg",
                    models.DecimalField(
                        decimal_places=2,
                        default=20,
                        help_text="Indicative PET scrap KES/kg",
                        max_digits=10,
                    ),
                ),
                (
                    "scrap_hdpe_kes_per_kg",
                    models.DecimalField(
                        decimal_places=2,
                        default=25,
                        help_text="Indicative HDPE scrap KES/kg",
                        max_digits=10,
                    ),
                ),
                ("cover_image", models.CharField(blank=True, default="", max_length=500)),
                ("gallery", models.JSONField(blank=True, default=list)),
                (
                    "flood_zone_flag",
                    models.BooleanField(
                        default=False,
                        help_text="Project focuses on drain / flood-risk corridors",
                    ),
                ),
                ("contact_person", models.CharField(blank=True, default="", max_length=200)),
                ("contact_email", models.EmailField(blank=True, default="", max_length=254)),
                ("contact_phone", models.CharField(blank=True, default="", max_length=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="plastic_projects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tree_admin_org",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_projects",
                        to="core.treeadminorganization",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlasticHotspot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, default="", max_length=200)),
                ("notes", models.TextField(blank=True, default="")),
                ("photo", models.CharField(blank=True, default="", max_length=500)),
                ("latitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("longitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("location_label", models.CharField(blank=True, default="", max_length=255)),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("medium", "Medium"),
                            ("high", "High"),
                            ("critical", "Critical"),
                        ],
                        default="medium",
                        max_length=20,
                    ),
                ),
                (
                    "drain_related",
                    models.BooleanField(default=False, help_text="Blocks drainage / flood corridor"),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("open", "Open"),
                            ("claimed", "Claimed"),
                            ("cleared", "Cleared"),
                        ],
                        default="open",
                        max_length=20,
                    ),
                ),
                ("claimed_at", models.DateTimeField(blank=True, null=True)),
                ("cleared_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "claimed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="claimed_plastic_hotspots",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_hotspots",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hotspots",
                        to="core.plasticproject",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlasticRecyclerPartner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("contact_email", models.EmailField(blank=True, default="", max_length=254)),
                ("contact_phone", models.CharField(blank=True, default="", max_length=40)),
                ("city", models.CharField(blank=True, default="", max_length=100)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                (
                    "buy_rates",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text='KES/kg by polymer, e.g. {"PET": 20, "HDPE": 25, "PP": 10}',
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_plastic_recyclers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_recyclers",
                        to="core.treeadminorganization",
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="PlasticRecovery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "client_uuid",
                    models.CharField(
                        blank=True,
                        db_index=True,
                        default="",
                        help_text="Idempotent offline sync id",
                        max_length=64,
                    ),
                ),
                ("bag_id", models.CharField(db_index=True, max_length=64)),
                (
                    "polymer_type",
                    models.CharField(
                        choices=[
                            ("PET", "PET"),
                            ("HDPE", "HDPE"),
                            ("PP", "PP"),
                            ("mixed", "Mixed"),
                            ("other", "Other"),
                        ],
                        default="mixed",
                        max_length=20,
                    ),
                ),
                ("kg_claimed", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("kg_verified", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("images", models.JSONField(blank=True, default=list)),
                ("videos", models.JSONField(blank=True, default=list)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("location_label", models.CharField(blank=True, default="", max_length=255)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("queued_offline", "Queued offline"),
                            ("submitted", "Submitted"),
                            ("cbo_verified", "CBO verified"),
                            ("rejected", "Rejected"),
                            ("intake_confirmed", "Recycler intake confirmed"),
                        ],
                        db_index=True,
                        default="submitted",
                        max_length=20,
                    ),
                ),
                ("reject_reason", models.CharField(blank=True, default="", max_length=255)),
                ("offline_queued_at", models.DateTimeField(blank=True, null=True)),
                ("synced_at", models.DateTimeField(blank=True, null=True)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("intake_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "hotspot",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recoveries",
                        to="core.plastichotspot",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recoveries",
                        to="core.plasticproject",
                    ),
                ),
                (
                    "recycler",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="intakes",
                        to="core.plasticrecyclerpartner",
                    ),
                ),
                (
                    "submitted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_recoveries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "verified_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="verified_plastic_recoveries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlasticSponsorship",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("payer_email", models.EmailField(blank=True, default="", max_length=254)),
                ("sponsor_display_name", models.CharField(blank=True, default="", max_length=200)),
                ("kg_sponsored", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        default=0,
                        help_text="Charged amount (KES)",
                        max_digits=12,
                    ),
                ),
                ("amount_usd", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("platform_fee", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("admin_share", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("fee_rate", models.DecimalField(decimal_places=4, default=0.18, max_digits=5)),
                ("payment_reference", models.CharField(max_length=100, unique=True)),
                (
                    "payment_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                            ("refunded", "Refunded"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("dedication_message", models.TextField(blank=True, default="")),
                ("certificate_id", models.CharField(blank=True, db_index=True, default="", max_length=80)),
                ("certificate_issued_at", models.DateTimeField(blank=True, null=True)),
                (
                    "payout_status",
                    models.CharField(
                        choices=[
                            ("none", "Not started"),
                            ("skipped", "Skipped"),
                            ("pending", "Pending"),
                            ("success", "Paid out"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="none",
                        max_length=20,
                    ),
                ),
                ("payout_amount_kes", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("payout_reference", models.CharField(blank=True, default="", max_length=120)),
                ("payout_error", models.CharField(blank=True, default="", max_length=500)),
                ("payout_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "gifted_to",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="gifted_plastic_sponsorships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sponsorships",
                        to="core.plasticproject",
                    ),
                ),
                (
                    "sponsor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="plastic_sponsorships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlasticCertificate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=80, unique=True)),
                ("kg", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("holder_name", models.CharField(blank=True, default="", max_length=200)),
                ("holder_email", models.EmailField(blank=True, default="", max_length=254)),
                ("issued_at", models.DateTimeField(auto_now_add=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="certificates",
                        to="core.plasticproject",
                    ),
                ),
                (
                    "recovery",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="certificates",
                        to="core.plasticrecovery",
                    ),
                ),
                (
                    "sponsorship",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="certificates",
                        to="core.plasticsponsorship",
                    ),
                ),
            ],
            options={"ordering": ["-issued_at"]},
        ),
        migrations.AddField(
            model_name="waverspointsledger",
            name="plastic_recovery",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="points_entries",
                to="core.plasticrecovery",
            ),
        ),
        migrations.AddField(
            model_name="waverspointsledger",
            name="plastic_sponsorship",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="points_entries",
                to="core.plasticsponsorship",
            ),
        ),
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("post", "Post"),
                    ("comment", "Comment"),
                    ("reaction", "Reaction"),
                    ("repost", "Repost"),
                    ("poll", "Poll"),
                    ("follow", "Follow"),
                    ("disaster", "Disaster"),
                    ("mention", "Mention"),
                    ("chat_message", "Chat Message"),
                    ("climate_event", "Climate Event"),
                    ("champion", "Community Champion"),
                    ("proximity_alert", "Proximity Alert"),
                    ("platform_admin", "Platform Admin"),
                    ("tree", "Tree planting"),
                    ("plastic", "Plastic Pulse"),
                ],
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="waverspointsledger",
            name="reason",
            field=models.CharField(
                choices=[
                    ("gift_earn", "Gift reward"),
                    ("redeem_tree", "Redeem tree"),
                    ("sponsor_earn", "Plastic sponsor reward"),
                    ("recovery_earn", "Plastic recovery reward"),
                    ("redeem_plastic", "Redeem plastic kg"),
                    ("adjustment", "Adjustment"),
                ],
                max_length=32,
            ),
        ),
        migrations.AddIndex(
            model_name="plasticproject",
            index=models.Index(fields=["status"], name="core_plasti_status_6f0c0a_idx"),
        ),
        migrations.AddIndex(
            model_name="plasticproject",
            index=models.Index(fields=["country", "city"], name="core_plasti_country_1c2b3a_idx"),
        ),
        migrations.AddIndex(
            model_name="plasticproject",
            index=models.Index(fields=["flood_zone_flag"], name="core_plasti_flood_z_9a1b2c_idx"),
        ),
        migrations.AddIndex(
            model_name="plastichotspot",
            index=models.Index(fields=["status"], name="core_plasti_status_hot_idx"),
        ),
        migrations.AddIndex(
            model_name="plastichotspot",
            index=models.Index(fields=["drain_related", "status"], name="core_plasti_drain_st_idx"),
        ),
        migrations.AddIndex(
            model_name="plasticrecovery",
            index=models.Index(fields=["status", "project"], name="core_plasti_status_proj_idx"),
        ),
        migrations.AddIndex(
            model_name="plasticrecovery",
            index=models.Index(fields=["bag_id"], name="core_plasti_bag_id_idx"),
        ),
        migrations.AddConstraint(
            model_name="plasticrecovery",
            constraint=models.UniqueConstraint(
                condition=~models.Q(client_uuid=""),
                fields=("project", "client_uuid"),
                name="uniq_plastic_recovery_client_uuid_per_project",
            ),
        ),
    ]
