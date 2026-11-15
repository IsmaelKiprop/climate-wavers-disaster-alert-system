from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0052_climateeventinvite_email_channels"),
    ]

    operations = [
        migrations.AddField(
            model_name="climateevent",
            name="allow_tree_gifts",
            field=models.BooleanField(
                default=True,
                help_text="Anyone can contribute / gift trees for this day's activities (invited or not)",
            ),
        ),
        migrations.CreateModel(
            name="CalendarObservance",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("month", models.PositiveSmallIntegerField()),
                ("day", models.PositiveSmallIntegerField()),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("international", "International / UN"),
                            ("government", "Government"),
                            ("regional", "Regional / AU"),
                            ("campaign", "Campaign day"),
                        ],
                        default="international",
                        max_length=20,
                    ),
                ),
                (
                    "authority",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="e.g. United Nations, African Union, Kenya",
                        max_length=120,
                    ),
                ),
                ("source_url", models.URLField(blank=True, default="")),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["month", "day", "title"],
            },
        ),
        migrations.AddIndex(
            model_name="calendarobservance",
            index=models.Index(
                fields=["month", "day"], name="core_calend_month_7c2e1a_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="calendarobservance",
            index=models.Index(
                fields=["category", "is_active"], name="core_calend_categor_9a4f2b_idx"
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="climate_event",
            field=models.ForeignKey(
                blank=True,
                help_text="When set, this gift supports that Climate calendar day's activities",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tree_gifts",
                to="core.climateevent",
            ),
        ),
    ]
