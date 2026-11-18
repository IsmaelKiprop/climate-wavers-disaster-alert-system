from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0057_platform_admin_invite"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeprojectdonation",
            name="certificate_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="certificate_issued_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="certificate_emailed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="donor_display_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
