#!/bin/sh
set -e

python manage.py makemigrations --noinput
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py create_admins

PORT="${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "$PORT" auth.asgi:application
