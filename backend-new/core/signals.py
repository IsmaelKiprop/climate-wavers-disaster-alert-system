import logging

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Post, Comment, Reaction, Repost, PollInteraction, Notification, Follow, Bookmark
from .serializers import PostSerializer, CommentSerializer
from . import social_email
from api.models import User
from django.contrib.contenttypes.models import ContentType
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

channel_layer = get_channel_layer()
logger = logging.getLogger(__name__)


def send_to_websocket(notification_id, group_name, message, noticee_user, notification_type, content=None):
    """Best-effort live push; never break follow/comment saves if Channels is down."""
    layer = channel_layer or get_channel_layer()
    if layer is None:
        return

    profile = getattr(noticee_user, "profile_picture", None)
    try:
        profile_image = profile.url if profile and hasattr(profile, "url") else profile
    except Exception:
        profile_image = None

    user_details = {
        "id": getattr(noticee_user, "id", None),
        "username": noticee_user.username,
        "email": getattr(noticee_user, "email", None),
        "profile_image": profile_image,
        "profile_picture": profile_image,
        "first_name": getattr(noticee_user, "first_name", ""),
        "last_name": getattr(noticee_user, "last_name", ""),
    }

    try:
        async_to_sync(layer.group_send)(
            f"notifications_{group_name}",
            {
                "id": notification_id,
                "type": "notification_message",
                "message": message,
                "content": content,
                "notification_type": notification_type,
                "user_details": user_details,
            },
        )
    except Exception as exc:
        logger = __import__("logging").getLogger(__name__)
        logger.warning("Websocket notification failed: %s", exc)


@receiver(post_save, sender=Post)
def notify_followers_on_post_creation(sender, instance, created, **kwargs):
    if created:
        followers = instance.user.followers.all()
        for follower in followers:
            # Skip notification if the follower is the post author
            follower = follower.follower
            if follower != instance.user:
                notification = Notification.objects.create(
                    user=follower,
                    notification_type='post',
                    object_id=instance.id,
                    content_type=ContentType.objects.get_for_model(Post),
                    message=f'{instance.user.username} just made a new post'
                )
                send_to_websocket(
                    notification.id,
                    follower.username,
                    notification.message,
                    instance.user,
                    notification.notification_type,
                    PostSerializer(instance,  context={'request': None}).data)
                social_email.send_social_email(
                    follower,
                    subject=f"{instance.user.username} posted on Climate Wavers",
                    message=notification.message,
                    link=social_email.post_url(instance.id),
                )


@receiver(post_save, sender=Comment)
def notify_post_author_and_commenters(sender, instance, created, **kwargs):
    if created:
        post_author = instance.post.user
        commenters = Comment.objects.filter(post=instance.post).exclude(
            user=instance.user).values_list('user', flat=True)

        # Notify the post author if the commenter is not the post author
        if post_author != instance.user:
            notification = Notification.objects.create(
                user=post_author,
                notification_type='comment',
                object_id=instance.id,
                content_type=ContentType.objects.get_for_model(Comment),
                message=f'{instance.user.username} commented on your post'
            )
            send_to_websocket(
                notification.id,
                post_author.username,
                notification.message,
                instance.user,
                notification.notification_type,
                CommentSerializer(instance,  context={'request': None}).data
            )
            social_email.send_social_email(
                post_author,
                subject=f"{instance.user.username} commented on your post",
                message=notification.message,
                link=social_email.post_url(instance.post_id),
            )

        # Notify other commenters

        for commenter_id in commenters:
            commenter = User.objects.get(id=commenter_id)
            notification = Notification.objects.create(
                user=commenter,
                notification_type='comment',
                object_id=instance.id,
                content_type=ContentType.objects.get_for_model(Comment),
                message=f'{instance.user.username} replied to a post you commented on',
            )
            send_to_websocket(
                notification.id,
                commenter.username,
                notification.message,
                instance.user,
                notification.notification_type,
                CommentSerializer(instance,  context={'request': None}).data
            )
            social_email.send_social_email(
                commenter,
                subject=f"{instance.user.username} replied on a post you commented on",
                message=notification.message,
                link=social_email.post_url(instance.post_id),
            )


