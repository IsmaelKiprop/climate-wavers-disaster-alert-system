from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0037_waverspointsaccount_waverspointsledger"),
    ]

    operations = [
        migrations.CreateModel(
            name="ResponderOrganization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                (
                    "org_type",
                    models.CharField(
                        choices=[
                            ("fire", "Fire"),
                            ("police", "Police"),
                            ("medical", "Medical"),
                            ("red_cross", "Red Cross"),
                            ("county", "County Emergency"),
                            ("government", "Government"),
                            ("un", "United Nations"),
                            ("ngo", "NGO"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                ("logo", models.URLField(blank=True, max_length=500, null=True)),
                ("website", models.URLField(blank=True, max_length=500, null=True)),
                ("country", models.CharField(default="Kenya", max_length=100)),
                ("city", models.CharField(blank=True, max_length=100, null=True)),
                ("latitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("longitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("coverage_radius_km", models.PositiveIntegerField(default=150)),
                (
                    "disaster_types",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Disaster types this org responds to; empty = all",
                    ),
                ),
                ("contact_email", models.EmailField(blank=True, max_length=254, null=True)),
                ("contact_phone", models.CharField(blank=True, max_length=32, null=True)),
                ("whatsapp_opt_in", models.BooleanField(default=False)),
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "agency",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="responder_orgs",
                        to="core.emergencyagency",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_responder_orgs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="ResponderMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("owner", "Owner"),
                            ("dispatcher", "Dispatcher"),
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
                        to="core.responderorganization",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="responder_memberships",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("org", "user")},
            },
        ),
        migrations.CreateModel(
            name="ResponderDispatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_key", models.CharField(max_length=200)),
                ("source", models.CharField(blank=True, default="", max_length=40)),
                ("disaster_type", models.CharField(blank=True, default="", max_length=80)),
                ("place", models.CharField(blank=True, default="", max_length=300)),
                ("city", models.CharField(blank=True, default="", max_length=100)),
                ("country", models.CharField(blank=True, default="", max_length=100)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("magnitude", models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True)),
                ("is_official", models.BooleanField(default=False)),
                ("confidence", models.CharField(blank=True, default="", max_length=120)),
                ("ai_summary", models.TextField(blank=True, default="")),
                ("ai_brief", models.TextField(blank=True, default="")),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("distance_km", models.DecimalField(blank=True, decimal_places=1, max_digits=8, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("new", "New"),
                            ("acknowledged", "Acknowledged"),
                            ("mobilizing", "Mobilizing"),
                            ("on_scene", "On scene"),
                            ("declined", "Declined"),
                            ("resolved", "Resolved"),
                        ],
                        default="new",
                        max_length=20,
                    ),
                ),
                ("notified_at", models.DateTimeField(blank=True, null=True)),
                ("acknowledged_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "acknowledged_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="acknowledged_dispatches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "org",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispatches",
                        to="core.responderorganization",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("org", "event_key")},
            },
        ),
        migrations.AddIndex(
            model_name="responderorganization",
            index=models.Index(fields=["verification_status"], name="core_respon_verific_idx"),
        ),
        migrations.AddIndex(
            model_name="responderorganization",
            index=models.Index(fields=["latitude", "longitude"], name="core_respon_lat_lng_idx"),
        ),
        migrations.AddIndex(
            model_name="responderorganization",
            index=models.Index(
                fields=["country", "verification_status"],
                name="core_respon_country_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="responderdispatch",
            index=models.Index(fields=["status", "created_at"], name="core_respon_status_idx"),
        ),
        migrations.AddIndex(
            model_name="responderdispatch",
            index=models.Index(fields=["event_key"], name="core_respon_event_k_idx"),
        ),
    ]
