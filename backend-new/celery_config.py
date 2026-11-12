"""
Celery configuration for disaster management automation
"""
import os
from celery import Celery
from django.conf import settings

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')

app = Celery('disaster_management')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Celery Beat schedule for periodic tasks
app.conf.beat_schedule = {
    'import-gdacs-data': {
        'task': 'core.tasks.import_gdacs_data',
        'schedule': 300.0,  # Every 5 minutes
    },
    'import-reliefweb-data': {
        'task': 'core.tasks.import_reliefweb_data',
        'schedule': 600.0,  # Every 10 minutes
    },
    'import-weather-data': {
        'task': 'core.tasks.import_weather_data',
        'schedule': 1800.0,  # Every 30 minutes
    },
    'monitor-social-media': {
        'task': 'core.tasks.monitor_social_media',
        'schedule': 900.0,  # Every 15 minutes
    },
    'monitor-news-sources': {
        'task': 'core.tasks.monitor_news_sources',
        'schedule': 1200.0,  # Every 20 minutes
    },
    'cleanup-old-data': {
        'task': 'core.tasks.cleanup_old_data',
        'schedule': 86400.0,  # Daily
    },
    'generate-alerts': {
        'task': 'core.tasks.generate_alerts',
        'schedule': 300.0,  # Every 5 minutes
    },
    'update-statistics': {
        'task': 'core.tasks.update_statistics',
        'schedule': 600.0,  # Every 10 minutes
    },
    'waverx-daily-climate-tip': {
        'task': 'core.tasks.waverx_tweet_climate_tip',
        'schedule': 86400.0,  # Daily
    },
    'waverx-alert-tweet-backfill': {
        'task': 'core.tasks.waverx_tweet_recent_alerts',
        'schedule': 2700.0,  # Every 45 minutes
    },
}

app.conf.timezone = 'UTC'

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')