@receiver(post_save, sender=Reaction)
def notify_author_on_reaction(sender, instance, created, **kwargs):
    if created:
        if instance.content_type == ContentType.objects.get_for_model(Post):
            post = Post.objects.get(id=instance.object_id)
            content_author = post.user
            content_id = post.id
            content = PostSerializer(post,  context={'request': None}).data
        elif instance.content_type == ContentType.objects.get_for_model(Comment):
            comment = Comment.objects.get(id=instance.object_id)
            content_author = comment.user
            content_id = comment.id
            content = CommentSerializer(
                comment,  context={'request': None}).data
        else:
            return

        # Skip notification if the user reacting is the content author
        if content_author != instance.user:
            notification = Notification.objects.create(
                user=content_author,
                notification_type='reaction',
                object_id=content_id,
                content_type=instance.content_type,
                message=f'{instance.user.username} liked your {instance.content_type.model}'
            )
            send_to_websocket(
                notification.id,
                content_author.username,
                notification.message,
                instance.user,
                notification.notification_type,
                content
            )
            social_email.send_social_email(
                content_author,
                subject=f"{instance.user.username} liked your {instance.content_type.model}",
                message=notification.message,
                link=(
                    social_email.post_url(content_id)
                    if instance.content_type == ContentType.objects.get_for_model(Post)
                    else social_email.notifications_url()
                ),
            )


@receiver(post_save, sender=Repost)
def notify_original_post_author(sender, instance, created, **kwargs):
    if created:
        if instance.content_type == ContentType.objects.get_for_model(Post):
            post = Post.objects.get(id=instance.object_id)
            original_post_author = post.user
            content_id = post.id
            content = PostSerializer(post,  context={'request': None}).data
        elif instance.content_type == ContentType.objects.get_for_model(Comment):
            comment = Comment.objects.get(id=instance.object_id)
            original_post_author = comment.user
            content_id = comment.id
            content = CommentSerializer(
                comment,  context={'request': None}).data

        # Skip notification if the user reposting is the original post author
        if original_post_author != instance.user:
            notification = Notification.objects.create(
                user=original_post_author,
                notification_type='repost',
                object_id=content_id,
                content_type=instance.content_type,
                message=f'{instance.user.username} reposted your {instance.content_type.model}'
            )
            send_to_websocket(
                notification.id,
                original_post_author.username,
                notification.message,
                instance.user,
                notification.notification_type,
                content
            )
            social_email.send_social_email(
                original_post_author,
                subject=f"{instance.user.username} reposted your {instance.content_type.model}",
                message=notification.message,
                link=social_email.post_url(content_id),
            )


@receiver(post_save, sender=PollInteraction)
def notify_poll_participants(sender, instance, created, **kwargs):
    if created:
        poll = instance.poll
        participants = poll.participants.all()

        for participant in participants:
            # Skip notification if the participant is the user interacting with the poll
            if participant != instance.user:
                Notification.objects.create(
                    user=participant,
                    notification_type='poll',
                    object_id=instance.id,
                    content_type=instance.content_type,
                    message=f'There is a new update on the poll you are part of: "{poll.title}"'
                )


@receiver(post_save, sender=Follow)
def notify_user_on_new_follower(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.following_id == instance.follower_id:
        return
    try:
        notification = Notification.objects.create(
            user=instance.following,
            notification_type="follow",
            object_id=instance.id,
            content_type=ContentType.objects.get_for_model(Follow),
            message=f"{instance.follower.username} has started following you.",
        )
        send_to_websocket(
            notification.id,
            instance.following.username,
            notification.message,
            instance.follower,
            notification.notification_type,
            content={
                "follower": {
                    "id": instance.follower_id,
                    "username": instance.follower.username,
                    "first_name": getattr(instance.follower, "first_name", ""),
                    "last_name": getattr(instance.follower, "last_name", ""),
                }
            },
        )
        social_email.send_social_email(
            instance.following,
            subject=f"{instance.follower.username} started following you",
            message=notification.message,
            link=social_email.profile_url(instance.follower_id),
        )
    except Exception as exc:
        logger.warning("Follow notification failed: %s", exc)


@receiver(post_save, sender=Bookmark)
def notify_author_on_bookmark(sender, instance, created, **kwargs):
    if created:
        if instance.content_type == ContentType.objects.get_for_model(Post):
            post = Post.objects.get(id=instance.object_id)
            original_post_author = post.user
            content_id = post.id
            content = PostSerializer(post,  context={'request': None}).data
        elif instance.content_type == ContentType.objects.get_for_model(Comment):
            comment = Comment.objects.get(id=instance.object_id)
            original_post_author = comment.user
            content_id = comment.id
            content = CommentSerializer(
                comment,  context={'request': None}).data
        else:
            return

        # Skip notification if the user bookmarking is the original post author
        if original_post_author != instance.user:
            notification = Notification.objects.create(
                user=original_post_author,
                notification_type='bookmark',
                object_id=content_id,
                content_type=instance.content_type,
                message=f'{instance.user.username} bookmarked your {instance.content_type.model}'
            )
            send_to_websocket(
                notification.id,
                original_post_author.username,
                notification.message,
                instance.user,
                notification.notification_type,
                content
            )
            social_email.send_social_email(
                original_post_author,
                subject=f"{instance.user.username} bookmarked your {instance.content_type.model}",
                message=notification.message,
                link=social_email.post_url(content_id),
            )
