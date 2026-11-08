from django.db import migrations, connection


INDEXES = (
    (
        "core_emerge_latitud_idx",
        "CREATE INDEX IF NOT EXISTS core_emerge_latitud_idx ON core_emergencyagency (latitude, longitude)",
    ),
    (
        "core_emerge_country_idx",
        "CREATE INDEX IF NOT EXISTS core_emerge_country_idx ON core_emergencyagency (country, is_active)",
    ),
)


def ensure_indexes(apps, schema_editor):
    if connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for _name, sql in INDEXES:
            cursor.execute(sql)


class Migration(migrations.Migration):
    """
    Production deploys previously ran makemigrations and tried to rename these
    indexes. Make sure the expected names exist without failing if they already do.
    """

    dependencies = [
        ("core", "0034_treeprojectdonation_payer_email"),
    ]

    operations = [
        migrations.RunPython(ensure_indexes, migrations.RunPython.noop),
    ]
