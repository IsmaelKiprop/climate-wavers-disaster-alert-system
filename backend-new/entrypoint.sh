#!/bin/sh
set -e

# Never run makemigrations in production — it invents index renames that break migrate.
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Do NOT recreate staff/superadmins on every deploy — that undoes intentional deletes.
# Bootstrap once manually if needed:
#   python manage.py create_admins --only-missing
#   python manage.py ensure_flowops_superadmin --only-missing
if [ "${CREATE_ADMINS_ON_BOOT:-0}" = "1" ]; then
  python manage.py create_admins --only-missing || echo "create_admins skipped"
  python manage.py ensure_flowops_superadmin --only-missing || echo "ensure_flowops_superadmin skipped"
fi
python manage.py seed_tree_projects || echo "seed_tree_projects skipped"
python manage.py sync_calendar_observances || echo "sync_calendar_observances skipped"
# Strip desktop IP / offshore GPS blunders (e.g. India pins on Eldoret bags).
python manage.py clear_inaccurate_gps || echo "clear_inaccurate_gps skipped"

PORT="${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "$PORT" auth.asgi:application
