from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0058_treeprojectdonation_certificate"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeprojectdonation",
            name="planting_status",
            field=models.CharField(
                choices=[
                    ("funded", "Funded — awaiting planting"),
                    ("planted", "Planted — proof shared"),
                ],
                db_index=True,
                default="funded",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="planted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="created_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tree_project_updates",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="donation",
            field=models.ForeignKey(
                blank=True,
                help_text="When set, this update is planting proof for that funded gift",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="planting_updates",
                to="core.treeprojectdonation",
            ),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="latitude",
            field=models.DecimalField(
                blank=True, decimal_places=6, max_digits=9, null=True
            ),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="longitude",
            field=models.DecimalField(
                blank=True, decimal_places=6, max_digits=9, null=True
            ),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="location_label",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="update_type",
            field=models.CharField(
                choices=[
                    ("progress", "Progress update"),
                    ("planting_proof", "Planting proof"),
                ],
                default="progress",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="treeprojectupdate",
            name="videos",
            field=models.JSONField(blank=True, default=list),
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
                ],
                max_length=32,
            ),
        ),
    ]
