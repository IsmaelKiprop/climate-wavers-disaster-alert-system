from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0066_chatmessagereaction"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="mentions",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
