from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0063_plastic_recycler_scan_invite"),
    ]

    operations = [
        migrations.AddField(
            model_name="plasticcertificate",
            name="emailed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
