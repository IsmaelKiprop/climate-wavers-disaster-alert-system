from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0047_waverxtweet"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="font_family",
            field=models.CharField(
                blank=True,
                default="montserrat",
                help_text="Frontend post font id (e.g. montserrat, lora, playfair).",
                max_length=64,
            ),
        ),
    ]
