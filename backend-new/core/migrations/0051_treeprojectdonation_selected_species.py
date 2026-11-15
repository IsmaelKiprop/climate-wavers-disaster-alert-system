from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0050_climate_event_calendar"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeprojectdonation",
            name="selected_species",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Species quantities purchased, e.g. {"Rhizophora": 2}',
            ),
        ),
    ]
