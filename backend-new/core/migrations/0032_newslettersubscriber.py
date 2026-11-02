from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_rename_core_campai_campaig_idx_core_campai_campaig_ab9ffb_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="NewsletterSubscriber",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("source", models.CharField(default="footer", max_length=40)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
