from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0060_tree_admin_pricing"),
    ]

    operations = [
        migrations.AddField(
            model_name="treeadminorganization",
            name="payouts_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When true, admin_share is auto-transferred via Paystack after each sale",
            ),
        ),
        migrations.AddField(
            model_name="treeadminorganization",
            name="payout_channel",
            field=models.CharField(
                blank=True,
                choices=[
                    ("mobile_money", "M-Pesa / Mobile money"),
                    ("bank", "Bank account"),
                ],
                default="mobile_money",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="treeadminorganization",
            name="payout_account_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="treeadminorganization",
            name="payout_account_number",
            field=models.CharField(
                blank=True,
                default="",
                help_text="M-Pesa phone (2547…) or bank account number",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="treeadminorganization",
            name="payout_bank_code",
            field=models.CharField(
                blank=True,
                default="MPESA",
                help_text="MPESA for mobile money, or Paystack bank code for bank payouts",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="treeadminorganization",
            name="paystack_recipient_code",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payout_status",
            field=models.CharField(
                choices=[
                    ("none", "Not started"),
                    ("skipped", "Skipped"),
                    ("pending", "Pending"),
                    ("success", "Paid out"),
                    ("failed", "Failed"),
                ],
                db_index=True,
                default="none",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payout_amount_kes",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payout_reference",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payout_transfer_code",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payout_error",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="treeprojectdonation",
            name="payout_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
