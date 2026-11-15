from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0051_treeprojectdonation_selected_species"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="climateeventinvite",
            unique_together=set(),
        ),
        migrations.AddField(
            model_name="climateeventinvite",
            name="email",
            field=models.EmailField(
                blank=True,
                default="",
                help_text="External invite email when the person is not a Climate Wavers user yet",
                max_length=254,
            ),
        ),
        migrations.AddField(
            model_name="climateeventinvite",
            name="notify_email",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="climateeventinvite",
            name="notify_in_app",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="climateeventinvite",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="climate_event_invites",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="climateeventinvite",
            index=models.Index(fields=["email"], name="core_climat_email_7f0b2a_idx"),
        ),
        migrations.AddConstraint(
            model_name="climateeventinvite",
            constraint=models.UniqueConstraint(
                condition=models.Q(("user__isnull", False)),
                fields=("event", "user"),
                name="uniq_climate_event_invite_user",
            ),
        ),
        migrations.AddConstraint(
            model_name="climateeventinvite",
            constraint=models.UniqueConstraint(
                condition=models.Q(("email", ""), _negated=True),
                fields=("event", "email"),
                name="uniq_climate_event_invite_email",
            ),
        ),
    ]
