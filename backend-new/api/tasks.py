import json
import logging
import os
import socket
import ssl
import urllib.error
import urllib.request
from contextlib import contextmanager

import pika
from django.conf import settings
from django.core.mail import EmailMessage, get_connection

from .models import User, OneTimePassword
from .utils import generate_otp

logger = logging.getLogger(__name__)

QUEUES = {
    "custom_mail": "custom_mail",
    "forget_password": "forget_password",
    "onboarding": "onboarding",
    "verification": "verification",
}

DATA_TYPES = {
    "custom_mail": {"email": str, "data": {"content": str}},
    "forget_password": {"email": str, "data": {"token": str}},
    "onboarding": {"email": str, "data": {"city": str}},
    "verification": {"email": str, "data": {"code": str}},
}


def _publish_amqp(queue_name, message):
    connection = pika.BlockingConnection(pika.URLParameters(settings.AMQP_URL))
    channel = connection.channel()
    channel.queue_declare(queue=queue_name, durable=False)
    channel.basic_publish(
        exchange="",
        routing_key=queue_name,
        body=message,
        properties=pika.BasicProperties(delivery_mode=2),
    )
    connection.close()


@contextmanager
def _force_ipv4():
    original = socket.getaddrinfo

    def ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
        return original(host, port, socket.AF_INET, type, proto, flags)

    socket.getaddrinfo = ipv4_only
    try:
        yield
    finally:
        socket.getaddrinfo = original


def _ssl_context():
    try:
        return ssl.create_default_context()
    except Exception:
        return ssl._create_unverified_context()


def _mail_copy(queue_name, payload):
    data = payload.get("data") or {}
    if queue_name == "verification":
        return (
            "Your Climate Wavers verification code",
            (
                f"Your Climate Wavers verification code is {data.get('code')}.\n\n"
                "Enter this code on the verify email page. It replaces any earlier code."
            ),
        )
    if queue_name == "forget_password":
        return ("Forget Password", f"Reset your Climate Wavers password: {data.get('url')}")
    if queue_name == "onboarding":
        return ("Welcome Aboard", "Welcome to Climate Wavers. Verify first. Send second.")
    return ("Climate Wavers", data.get("content") or "A message from Climate Wavers.")


def _post_notification(payload):
    base = (settings.NOTIFICATION_SERVICE_URL or "").rstrip("/")
    if not base:
        raise RuntimeError("NOTIFICATION_SERVICE_URL is not set")
    ctx = _ssl_context()
    try:
        urllib.request.urlopen(urllib.request.Request(f"{base}/status"), timeout=8, context=ctx)
    except Exception:
        logger.warning("Notification service wake-up ping failed")
    request = urllib.request.Request(
        f"{base}/api/v1/mail",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": settings.NOTIFICATION_SECRET or "",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30, context=ctx) as response:
            body = response.read().decode("utf-8", errors="replace")
            logger.info("Notification SMTP ok status=%s body=%s", response.status, body[:500])
            if response.status >= 400:
                raise RuntimeError(f"notification service returned {response.status}: {body[:500]}")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("Notification SMTP HTTP %s: %s", exc.code, body[:1000])
        raise RuntimeError(f"notification service returned {exc.code}: {body[:500]}") from exc


def _resend_from_addresses():
    configured = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER or ""
    lowered = configured.lower()
    addresses = []
    if (
        configured
        and "gmail.com" not in lowered
        and "example.com" not in lowered
        and "yahoo." not in lowered
        and "outlook." not in lowered
        and "hotmail." not in lowered
    ):
        addresses.append(configured)
    addresses.append("Climate Wavers <hello@flowops.africa>")
    addresses.append("Climate Wavers <onboarding@resend.dev>")
    unique = []
    for item in addresses:
        if item not in unique:
            unique.append(item)
    return unique


def _send_resend(queue_name, payload):
    key = getattr(settings, "RESEND_API_KEY", "") or os.environ.get("RESEND_API_KEY", "")
    if not key:
        raise RuntimeError("RESEND_API_KEY is not set")
    email = payload.get("email")
    subject, body = _mail_copy(queue_name, payload)
    last_error = None
    for from_email in _resend_from_addresses():
        request = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(
                {
                    "from": from_email,
                    "to": [email],
                    "subject": subject,
                    "text": body,
                }
            ).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=12, context=_ssl_context()) as response:
                logger.info("Resend ok from=%s status=%s", from_email, response.status)
                return
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(f"resend {exc.code} from {from_email}: {detail[:400]}")
            logger.warning("Resend from %s failed: %s", from_email, last_error)
        except Exception as exc:
            last_error = exc
            logger.warning("Resend from %s failed: %s", from_email, exc)
    raise last_error or RuntimeError("Resend send failed")


def _send_smtp(queue_name, payload):
    if os.environ.get("RENDER"):
        raise RuntimeError("SMTP is blocked on Render")
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        raise RuntimeError("SMTP is not configured")
    email = payload.get("email")
    subject, body = _mail_copy(queue_name, payload)
    last_error = None
    attempts = [
        {"port": 465, "use_ssl": True, "use_tls": False},
        {"port": 587, "use_ssl": False, "use_tls": True},
    ]
    for attempt in attempts:
        try:
            with _force_ipv4():
                connection = get_connection(
                    host=settings.EMAIL_HOST or "smtp.gmail.com",
                    port=attempt["port"],
                    username=settings.EMAIL_HOST_USER,
                    password=settings.EMAIL_HOST_PASSWORD,
                    use_tls=attempt["use_tls"],
                    use_ssl=attempt["use_ssl"],
                    timeout=12,
                )
                EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                    to=[email],
                    connection=connection,
                ).send(fail_silently=False)
            return
        except Exception as exc:
            last_error = exc
            logger.warning(
                "SMTP %s failed type=%s error=%s",
                attempt["port"],
                type(exc).__name__,
                exc,
            )
    raise last_error or RuntimeError("SMTP send failed")


def send_message(queue_name, message):
    """
    On Render, send over HTTPS (Resend). Gmail SMTP ports are blocked.
    """
    payload = json.loads(message) if isinstance(message, str) else message
    errors = []

    try:
        _send_resend(queue_name, payload)
        print(f" [x] Sent {queue_name} via Resend")
        return
    except Exception as exc:
        errors.append(f"resend: {exc}")
        if "RESEND_API_KEY is not set" in str(exc):
            logger.info("Resend skipped: %s", exc)
        else:
            logger.exception("Resend HTTP failed")

    try:
        _post_notification({"type": queue_name, **payload})
        print(f" [x] Sent {queue_name} via notification service")
        return
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, Exception) as exc:
        errors.append(f"http: {exc}")
        logger.exception("Notification send failed")

    try:
        _send_smtp(queue_name, payload)
        print(f" [x] Sent {queue_name} via SMTP")
        return
    except Exception as exc:
        errors.append(f"smtp: {exc}")
        if "not configured" in str(exc) or "blocked on Render" in str(exc):
            logger.info("Direct SMTP skipped: %s", exc)
        else:
            logger.exception("SMTP send failed")

    if settings.AMQP_URL:
        try:
            body = message if isinstance(message, str) else json.dumps(payload)
            _publish_amqp(queue_name, body)
            print(f" [x] Queued {queue_name} on AMQP after direct send failed")
        except Exception as exc:
            errors.append(f"amqp: {exc}")
            logger.exception("AMQP publish failed")

    raise RuntimeError("Email delivery failed: " + "; ".join(errors))


def send_activation_email(email):
    """
    Send an activation email to the user.

    :param email: Email to send verification mail.
    """
    otp_code = generate_otp()
    user = User.objects.get(email=email)
    OneTimePassword.objects.filter(user=user).delete()
    otp_instance = OneTimePassword(user=user, code=otp_code)
    otp_instance.code = otp_instance.encrypt_code(otp_code)
    otp_instance.save()
    data = dict(code=otp_code, city=user.state)
    send_message(
        "verification",
        message=json.dumps(
            {
                "email": email,
                "data": {"code": data["code"], "city": data["city"]},
            }
        ),
    )
    logger.info(f"Successfully sent verification mail to {email}")


def send_reset_password_email(data):
    """
    Send a reset password email to the user.

    :param data: The data to send to queue.
    """

    send_message(
        "forget_password",
        message=json.dumps(
            {
                "email": data["email"],
                "data": {"url": data["url"]},
            }
        ),
    )
    logger.info(f"Successfully sent pasword reset mail to {data['email']}")


def send_onboarding_email(email):
    """
    Send an activation email to the user.

    :param email: Email to send verification mail.
    """
    user = User.objects.get(email=email)
    send_message(
        "onboarding",
        message=json.dumps(
            {
                "email": user.email,
                "data": {"city": user.state},
            }
        ),
    )
    logger.info(f"Successfully sent onboarding mail to {email}")
