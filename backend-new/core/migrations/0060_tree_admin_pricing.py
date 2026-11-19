from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0059_planting_proof"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeadminorganization",
            name="default_tree_price",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Default USD price per tree for new projects (admins can override per project/species)",
                max_digits=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="treeadminorganization",
            name="platform_fee_rate",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Platform fee rate for this org (e.g. 0.18 = 18%). Null uses global default.",
                max_digits=5,
                null=True,
            ),
        ),
    ]
