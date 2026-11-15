import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0049_notification_mention_type"),
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
                ],
                max_length=32,
            ),
        ),
        migrations.CreateModel(
            name="ClimateEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("disaster_briefing", "Disaster Briefing"),
                            ("planting_day", "Planting Day"),
                            ("huddle", "Climate Huddle"),
                        ],
                        default="huddle",
                        max_length=32,
                    ),
                ),
                ("starts_at", models.DateTimeField()),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("timezone", models.CharField(default="Africa/Nairobi", max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("scheduled", "Scheduled"),
                            ("live", "Live"),
                            ("ended", "Ended"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="scheduled",
                        max_length=20,
                    ),
                ),
                (
                    "visibility",
                    models.CharField(
                        choices=[
                            ("invitees", "Invitees only"),
                            ("org", "Organization"),
                            ("public", "Public"),
                        ],
                        default="invitees",
                        max_length=20,
                    ),
                ),
                ("jitsi_room", models.CharField(db_index=True, max_length=80, unique=True)),
                ("reminder_60_sent", models.BooleanField(default=False)),
                ("reminder_10_sent", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "conversation",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="climate_events",
                        to="core.conversation",
                    ),
                ),
                (
                    "disaster",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="climate_events",
                        to="core.disaster",
                    ),
                ),
                (
                    "host",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="hosted_climate_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "responder_org",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="climate_events",
                        to="core.responderorganization",
                    ),
                ),
                (
                    "social_group",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="climate_events",
                        to="core.socialgroup",
                    ),
                ),
                (
                    "tree_admin_org",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="climate_events",
                        to="core.treeadminorganization",
                    ),
                ),
                (
                    "tree_project",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="climate_events",
                        to="core.treeproject",
                    ),
                ),
            ],
            options={
                "ordering": ["starts_at"],
            },
        ),
        migrations.CreateModel(
            name="ClimateEventInvite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("host", "Host"),
                            ("cohost", "Co-host"),
                            ("attendee", "Attendee"),
                        ],
                        default="attendee",
                        max_length=20,
                    ),
                ),
                (
                    "rsvp",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("yes", "Yes"),
                            ("no", "No"),
                            ("maybe", "Maybe"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="invites",
                        to="core.climateevent",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="climate_event_invites",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("event", "user")},
            },
        ),
        migrations.AddIndex(
            model_name="climateevent",
            index=models.Index(fields=["starts_at", "status"], name="core_climat_starts__7a1e1a_idx"),
        ),
        migrations.AddIndex(
            model_name="climateevent",
            index=models.Index(fields=["event_type", "starts_at"], name="core_climat_event_t_0f2b2c_idx"),
        ),
        migrations.AddIndex(
            model_name="climateevent",
            index=models.Index(fields=["host", "starts_at"], name="core_climat_host_id_9c3d4e_idx"),
        ),
        migrations.AddIndex(
            model_name="climateeventinvite",
            index=models.Index(fields=["user", "rsvp"], name="core_climat_user_id_1a2b3c_idx"),
        ),
    ]
