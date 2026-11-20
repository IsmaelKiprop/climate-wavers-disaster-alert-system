from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0070_holding_zones_recycler_directory"),
    ]

    operations = [
        migrations.AddField(
            model_name="plasticproject",
            name="marketplace_fee_rate",
            field=models.DecimalField(
                decimal_places=4,
                default=0.2,
                help_text=(
                    "Climate Wavers platform share of recycler payment "
                    "(e.g. 0.20 = 20% to CW, 80% to collectors/CBO)"
                ),
                max_digits=5,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="fee_rate",
            field=models.DecimalField(
                decimal_places=4,
                default=0.2,
                help_text="Platform fee rate applied at offer time",
                max_digits=5,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="platform_share_kes",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Climate Wavers cut",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="collector_share_kes",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Share paid out to collectors / CBO",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("pending", "Awaiting recycler payment"),
                    ("received", "Recycler paid Climate Wavers"),
                    ("failed", "Payment failed"),
                    ("refunded", "Refunded"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="payment_reference",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="payment_received_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="collector_payout_status",
            field=models.CharField(
                choices=[
                    ("none", "Not started"),
                    ("pending", "Pending payout"),
                    ("paid", "Collectors paid"),
                    ("failed", "Payout failed"),
                ],
                db_index=True,
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="collector_payout_phone",
            field=models.CharField(
                blank=True,
                default="",
                help_text="M-Pesa / payout phone for collector or CBO share",
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="collector_payout_reference",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="plasticdispatch",
            name="collector_paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="plasticdispatch",
            name="total_kes",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="What the recycler pays Climate Wavers for this lot",
                max_digits=12,
                null=True,
            ),
        ),
        migrations.AddIndex(
            model_name="plasticdispatch",
            index=models.Index(
                fields=["payment_status"], name="core_plasti_payment_a1b2c3_idx"
            ),
        ),
    ]
