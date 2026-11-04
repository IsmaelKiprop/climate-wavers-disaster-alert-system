from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0032_newslettersubscriber"),
    ]

    operations = [
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
                ],
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="UserAlertPreference",
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
                ("email_alerts", models.BooleanField(default=True)),
                ("whatsapp_alerts", models.BooleanField(default=False)),
                ("radius_km", models.PositiveIntegerField(default=100)),
                (
                    "min_magnitude",
                    models.DecimalField(decimal_places=1, default=4.5, max_digits=3),
                ),
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
                ("phone", models.CharField(blank=True, max_length=32, null=True)),
                ("phone_verified", models.BooleanField(default=False)),
                ("phone_otp", models.CharField(blank=True, max_length=12, null=True)),
                ("phone_otp_expires", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alert_preference",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="EmergencyAgency",
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
                ("name", models.CharField(max_length=200)),
                (
                    "agency_type",
                    models.CharField(
                        choices=[
                            ("fire", "Fire"),
                            ("police", "Police"),
                            ("medical", "Medical"),
                            ("red_cross", "Red Cross"),
                            ("county", "County Emergency"),
                            ("other", "Other"),
                        ],
                        default="other",
                        max_length=20,
                    ),
                ),
                ("phone", models.CharField(blank=True, max_length=32, null=True)),
                ("email", models.EmailField(blank=True, max_length=254, null=True)),
                ("whatsapp_opt_in", models.BooleanField(default=False)),
                ("latitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("longitude", models.DecimalField(decimal_places=6, max_digits=9)),
                ("country", models.CharField(default="Kenya", max_length=100)),
                ("city", models.CharField(blank=True, max_length=100, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="OfficialAlertEvent",
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
                ("event_id", models.CharField(max_length=120, unique=True)),
                ("source", models.CharField(max_length=40)),
                ("title", models.CharField(blank=True, max_length=300)),
                ("disaster_type", models.CharField(blank=True, max_length=80)),
                (
                    "magnitude",
                    models.DecimalField(
                        blank=True, decimal_places=1, max_digits=4, null=True
                    ),
                ),
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
                ("source_url", models.URLField(blank=True, null=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("ai_summary", models.TextField(blank=True)),
                ("fanout_result", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="emergencyagency",
            index=models.Index(
                fields=["latitude", "longitude"],
                name="core_emerge_latitud_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="emergencyagency",
            index=models.Index(
                fields=["country", "is_active"],
                name="core_emerge_country_idx",
            ),
        ),
    ]
