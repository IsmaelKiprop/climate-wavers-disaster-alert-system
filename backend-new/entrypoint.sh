#!/bin/sh
set -e

# Never run makemigrations in production — it invents index renames that break migrate.
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py create_admins
python manage.py ensure_flowops_superadmin || echo "ensure_flowops_superadmin skipped"
python manage.py seed_tree_projects || echo "seed_tree_projects skipped"
python manage.py sync_calendar_observances || echo "sync_calendar_observances skipped"

PORT="${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "$PORT" auth.asgi:application
