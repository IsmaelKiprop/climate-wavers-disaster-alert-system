from django.db import migrations, models
import django.utils.timezone


def mark_existing_training_passed(apps, schema_editor):
    Progress = apps.get_model("core", "ChampionTrainingProgress")
    now = django.utils.timezone.now()
    for row in Progress.objects.all():
        row.passed = True
        if not row.quiz_score:
            row.quiz_score = 100
        if not row.completed_at:
            row.completed_at = now
        row.save(
            update_fields=["passed", "quiz_score", "completed_at"]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0055_champion_ratings_impact"),
    ]

    operations = [
        migrations.AddField(
            model_name="communitychampion",
            name="certificate_code",
            field=models.CharField(blank=True, db_index=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="communitychampion",
            name="certificate_issued_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="championtrainingprogress",
            name="attempts",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="championtrainingprogress",
            name="passed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="championtrainingprogress",
            name="quiz_score",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="championtrainingprogress",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name="championtrainingprogress",
            name="created_at",
            field=models.DateTimeField(
                default=django.utils.timezone.now
            ),
        ),
        migrations.AlterField(
            model_name="championtrainingprogress",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            mark_existing_training_passed,
            migrations.RunPython.noop,
        ),
    ]
