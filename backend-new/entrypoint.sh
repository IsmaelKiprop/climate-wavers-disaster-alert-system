#!/bin/sh
set -e

python manage.py makemigrations --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py create_admins
python manage.py seed_tree_projects || echo "seed_tree_projects skipped"

PORT="${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "$PORT" auth.asgi:application
