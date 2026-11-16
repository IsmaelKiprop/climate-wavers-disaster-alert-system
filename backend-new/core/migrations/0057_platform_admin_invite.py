from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0056_champion_alx_training_cert"),
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
                    ("mention", "Mention"),
                    ("climate_event", "Climate Event"),
                    ("champion", "Community Champion"),
                    ("proximity_alert", "Proximity Alert"),
                    ("platform_admin", "Platform Admin"),
                ],
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="PlatformAdminInvite",
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
                ("email", models.EmailField(db_index=True, max_length=254)),
                ("token", models.CharField(db_index=True, max_length=64, unique=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("accepted", "Accepted"),
                            ("revoked", "Revoked"),
                            ("expired", "Expired"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("note", models.CharField(blank=True, default="", max_length=255)),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "accepted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="accepted_platform_admin_invites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "invited_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sent_platform_admin_invites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="platformadmininvite",
            index=models.Index(
                fields=["email", "status"], name="core_platfo_email_7c2a1d_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="platformadmininvite",
            index=models.Index(
                fields=["status", "expires_at"], name="core_platfo_status_8e4b2f_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="platformadmininvite",
            constraint=models.UniqueConstraint(
                condition=models.Q(("status", "pending")),
                fields=("email",),
                name="uniq_pending_platform_admin_invite",
            ),
        ),
    ]
