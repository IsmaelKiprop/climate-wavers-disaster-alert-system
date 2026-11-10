from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0038_responder_rapidbrief"),
    ]

    operations = [
        migrations.AddField(
            model_name="responderorganization",
            name="max_seats",
            field=models.PositiveIntegerField(default=5),
        ),
        migrations.AddField(
            model_name="responderorganization",
            name="plan",
            field=models.CharField(
                choices=[
                    ("pilot", "RapidBrief Pilot"),
                    ("ngo", "RapidBrief NGO"),
                    ("org", "RapidBrief Org"),
                    ("partner", "FlowOps Partner"),
                ],
                default="pilot",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="responderorganization",
            name="plan_ends_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="responderorganization",
            name="plan_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="responderorganization",
            name="plan_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending verification"),
                    ("trial", "Trial"),
                    ("active", "Active"),
                    ("expired", "Expired"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="responderorganization",
            index=models.Index(
                fields=["plan", "plan_status"], name="core_respon_plan_c7f9a1_idx"
            ),
        ),
    ]
