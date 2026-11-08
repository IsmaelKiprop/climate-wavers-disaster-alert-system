from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0035_ensure_emergencyagency_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeprojectdonation",
            name="gifted_to",
            field=models.ForeignKey(
                blank=True,
                help_text="User this tree gift is dedicated to (shared profile purchases)",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="gifted_tree_donations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
