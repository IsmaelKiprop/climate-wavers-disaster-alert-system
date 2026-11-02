# core/consumers.py

import json
from channels.generic.websocket import AsyncWebsocketConsumer
import logging


logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4401)
            return

        self.room_name = user.username
        self.room_group_name = f'notifications_{self.room_name}'

        logger.info(
            f"User {self.scope['user']} connected to {self.room_group_name}")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        group = getattr(self, "room_group_name", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def notification_message(self, event):
        notification_id = event['id']
        message = event['message']
        notification_type = event['notification_type']
        user_details = event['user_details']
        content = event['content']
        logger.info(
            f"Notification sent to {user_details['username']}")

        # Send notification with user details
        await self.send(text_data=json.dumps({
            'id': notification_id ,
            'notification_type': notification_type,
            'message': message,
            'content': content,
            'user': user_details  # Include user details in the WebSocket message
        }))
