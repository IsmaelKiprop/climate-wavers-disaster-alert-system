from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0044_group_chat_rooms"),
    ]

    operations = [
        migrations.AlterField(
            model_name="chatmessage",
            name="body",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="chatmessage",
            name="media_url",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="chatmessage",
            name="media_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("image", "Image"),
                    ("video", "Video"),
                    ("audio", "Audio"),
                    ("file", "File"),
                ],
                default="",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="chatmessage",
            name="mentions",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
