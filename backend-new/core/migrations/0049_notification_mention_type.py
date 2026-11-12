from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0048_post_font_family"),
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
                ],
                max_length=20,
            ),
        ),
    ]
