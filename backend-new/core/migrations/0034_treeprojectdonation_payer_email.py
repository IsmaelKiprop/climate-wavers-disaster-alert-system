from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0033_disaster_alert_channels"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payer_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AlterField(
            model_name="treeprojectdonation",
            name="amount",
            field=models.DecimalField(
                decimal_places=2,
                help_text="Amount charged, in major units",
                max_digits=10,
            ),
        ),
        migrations.AlterField(
            model_name="treeprojectdonation",
            name="donor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tree_donations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
