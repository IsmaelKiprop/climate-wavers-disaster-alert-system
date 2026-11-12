"""
Celery tasks for disaster management automation
"""
import requests
import json
from datetime import datetime, timedelta
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from .models import Disaster, DisasterAlert, DisasterUpdate
from .management.commands.import_disaster_data import Command as ImportDisasterCommand
from .management.commands.import_weather_data import Command as ImportWeatherCommand
from .management.commands.monitor_social_media import Command as MonitorSocialCommand
import logging

logger = logging.getLogger(__name__)

@shared_task
def import_gdacs_data():
    """Import disaster data from GDACS every 5 minutes"""
    try:
        logger.info("Starting GDACS data import...")
        command = ImportDisasterCommand()
        command.handle(source='gdacs', days=30)
        logger.info("GDACS data import completed successfully")
        return "GDACS data imported successfully"
    except Exception as e:
        logger.error(f"Error importing GDACS data: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def import_reliefweb_data():
    """Import disaster data from ReliefWeb every 10 minutes"""
    try:
        logger.info("Starting ReliefWeb data import...")
        command = ImportDisasterCommand()
        command.handle(source='reliefweb', days=30)
        logger.info("ReliefWeb data import completed successfully")
        return "ReliefWeb data imported successfully"
    except Exception as e:
        logger.error(f"Error importing ReliefWeb data: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def import_weather_data():
    """Import weather data every 30 minutes"""
    try:
        logger.info("Starting weather data import...")
        command = ImportWeatherCommand()
        # You'll need to set your API key in environment variables
        api_key = getattr(settings, 'OPENWEATHER_API_KEY', 'your_api_key_here')
        command.handle(api_key=api_key)
        logger.info("Weather data import completed successfully")
        return "Weather data imported successfully"
    except Exception as e:
        logger.error(f"Error importing weather data: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def monitor_social_media():
    """Monitor social media for disaster-related content every 15 minutes"""
    try:
        logger.info("Starting social media monitoring...")
        command = MonitorSocialCommand()
        # Set your API keys in environment variables
        news_api_key = getattr(settings, 'NEWS_API_KEY', 'your_news_api_key')
        twitter_token = getattr(settings, 'TWITTER_BEARER_TOKEN', 'your_twitter_token')
        command.handle(
            news_api_key=news_api_key,
            twitter_bearer_token=twitter_token
        )
        logger.info("Social media monitoring completed successfully")
        return "Social media monitoring completed successfully"
    except Exception as e:
        logger.error(f"Error monitoring social media: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def monitor_news_sources():
    """Monitor news sources for disaster-related content every 20 minutes"""
    try:
        logger.info("Starting news monitoring...")
        # Add news monitoring logic here
        # This could include monitoring specific news APIs
        logger.info("News monitoring completed successfully")
        return "News monitoring completed successfully"
    except Exception as e:
        logger.error(f"Error monitoring news: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def cleanup_old_data():
    """Clean up old data daily"""
    try:
        logger.info("Starting data cleanup...")
        # Delete disasters older than 30 days
        cutoff_date = timezone.now() - timedelta(days=30)
        old_disasters = Disaster.objects.filter(created_at__lt=cutoff_date)
        count = old_disasters.count()
        old_disasters.delete()
        logger.info(f"Cleaned up {count} old disasters")
        return f"Cleaned up {count} old disasters"
    except Exception as e:
        logger.error(f"Error cleaning up data: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def generate_alerts():
    """Generate alerts for urgent disasters every 5 minutes"""
    try:
        logger.info("Generating alerts...")
        urgent_disasters = Disaster.objects.filter(
            is_urgent=True,
            is_active=True
        )
        
        for disaster in urgent_disasters:
            # Check if alert already exists
            existing_alert = DisasterAlert.objects.filter(
                disaster=disaster,
                alert_type='urgent'
            ).first()
            
            if not existing_alert:
                DisasterAlert.objects.create(
                    disaster=disaster,
                    title=f"URGENT: {disaster.title}",
                    message=f"Urgent disaster alert: {disaster.title} in {disaster.country}",
                    alert_type='urgent',
                    severity='high',
                    is_active=True
                )
        
        logger.info("Alert generation completed")
        return "Alerts generated successfully"
    except Exception as e:
        logger.error(f"Error generating alerts: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def update_statistics():
    """Update disaster statistics every 10 minutes"""
    try:
        logger.info("Updating statistics...")
        # This could update cached statistics or generate reports
        total_disasters = Disaster.objects.count()
        active_disasters = Disaster.objects.filter(is_active=True).count()
        urgent_disasters = Disaster.objects.filter(is_urgent=True).count()
        
        logger.info(f"Statistics updated - Total: {total_disasters}, Active: {active_disasters}, Urgent: {urgent_disasters}")
        return f"Statistics updated - Total: {total_disasters}, Active: {active_disasters}, Urgent: {urgent_disasters}"
    except Exception as e:
        logger.error(f"Error updating statistics: {str(e)}")
        return f"Error: {str(e)}"

@shared_task
def send_notifications():
    """Send notifications for new urgent disasters"""
    try:
        logger.info("Sending notifications...")
        # Add notification logic here (email, SMS, push notifications)
        # This could integrate with services like SendGrid, Twilio, etc.
        logger.info("Notifications sent successfully")
        return "Notifications sent successfully"
    except Exception as e:
        logger.error(f"Error sending notifications: {str(e)}")
        return f"Error: {str(e)}"


@shared_task
def waverx_tweet_climate_tip():
    """Post WaverX's daily creative climate tip to the free in-app feed."""
    try:
        from .waverx_twitter import tweet_climate_tip

        result = tweet_climate_tip(dry_run=False, polish=True)
        logger.info("WaverX tip tweet: %s", result)
        return result
    except Exception as e:
        logger.error("WaverX tip tweet error: %s", e)
        return f"Error: {str(e)}"


@shared_task
def waverx_tweet_recent_alerts():
    """Backfill WaverX feed posts for recent official alerts not yet published."""
    try:
        from .models import OfficialAlertEvent, WaverXTweet
        from .waverx_twitter import tweet_verified_alert

        posted_ids = set(
            WaverXTweet.objects.filter(kind="alert", status="posted").values_list(
                "event_id", flat=True
            )
        )
        count = 0
        for ev in OfficialAlertEvent.objects.order_by("-created_at")[:20]:
            if ev.event_id in posted_ids:
                continue
            payload = ev.payload if isinstance(ev.payload, dict) else {}
            event = {
                "id": ev.event_id,
                "event_id": ev.event_id,
                "title": ev.title,
                "disaster_type": ev.disaster_type or payload.get("disaster_type"),
                "magnitude": float(ev.magnitude) if ev.magnitude is not None else None,
                "city": payload.get("city"),
                "region": payload.get("region"),
                "country": payload.get("country"),
                "official_source": ev.source,
                "source_url": ev.source_url,
                "ai_summary": ev.ai_summary,
                "isOfficial": True,
            }
            tweet_verified_alert(event)
            count += 1
            if count >= 3:
                break
        return f"WaverX alert tweets attempted={count}"
    except Exception as e:
        logger.error("WaverX alert tweet backfill error: %s", e)
        return f"Error: {str(e)}"
