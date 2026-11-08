# auth/settings.py

import os
import environ
from datetime import timedelta

env = environ.Env(DEBUG=(bool, False))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list(
    "ALLOWED_HOSTS",
    default=[
        "localhost",
        "127.0.0.1",
        ".onrender.com",
        ".railway.app",
        ".fly.dev",
        ".vercel.app",
        "alerts.flowops.africa",
        ".flowops.africa",
        "climatewavers.org",
        "www.climatewavers.org",
    ],
)

BASE_URL = env("BASE_URL", default="http://127.0.0.1:8000")

INSTALLED_APPS = [
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django_cleanup",
    "drf_spectacular",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "core",
    "api",
    "rest_framework",
    "corsheaders",
    "channels",
    "storages",
    'templatetags.filter'
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

def _public_frontend_url(raw, fallback="https://alerts.flowops.africa"):
    """FRONTEND_URL must be one origin. Render sometimes stores a CORS-style comma list."""
    parts = [
        part.strip().rstrip("/")
        for part in str(raw or "").replace(";", ",").split(",")
        if part and part.strip()
    ]
    public = [
        part
        for part in parts
        if part.startswith("https://")
        and "localhost" not in part
        and "127.0.0.1" not in part
    ]
    # Prefer the live product domain over Vercel preview URLs.
    preferred_hosts = (
        "alerts.flowops.africa",
        "climatewavers.org",
        "www.climatewavers.org",
    )
    for host in preferred_hosts:
        for part in public:
            if host in part:
                return part
    if public:
        return public[0]
    if os.environ.get("RENDER"):
        return fallback.rstrip("/")
    if parts:
        return parts[0]
    return fallback.rstrip("/")


FRONTEND_URL = _public_frontend_url(
    env("FRONTEND_URL", default="http://localhost:5173")
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env.list(
    "ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)
CORS_ALLOW_ALL_ORIGINS = env.bool("ALLOW_ALL_ORIGINS", default=DEBUG)
CORS_ALLOWED_ORIGIN_REGEXES = env.list(
    "CORS_ORIGIN_REGEXES",
    default=[
        r"^https://.*\.vercel\.app$",
        r"^https://([a-z0-9-]+\.)?flowops\.africa$",
    ],
)
CORS_ORIGIN_ALLOW_ALL = CORS_ALLOW_ALL_ORIGINS

ROOT_URLCONF = "auth.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
            'libraries': {
                'filter': 'templatetags.filter',
            },
            "builtins": ["templatetags.filter"]
        },
    },
]

WSGI_APPLICATION = "auth.wsgi.application"
ASGI_APPLICATION = "auth.asgi.application"

# Database: Supabase / any Postgres via DATABASE_URL, otherwise SQLite
DATABASE_URL = env("DATABASE_URL", default=None)
if DATABASE_URL:
    DATABASES = {"default": env.db("DATABASE_URL")}
    uses_supabase_pooler = (
        "pooler.supabase.com" in DATABASE_URL or ":6543" in DATABASE_URL
    )
    ssl_required = env.bool(
        "DB_SSL_REQUIRE",
        default=("supabase.co" in DATABASE_URL or uses_supabase_pooler),
    )
    if ssl_required:
        DATABASES["default"].setdefault("OPTIONS", {})
        DATABASES["default"]["OPTIONS"]["sslmode"] = "require"
    if env.bool("DB_DISABLE_SERVER_SIDE_CURSORS", default=uses_supabase_pooler):
        DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True
        DATABASES["default"]["CONN_MAX_AGE"] = 0
    else:
        DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": env("SQLITE_PATH", default=os.path.join(BASE_DIR, "db.sqlite3")),
        }
    }

AUTH_USER_MODEL = "api.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=60),
    "AUTH_HEADER_TYPES": ("Bearer",),
    'ROTATE_REFRESH_TOKENS': True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "ClimateWavers API Documentation",
    "DESCRIPTION": "API documentation for ClimateWavers",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

