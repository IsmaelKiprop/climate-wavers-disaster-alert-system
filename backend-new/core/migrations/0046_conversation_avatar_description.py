from django.db import migrations, models


COMMUNITY_ROOM_KEY = "community:global"
COMMUNITY_NAME = "Climate Wavers Community"
COMMUNITY_DESCRIPTION = (
    "Official Climate Wavers community — disaster alerts, climate tips, "
    "and peer support. Be respectful, verify sources, and follow local "
    "emergency guidance."
)


def seed_community_profile(apps, schema_editor):
    Conversation = apps.get_model("core", "Conversation")
    conv, created = Conversation.objects.get_or_create(
        room_key=COMMUNITY_ROOM_KEY,
        defaults={
            "conversation_type": "community",
            "name": COMMUNITY_NAME,
            "description": COMMUNITY_DESCRIPTION,
        },
    )
    updates = []
    if not conv.name:
        conv.name = COMMUNITY_NAME
        updates.append("name")
    if not (conv.description or "").strip():
        conv.description = COMMUNITY_DESCRIPTION
        updates.append("description")
    if conv.conversation_type != "community":
        conv.conversation_type = "community"
        updates.append("conversation_type")
    if updates:
        conv.save(update_fields=updates)


def unseed_community_profile(apps, schema_editor):
    Conversation = apps.get_model("core", "Conversation")
    Conversation.objects.filter(room_key=COMMUNITY_ROOM_KEY).update(
        description="", avatar=None
    )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0045_chatmessage_media_mentions"),
    ]

    operations = [
        migrations.AddField(
            model_name="conversation",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="conversation",
            name="avatar",
            field=models.URLField(
                blank=True,
                help_text="Room logo/avatar URL (community & rooms without a social group)",
                max_length=500,
                null=True,
            ),
        ),
        migrations.RunPython(seed_community_profile, unseed_community_profile),
    ]
