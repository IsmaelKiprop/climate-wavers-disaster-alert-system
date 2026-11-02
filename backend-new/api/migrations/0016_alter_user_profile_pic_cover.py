from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_alter_user_default_avatar"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="profile_pic",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AlterField(
            model_name="user",
            name="cover",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