UNFOLD = {
    "SITE_TITLE": "ClimateWavers",
    "SITE_HEADER": "ClimateWavers Portal",
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Connection URL for RabbitMQ (optional for development)
AMQP_URL = env("AMQP_URL", default=None)
NOTIFICATION_SERVICE_URL = env(
    "NOTIFICATION_SERVICE_URL",
    default="https://climate-wavers-notifications.onrender.com",
)
NOTIFICATION_SECRET = env(
    "NOTIFICATION_SECRET",
    default=os.environ.get("SERVER_SECRET", "change-me-server-secret"),
)
RESPONSE_SYSTEM_URL = env(
    "RESPONSE_SYSTEM_URL",
    default="https://climate-wavers-response.onrender.com",
)
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = env("MAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("MAIL_PORT", default=587)
EMAIL_HOST_USER = env("MAIL_USER", default="")
EMAIL_HOST_PASSWORD = env("MAIL_PASS", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=8)
DEFAULT_FROM_EMAIL = env(
    "MAIL_FROM",
    default=EMAIL_HOST_USER or "Climate Wavers <hello@flowops.africa>",
)
RESEND_API_KEY = env("RESEND_API_KEY", default="")


# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "static")
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# Public origin of this API (used to build absolute media URLs)
BACKEND_HOST = env("BACKEND_HOST", default=BASE_URL)

# Storage: local disk, or S3-compatible (Supabase Storage)
STORAGE_BACKEND = env("STORAGE_BACKEND", default="local")
USE_S3_STORAGE = STORAGE_BACKEND in ("s3", "supabase")

if USE_S3_STORAGE:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="media")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="us-east-1")
    AWS_S3_ADDRESSING_STYLE = env("AWS_S3_ADDRESSING_STYLE", default="path")
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH", default=False)
    AWS_S3_CUSTOM_DOMAIN = env("AWS_S3_CUSTOM_DOMAIN", default=None)
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
            if not DEBUG
            else "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
    if AWS_S3_CUSTOM_DOMAIN:
        MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN.rstrip('/')}/"
    elif AWS_S3_ENDPOINT_URL:
        MEDIA_URL = f"{AWS_S3_ENDPOINT_URL.rstrip('/')}/{AWS_STORAGE_BUCKET_NAME}/"
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
            if not DEBUG
            else "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }

WHITENOISE_USE_FINDERS = True
WHITENOISE_ALLOW_ALL_ORIGINS = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FERNET_KEY = env("FERNET_KEY").encode()
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)

MALE_AVATAR = env(
    "MALE_AVATAR",
    default="https://ui-avatars.com/api/?name=M&background=0D8ABC&color=fff",
)
FEMALE_AVATAR = env(
    "FEMALE_AVATAR",
    default="https://ui-avatars.com/api/?name=F&background=E91E63&color=fff",
)

# Required when the API sits behind Render / Railway / Fly / Vercel proxies
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = env.bool("USE_X_FORWARDED_HOST", default=True)
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=not DEBUG)
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE", default="Lax")
CSRF_COOKIE_SAMESITE = env("CSRF_COOKIE_SAMESITE", default="Lax")

# Determine if SSL is required (for production)
REDIS_USE_SSL = env.bool("REDIS_USE_SSL", default=False)

# Celery Configuration
CELERY_BROKER_URL = env("REDIS", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Redis configuration (optional for development)
try:
    redis_url = env("REDIS")
    if redis_url:
        # Dynamically build the Redis configuration
        redis_host = {
            "address": redis_url,
        }

        # Only include SSL settings if SSL is required
        if REDIS_USE_SSL:
            redis_host["ssl_cert_reqs"] = None

        CHANNEL_LAYERS = {
            "default": {
                "BACKEND": "channels_redis.core.RedisChannelLayer",
                "CONFIG": {
                    "hosts": [redis_host],
                },
            },
        }
    else:
        # Fallback to in-memory channel layer for development
        CHANNEL_LAYERS = {
            "default": {
                "BACKEND": "channels.layers.InMemoryChannelLayer",
            },
        }
except:
    # Fallback to in-memory channel layer for development
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }

