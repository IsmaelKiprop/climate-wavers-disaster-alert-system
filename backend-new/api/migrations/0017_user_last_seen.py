from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0016_alter_user_profile_pic_cover"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="last_seen",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
