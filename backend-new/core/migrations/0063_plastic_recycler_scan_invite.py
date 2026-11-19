from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0062_plastic_pulse"),
    ]

    operations = [
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="invite_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="invite_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="invite_status",
            field=models.CharField(
                choices=[
                    ("none", "No invite"),
                    ("pending", "Invite pending"),
                    ("accepted", "Invite accepted"),
                    ("revoked", "Invite revoked"),
                ],
                db_index=True,
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="invite_token",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="invited_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="invited_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="invited_plastic_recyclers",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecyclerpartner",
            name="linked_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="plastic_recycler_partners",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
