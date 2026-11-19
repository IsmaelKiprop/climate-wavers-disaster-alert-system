from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0068_plastic_hotspot_claim_pin"),
    ]

    operations = [
        migrations.AddField(
            model_name="plastichotspot",
            name="claimed_guest_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="plastichotspot",
            name="claimed_guest_phone",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Normalized phone for guest collectors (no account).",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="plastichotspot",
            name="guest_claim_token",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Opaque token returned to guest after PIN match; proves claim ownership.",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecovery",
            name="guest_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="plasticrecovery",
            name="guest_phone",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Normalized phone for guest collectors (no account).",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="plasticrecovery",
            name="guest_token",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Opaque guest session token for bag lookup without login.",
                max_length=64,
            ),
        ),
    ]
