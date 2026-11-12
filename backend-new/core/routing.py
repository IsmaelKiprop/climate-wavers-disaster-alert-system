# core/routing.py

from django.urls import re_path
from . import consumers
from . import chat_consumers

websocket_urlpatterns = [
    re_path(r'ws/notifications/$', consumers.NotificationConsumer.as_asgi()),
    re_path(r'ws/chat/$', chat_consumers.ChatConsumer.as_asgi()),
]

