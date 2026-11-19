from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0067_post_mentions"),
    ]

    operations = [
        migrations.AddField(
            model_name="plastichotspot",
            name="claim_pin",
            field=models.CharField(
                blank=True,
                default="",
                help_text="CBO shares this PIN on site; collectors must enter it to claim.",
                max_length=12,
            ),
        ),
    ]
