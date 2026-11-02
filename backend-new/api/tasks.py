import json
import logging
import urllib.error
import urllib.request

import pika
from django.conf import settings
from django.core.mail import EmailMessage

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


def _post_notification(payload):
    base = (settings.NOTIFICATION_SERVICE_URL or "").rstrip("/")
    if not base:
        raise RuntimeError("NOTIFICATION_SERVICE_URL is not set")
    request = urllib.request.Request(
        f"{base}/api/v1/mail",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": settings.NOTIFICATION_SECRET or "",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status >= 400:
            raise RuntimeError(f"notification service returned {response.status}")


def _send_smtp(queue_name, payload):
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        raise RuntimeError("SMTP is not configured")
    email = payload.get("email")
    data = payload.get("data") or {}
    if queue_name == "verification":
        subject = "Your Climate Wavers verification code"
        body = (
            f"Your Climate Wavers verification code is {data.get('code')}.\n\n"
            "Enter this code on the verify email page. It replaces any earlier code."
        )
    elif queue_name == "forget_password":
        subject = "Forget Password"
        body = f"Reset your Climate Wavers password: {data.get('url')}"
    elif queue_name == "onboarding":
        subject = "Welcome Aboard"
        body = "Welcome to Climate Wavers. Verify first. Send second."
    else:
        subject = "Climate Wavers"
        body = data.get("content") or "A message from Climate Wavers."
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    message.send(fail_silently=False)


def send_message(queue_name, message):
    """
    Deliver an email via the notifications HTTP API, then SMTP.
    AMQP is last because a queued message is not a sent email.
    """
    payload = json.loads(message) if isinstance(message, str) else message
    errors = []

    try:
        _post_notification({"type": queue_name, **payload})
        print(f" [x] Sent {queue_name} via notification service")
        return
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, RuntimeError, Exception) as exc:
        errors.append(f"http: {exc}")
        logger.exception("Notification HTTP failed")

    try:
        _send_smtp(queue_name, payload)
        print(f" [x] Sent {queue_name} via SMTP")
        return
    except Exception as exc:
        errors.append(f"smtp: {exc}")
        logger.exception("SMTP send failed")

    if settings.AMQP_URL:
        try:
            body = message if isinstance(message, str) else json.dumps(payload)
            _publish_amqp(queue_name, body)
            print(f" [x] Queued {queue_name} on AMQP after direct send failed")
            return
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
