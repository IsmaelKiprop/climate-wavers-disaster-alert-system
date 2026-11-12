from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0046_conversation_avatar_description"),
    ]

    operations = [
        migrations.CreateModel(
            name="WaverXTweet",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("alert", "Verified alert"), ("tip", "Climate tip")], max_length=16)),
                ("fingerprint", models.CharField(max_length=160, unique=True)),
                ("event_id", models.CharField(blank=True, default="", max_length=120)),
                ("text", models.TextField()),
                ("tweet_id", models.CharField(blank=True, default="", max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("posted", "Posted"),
                            ("failed", "Failed"),
                            ("skipped", "Skipped"),
                            ("dry_run", "Dry run"),
                        ],
                        default="skipped",
                        max_length=16,
                    ),
                ),
                ("response", models.JSONField(blank=True, default=dict)),
                ("feed_post_id", models.CharField(blank=True, default="", max_length=64)),
                ("posted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="waverxtweet",
            index=models.Index(fields=["kind", "status"], name="core_waverx_kind_status_idx"),
        ),
        migrations.AddIndex(
            model_name="waverxtweet",
            index=models.Index(fields=["event_id"], name="core_waverx_event_id_idx"),
        ),
    ]
