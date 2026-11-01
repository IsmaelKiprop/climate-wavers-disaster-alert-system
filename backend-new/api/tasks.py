import pika
import os
import json
import logging
from django.conf import settings
from .models import User, OneTimePassword
from .utils import generate_otp

# Configure logging
logger = logging.getLogger(__name__)

# Define queues for different message types
QUEUES = {
    "custom_mail": "custom_mail",
    "forget_password": "forget_password",
    "onboarding": "onboarding",
    "verification": "verification",
}

# Define data types for different messages
DATA_TYPES = {
    "custom_mail": {"email": str, "data": {"content": str}},
    "forget_password": {"email": str, "data": {"token": str}},
    "onboarding": {"email": str, "data": {"city": str}},
    "verification": {"email": str, "data": {"code": str}},
}


def send_message(queue_name, message):
    """
    Send a message to a RabbitMQ queue.

    :param queue_name: The name of the queue to send the message to.
    :param message: The message to be sent.
    """
    if not settings.AMQP_URL:
        raise RuntimeError("AMQP_URL is not set; email queue is unavailable")

    connection = pika.BlockingConnection(pika.URLParameters(settings.AMQP_URL))
    channel = connection.channel()

    # Declare the queue
    channel.queue_declare(queue=queue_name, durable=False)

    # Publish the message
    channel.basic_publish(
        exchange="",
        routing_key=queue_name,
        body=message,
        properties=pika.BasicProperties(
            delivery_mode=2,  # Make message persistent
        ),
    )

    print(f" [x] Sending data to {queue_name} queue")

    # Close connection
    connection.close()


def send_activation_email(email):
    """
    Send an activation email to the user.

    :param email: Email to send verification mail.
    """
    otp_code = generate_otp()
    user = User.objects.get(email=email)
    # Hash the OTP before saving it
    otp_instance = OneTimePassword(user=user, code=otp_code)
    otp_instance.code = otp_instance.encrypt_code(otp_code)  # Encrypt the OTP
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
                # Assuming token.token is a string
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
