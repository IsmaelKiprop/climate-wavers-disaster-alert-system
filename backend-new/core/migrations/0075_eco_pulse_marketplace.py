from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0074_grassroots_adoption_features"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EcoVendor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("org_type", models.CharField(choices=[("nursery", "Tree Nursery"), ("cbo", "Community CBO"), ("school", "School / Campus"), ("church", "Faith Group"), ("county", "County / Government"), ("ngo", "NGO"), ("other", "Other")], default="cbo", max_length=20)),
                ("country", models.CharField(default="Kenya", max_length=100)),
                ("county", models.CharField(max_length=100)),
                ("city", models.CharField(blank=True, default="", max_length=100)),
                ("coverage_wards", models.JSONField(blank=True, default=list)),
                ("contact_email", models.EmailField(blank=True, default="", max_length=254)),
                ("contact_phone", models.CharField(blank=True, default="", max_length=40)),
                ("verification_status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")], default="pending", max_length=20)),
                ("platform_fee_rate", models.DecimalField(decimal_places=4, default=0.15, max_digits=5)),
                ("payouts_enabled", models.BooleanField(default=False)),
                ("payout_channel", models.CharField(blank=True, default="mobile_money", max_length=20)),
                ("payout_account_name", models.CharField(blank=True, default="", max_length=200)),
                ("payout_account_number", models.CharField(blank=True, default="", max_length=64)),
                ("payout_bank_code", models.CharField(blank=True, default="MPESA", max_length=32)),
                ("paystack_recipient_code", models.CharField(blank=True, default="", max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.OneToOneField(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="eco_vendors", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="EcoProduct",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("category", models.CharField(choices=[("solar", "Solar kits / lighting"), ("cookstove", "Clean cookstoves"), ("water", "Water"), ("waste", "Waste")], max_length=20)),
                ("outcome_tag", models.CharField(choices=[("outage_resilience", "Outage resilience"), ("trees_charcoal", "Trees and charcoal"), ("drought_resilience", "Drought resilience"), ("plastic_recovery", "Plastic recovery")], max_length=32)),
                ("price_kes", models.PositiveIntegerField()),
                ("install_included", models.BooleanField(default=False)),
                ("warranty_days", models.PositiveIntegerField(default=0)),
                ("coverage_wards", models.JSONField(blank=True, default=list)),
                ("photos", models.JSONField(blank=True, default=list)),
                ("is_published", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("vendor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="products", to="core.ecovendor")),
            ],
        ),
        migrations.CreateModel(
            name="EcoOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("buyer_county", models.CharField(blank=True, default="", max_length=100)),
                ("buyer_ward", models.CharField(blank=True, default="", max_length=100)),
                ("amount_kes", models.PositiveIntegerField()),
                ("platform_fee_kes", models.PositiveIntegerField(default=0)),
                ("vendor_share_kes", models.PositiveIntegerField(default=0)),
                ("payment_reference", models.CharField(blank=True, default=None, max_length=120, null=True, unique=True)),
                ("status", models.CharField(choices=[("lead", "Lead"), ("pending", "Pending"), ("paid", "Paid"), ("install_scheduled", "Install Scheduled"), ("installed", "Installed"), ("checked_in", "Checked In"), ("cancelled", "Cancelled")], default="pending", max_length=24)),
                ("installed_at", models.DateTimeField(blank=True, null=True)),
                ("payout_status", models.CharField(default="none", max_length=20)),
                ("payout_error", models.TextField(blank=True, default="")),
                ("payout_reference", models.CharField(blank=True, default=None, max_length=120, null=True, unique=True)),
                ("chapter", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="eco_orders", to="core.socialgroup")),
                ("challenge", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="eco_orders", to="core.seasonalchallenge")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("buyer", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="eco_orders", to=settings.AUTH_USER_MODEL)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="orders", to="core.ecoproduct")),
                ("vendor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="orders", to="core.ecovendor")),
            ],
        ),
        migrations.CreateModel(
            name="EcoVendorEndorsement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("note", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="eco_vendor_endorsements", to=settings.AUTH_USER_MODEL)),
                ("vendor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="endorsements", to="core.ecovendor")),
            ],
        ),
        migrations.AddConstraint(model_name="ecovendorendorsement", constraint=models.UniqueConstraint(fields=("vendor", "user"), name="unique_eco_vendor_endorsement")),
        migrations.CreateModel(
            name="EcoInstallCheckIn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day_mark", models.PositiveSmallIntegerField(choices=[(30, "30 days"), (90, "90 days")])),
                ("working", models.BooleanField()),
                ("note", models.CharField(blank=True, default="", max_length=500)),
                ("latitude", models.FloatField(blank=True, null=True)),
                ("longitude", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="checkins", to="core.ecoorder")),
            ],
        ),
        migrations.AddConstraint(model_name="ecoinstallcheckin", constraint=models.UniqueConstraint(fields=("order", "day_mark"), name="unique_eco_order_checkin_day")),
        migrations.AddField(model_name="challengeparticipation", name="eco_kits", field=models.PositiveIntegerField(default=0)),
        migrations.AlterField(model_name="seasonalchallenge", name="metric", field=models.CharField(choices=[("trees", "Trees planted"), ("plastic_kg", "Plastic recovered (kg)"), ("eco_kits", "Resilience kits installed"), ("alerts", "Verified hazard alerts"), ("combined", "Combined impact score")], default="combined", max_length=20)),
    ]
