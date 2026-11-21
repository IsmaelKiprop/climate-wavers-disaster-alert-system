from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0072_inventory_recycler_onboarding"),
    ]

    operations = [
        migrations.AlterField(
            model_name="plasticrecovery",
            name="polymer_type",
            field=models.CharField(
                choices=[
                    ("PET", "PET"),
                    ("HDPE", "HDPE"),
                    ("PVC", "PVC"),
                    ("LDPE", "LDPE"),
                    ("PP", "PP"),
                    ("PS", "PS"),
                    ("PC", "PC"),
                    ("mixed", "Mixed"),
                    ("other", "Other"),
                ],
                default="mixed",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="plasticdispatch",
            name="polymer_type",
            field=models.CharField(
                choices=[
                    ("PET", "PET"),
                    ("HDPE", "HDPE"),
                    ("PVC", "PVC"),
                    ("LDPE", "LDPE"),
                    ("PP", "PP"),
                    ("PS", "PS"),
                    ("PC", "PC"),
                    ("mixed", "Mixed"),
                    ("other", "Other"),
                ],
                default="mixed",
                max_length=20,
            ),
        ),
    ]
