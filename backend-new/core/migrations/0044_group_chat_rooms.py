import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0043_feed_audio_groups"),
    ]

    operations = [
        migrations.AlterField(
            model_name="conversation",
            name="conversation_type",
            field=models.CharField(
                choices=[
                    ("community", "Community"),
                    ("dm", "Direct"),
                    ("responder", "Responder"),
                    ("group", "Group"),
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="conversation",
            name="social_group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="chat_rooms",
                to="core.socialgroup",
            ),
        ),
    ]
