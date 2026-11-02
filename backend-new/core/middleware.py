# myproject/middleware.py

import jwt
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.conf import settings
from urllib.parse import parse_qs
import logging
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')
application = get_wsgi_application()

from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class JwtAuthMiddleware(BaseMiddleware):

    async def __call__(self, scope, receive, send):
        # Extract JWT token from query parameters
        token = self.get_token_from_query_params(scope)
        if token:
            try:
                # Verify JWT token and authenticate user
                logger.info("Decoding user token...")
                payload = jwt.decode(
                    token, settings.SECRET_KEY, algorithms=['HS256'])
                user = await self.get_user(payload.get('user_id') or payload.get('userId') or payload.get('id'))
                scope['user'] = user
            except jwt.ExpiredSignatureError:
                scope['user'] = AnonymousUser()
            except jwt.InvalidTokenError:
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    def get_token_from_query_params(self, scope):
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        return query_params.get('token', [None])[0]

    @database_sync_to_async
    def get_user(self, user_id):
        from api.models import User
        if not user_id:
            return AnonymousUser()
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
