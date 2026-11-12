from rest_framework import viewsets
from django.db.models import Count, Q, Exists, OuterRef, Value, BooleanField
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import get_user_model
from django.http import Http404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings
import json
import re
import os
import uuid
import requests
from datetime import datetime, timedelta
from .models import (
    Notification,
    Post,
    Poll,
    PollVote,
    Comment,
    Reaction,
    Repost,
    View,
    Follow,
    Bookmark,
    TreeProject,
    TreeProjectUpdate,
    TreeProjectDonation,
    Disaster,
)
from .paystack_payment import (
    PaymentRecordError,
    claim_tree_donations,
    payment_product_type,
    record_paystack_charge,
    record_rapidbrief_payment,
    record_tree_payment,
    user_from_request,
    webhook_signature_ok,
)
from .serializers import (
    NotificationSerializer,
    UserSerializer,
    OnlineUserSerializer,
    PostAuthorSerializer,
    PostSerializer,
    PollSerializer,
    PollVoteSerializer,
    CommentSerializer,
    ReactionSerializer,
    RepostSerializer,
    ViewSerializer,
    FollowSerializer,
    BookmarkSerializer,
    UserActivitySerializer,
    TreeProjectSerializer,
    TreeProjectCreateSerializer,
    TreeProjectUpdateSerializer,
    TreeProjectUpdateCreateSerializer,
    TreeProjectDonationSerializer,
    TreeProjectDonationCreateSerializer,
    DisasterSerializer,
)
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.http import JsonResponse, Http404
from django.db import models
from django.utils import timezone

# Get the custom user model
User = get_user_model()


# Pagination for Posts
class PostPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )

    def get_serializer_context(self):
        return {'request': self.request}


class MarkNotificationsAsReadView(generics.UpdateAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        notifications = Notification.objects.filter(
            user=request.user, is_read=False)
        notifications.update(is_read=True)
        return Response(
            {"status": "Notifications marked as read"}, status=status.HTTP_200_OK
        )


# ViewSet for Post model
class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related("user").order_by("-created_at")
    serializer_class = PostSerializer
    pagination_class = PostPagination
    permission_classes = []  # Allow public access for trending and posts

    def perform_create(self, serializer):
        """
        Override perform_create to save the post and extract hashtags from the content.
        """
        post = serializer.save(user=self.request.user)
        post.hashtags = post.extract_hashtags(post.content)
        post.save()

    def perform_update(self, serializer):
        """
        Override perform_update to update the post and extract hashtags from the content.
        """
        post = serializer.save()
        post.hashtags = post.extract_hashtags(post.content)
        post.save()

    def destroy(self, request, *args, **kwargs):
        """
        Override destroy to ensure only the post owner can delete their posts.
        """
        post = self.get_object()
        
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required to delete posts."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if user is the owner of the post
        if post.user != request.user:
            return Response(
                {"detail": "You can only delete your own posts."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Delete the post
        post.delete()
        return Response(
            {"detail": "Post deleted successfully."},
            status=status.HTTP_200_OK
        )

    def get_queryset(self):
        """
        Override get_queryset to add annotations for comment, reaction, view, and repost counts.
        Friends-only posts are visible to the author and people who follow them.
        """
        from django.db.models import Q

        queryset = super().get_queryset().select_related("user")

        queryset = queryset.annotate(
            total_comments=Count("comments", distinct=True),
            total_reactions=Count("reactions", distinct=True),
            total_views=Count("views", distinct=True),
            total_reposts=Count("reposts", distinct=True),
            total_bookmarks=Count("bookmarks", distinct=True),
        )

        user = getattr(self.request, "user", None)
        if user is not None and user.is_authenticated:
            following_ids = Follow.objects.filter(follower=user).values_list(
                "following_id", flat=True
            )
            queryset = queryset.filter(
                Q(visibility="Everyone")
                | Q(user=user)
                | Q(visibility="Friends", user_id__in=following_ids)
            )
            queryset = queryset.annotate(
                is_reacted=Exists(
                    Reaction.objects.filter(post_id=OuterRef("pk"), user=user)
                ),
                is_bookmarked=Exists(
                    Bookmark.objects.filter(post_id=OuterRef("pk"), user=user)
                ),
                is_reposted=Exists(
                    Repost.objects.filter(post_id=OuterRef("pk"), user=user)
                ),
                author_is_following=Exists(
                    Follow.objects.filter(
                        follower=user, following_id=OuterRef("user_id")
                    )
                ),
            )
        else:
            queryset = queryset.filter(visibility="Everyone")
            queryset = queryset.annotate(
                is_reacted=Value(False, output_field=BooleanField()),
                is_bookmarked=Value(False, output_field=BooleanField()),
                is_reposted=Value(False, output_field=BooleanField()),
                author_is_following=Value(False, output_field=BooleanField()),
            )
        return queryset

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = getattr(self.request, "user", None)
        if user is not None and user.is_authenticated:
            ctx["following_ids"] = set(
                Follow.objects.filter(follower=user).values_list(
                    "following_id", flat=True
                )
            )
        else:
            ctx["following_ids"] = set()
        return ctx

    @action(detail=False, methods=["get"])
    def search_by_hashtag(self, request):
        """
        Custom action to search posts by hashtag with additional filters for user type and location.
        """
        hashtag = request.query_params.get("hashtag", None)
        filter_by = request.query_params.get("filter_by", "anyone")
        location = request.query_params.get("location", "anywhere")

        if not hashtag:
            return Response(
                {"detail": "Hashtag not provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Filter posts by hashtag
        posts = Post.objects.filter(hashtags__icontains=hashtag)

        # Filter by user type (e.g., following)
        if filter_by == "following":
            posts = posts.filter(
                user__in=request.user.following.values("following"))

        # Filter by location (e.g., near_me)
        if location == "near_me":
            usersry = request.user.country  # Assuming user has a country field
            user_state = request.user.state  # Assuming user has a state field
            posts = posts.filter(user_sry=usersry, user__state=user_state)

        # Annotate the queryset with reactions, comments, etc.
        posts = posts.annotate(
            total_reactions=Count("reactions"),
            total_comments=Count("comments"),
            total_views=Count("views"),
            total_reposts=Count("reposts")
        )

        # Get top posts (based on reactions)
        top_posts = posts.order_by("-reactions")[:10]

        # Get latest posts
        latest_posts = posts.order_by("-created_at")[:10]

        # Get media posts (posts with images or audio)
        media_posts = posts.filter(
            Q(image__isnull=False) | Q(audio__isnull=False))

        # Get people associated with the hashtag
        associated_people = User.objects.filter(post__in=posts).distinct()

        return Response(
            {
                "top_posts": PostSerializer(top_posts, many=True).data,
                "latest_posts": PostSerializer(latest_posts, many=True).data,
                "media_posts": PostSerializer(media_posts, many=True).data,
                "associated_people": UserSerializer(associated_people, many=True).data,
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def react(self, request, pk=None):
        """
        Custom action to react to a post.
        """
        post = self.get_object()
        user = request.user

        existing_reaction = Reaction.objects.filter(user=user, post=post).first()

        if existing_reaction:
            return Response(
                {"status": "You have already reacted to this post."},
                status=status.HTTP_400_BAD_REQUEST
            )
        Reaction.objects.create(
            user=user,
            post=post,
            content_object=post
        )

        return Response({"status": "Reaction added successfully."}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unreact(self, request, pk=None):
        """
        Custom action to remove a reaction from a post.
        """
        post = self.get_object()
        Reaction.objects.filter(
            user=request.user, post=post).delete()
        return Response({"status": "reaction removed"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def repost(self, request, pk=None):
        """
        Custom action to repost a post.
        """
        post = self.get_object()
        Repost.objects.create(
            user=request.user, post=post, content_object=post)
        return Response({"status": "a reaction to post"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unrepost(self, request, pk=None):
        """
        Custom action to remove a repost of a post.
        """
        post = self.get_object()
        Repost.objects.filter(user=request.user, post=post).delete()
        return Response({"status": "reaction removed"})

    @action(detail=False, methods=["get"])
    def trending(self, request):
        """
        Return individual hashtags ranked by how often they appear in posts.
        """
        counts = {}
        values = (
            Post.objects.exclude(hashtags__isnull=True)
            .exclude(hashtags="")
            .values_list("hashtags", flat=True)
        )
        for raw in values:
            for tag in re.findall(r"[#]?([A-Za-z0-9_]{2,})", raw or ""):
                key = tag.lower()
                counts[key] = counts.get(key, 0) + 1
        ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:10]
        return Response([{"hashtags": tag, "count": count} for tag, count in ranked])

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def bookmark(self, request, pk=None):
        """
        Custom action to bookmark a post.
        """
        post = self.get_object()
        Bookmark.objects.create(
            user=request.user, post=post, content_object=post)
        return Response({"status": "post bookmarked"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unbookmark(self, request, pk=None):
        """
        Custom action to remove a bookmark from a post.
        """
        post = self.get_object()
        Bookmark.objects.filter(user=request.user, post=post).delete()
        return Response({"status": "bookmark removed"})


# Demo / org accounts that should not dominate "Popular accounts"
ORG_USERNAME_BLOCKLIST = {
    "unnnigeria",
    "redcrossng",
    "redcross",
    "lawma",
    "unfcccnigeria",
    "unfccc",
}


# ViewSet for User model
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = []  # Allow public access for popular users
    serializer_class = UserSerializer

    def get_object(self):
        return User.objects.get(pk=self.kwargs["pk"])

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def popular(self, request):
        """
        Real community accounts ranked by followers.
        Excludes the current user, staff, and known org/demo handles.
        Prefers accounts the viewer is not already following.
        """
        limit = min(int(request.query_params.get("limit", 8) or 8), 20)
        qs = (
            User.objects.filter(is_active=True, is_staff=False, is_superuser=False)
            .exclude(username__iexact="")
            .annotate(followers_count=Count("followers", distinct=True))
        )

        if request.user and request.user.is_authenticated:
            qs = qs.exclude(pk=request.user.pk)
            already_following = Follow.objects.filter(
                follower=request.user, following_id=OuterRef("pk")
            )
            qs = qs.annotate(viewer_follows=Exists(already_following))
        else:
            qs = qs.annotate(
                viewer_follows=Value(False, output_field=BooleanField())
            )

        # Drop known organization / placeholder handles
        for handle in ORG_USERNAME_BLOCKLIST:
            qs = qs.exclude(username__iexact=handle)

        # Prefer people you don't follow yet, then by follower count, then recency
        qs = qs.order_by("viewer_follows", "-followers_count", "-date_joined")

        users = list(qs[:limit])
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def heartbeat(self, request):
        """Mark the authenticated user as online (updates last_seen)."""
        now = timezone.now()
        User.objects.filter(pk=request.user.pk).update(last_seen=now)
        return Response({"ok": True, "last_seen": now.isoformat()})

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def online(self, request):
        """
        People currently active in the system (last_seen within the window).
        Facebook/Twitter-style contacts rail source.
        """
        try:
            window = int(request.query_params.get("window", 120) or 120)
        except (TypeError, ValueError):
            window = 120
        window = max(30, min(window, 600))

        try:
            limit = int(request.query_params.get("limit", 100) or 100)
        except (TypeError, ValueError):
            limit = 100
        limit = max(1, min(limit, 200))

        cutoff = timezone.now() - timedelta(seconds=window)
        qs = (
            User.objects.filter(
                is_active=True,
                is_staff=False,
                is_superuser=False,
                last_seen__gte=cutoff,
            )
            .exclude(pk=request.user.pk)
            .order_by("-last_seen", "first_name", "username")
        )

        following_ids = set(
            Follow.objects.filter(follower=request.user).values_list(
                "following_id", flat=True
            )
        )
        users = list(qs[:limit])
        serializer = OnlineUserSerializer(
            users,
            many=True,
            context={"request": request, "following_ids": following_ids},
        )
        return Response(
            {
                "count": len(users),
                "window_seconds": window,
                "results": serializer.data,
            }
        )

    def update(self, request, *args, **kwargs):
        """
        Custom update method for user profiles.
        """
        try:
            user = self.get_object()
            
            # Check if user is updating their own profile
            if request.user.is_authenticated and request.user.id == user.id:
                serializer = self.get_serializer(user, data=request.data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data)
                else:
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response(
                    {"detail": "You can only update your own profile"}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"detail": f"Error updating profile: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
    def activity(self, request):
        """
        Custom action to get user activity statistics.
        """
        try:
            user_id = request.data.get("user_id")
            username = (request.data.get("username") or "").strip()
            if not user_id and not username:
                return Response(
                    {"detail": "user_id or username is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                qs = User.objects.select_related("alert_preference")
                if user_id:
                    user = qs.get(id=user_id)
                else:
                    user = qs.get(username__iexact=username)
                    user_id = user.id
            except User.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            f"User with ID {user_id} does not exist"
                            if user_id
                            else f"User @{username} does not exist"
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            posts = Post.objects.filter(user=user).annotate(
                total_comments=Count('comments', distinct=True),
                total_reactions=Count('reactions', distinct=True),
                total_views=Count('views', distinct=True),
                total_reposts=Count('reposts', distinct=True),
                total_bookmarks=Count('bookmarks', distinct=True)
            )
            print(f"DEBUG: Found {posts.count()} posts for user {user.id} ({user.username})")
            comments = Comment.objects.filter(user=user).annotate(
                total_comments=Count('subcomments', distinct=True),
                total_reactions=Count('reactions', distinct=True),
                total_reposts=Count('reposts', distinct=True),
                total_bookmarks=Count('bookmarks', distinct=True)
            )
            reactions = Reaction.objects.filter(user=user)
            reposts = Repost.objects.filter(user=user)
            followers = Follow.objects.filter(following=user)
            followings = Follow.objects.filter(follower=user)
            bookmarks = Bookmark.objects.filter(user=user)
            polls = Poll.objects.filter(user=user)

            # Serialize the data manually to avoid serializer issues
            from .serializers import PostSerializer, CommentSerializer, ReactionSerializer, RepostSerializer, FollowSerializer, BookmarkSerializer, PollSerializer, UserSerializer
            
            posts_data = PostSerializer(posts, many=True, context={'request': request}).data
            comments_data = CommentSerializer(comments, many=True, context={'request': request}).data
            reactions_data = ReactionSerializer(reactions, many=True, context={'request': request}).data
            reposts_data = RepostSerializer(reposts, many=True, context={'request': request}).data
            followers_data = FollowSerializer(followers, many=True, context={'request': request}).data
            followings_data = FollowSerializer(followings, many=True, context={'request': request}).data
            bookmarks_data = BookmarkSerializer(bookmarks, many=True, context={'request': request}).data
            polls_data = PollSerializer(polls, many=True, context={'request': request}).data
            user_data = UserSerializer(user, context={'request': request}).data
            
            print(f"DEBUG: User profile_pic: {user.profile_pic}")
            print(f"DEBUG: User picture: {user.picture}")
            print(f"DEBUG: User default_avatar: {user.default_avatar}")
            print(f"DEBUG: User profile_picture property: {user.profile_picture}")
            print(f"DEBUG: User cover: {user.cover}")
            print(f"DEBUG: Serialized user data: {user_data}")
            print(f"DEBUG: Serialized data counts - Posts: {len(posts_data)}, Comments: {len(comments_data)}, Reactions: {len(reactions_data)}")
            print(f"DEBUG: Reposts: {len(reposts_data)}, Bookmarks: {len(bookmarks_data)}, Polls: {len(polls_data)}")
            
            response_data = {
                "posts": posts_data,
                "comments": comments_data,
                "reactions": reactions_data,
                "repost": reposts_data,
                "followers": followers_data,
                "followings": followings_data,
                "bookmarks": bookmarks_data,
                "polls": polls_data,
                "user_id": str(user_id),
                "user": user_data
            }
            
            return Response(response_data)
        except Exception as e:
            return Response(
                {"detail": f"Error retrieving user activities: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def follow(self, request, pk=None):
        """
        Custom action to follow a user.
        """
        user_to_follow = self.get_object()
        
        # Check if already following
        if Follow.objects.filter(follower=request.user, following=user_to_follow).exists():
            return Response(
                {"detail": "You are already following this user."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if trying to follow self
        if request.user == user_to_follow:
            return Response(
                {"detail": "You cannot follow yourself."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            Follow.objects.create(follower=request.user, following=user_to_follow)
            return Response({"status": f"following {user_to_follow.username}"})
        except Exception as e:
            return Response(
                {"detail": f"Error following user: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unfollow(self, request, pk=None):
        """
        Custom action to unfollow a user.
        """
        user_to_unfollow = self.get_object()
        Follow.objects.filter(
            follower=request.user, following=user_to_unfollow
        ).delete()
        return Response({"status": f"unfollowed {user_to_unfollow.username}"})


# ViewSet for Comment model
class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Override get_queryset to add annotations for subcomment, reaction, view, and repost counts.
        """
        # Get the ContentType for Post
        post_content_type = ContentType.objects.get_for_model(Post)

        queryset = super().get_queryset()

        # Annotate the queryset with counts
        queryset = queryset.annotate(
            total_comments=Count("subcomments"),
            total_reactions=Count("reactions"),
            total_reposts=Count("reposts"),
            total_bookmarks=Count("bookmarks"),
        )
        return queryset

    def list(self, request):
        post = request.query_params.get("post", None)
        parent_comment = request.query_params.get("parent", None)
        queryset = self.get_queryset()  # Use your existing queryset logic

        if post:
            queryset = queryset.filter(post=post)  # Filter by category slug
        if parent_comment:
            queryset = queryset.filter(parent_comment=parent_comment)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def react(self, request, pk=None):
        """
        Custom action to react to a post.
        """
        comment = self.get_object()
        user = request.user

       
        existing_reaction = Reaction.objects.filter(user=user, comment=comment).first()

        if existing_reaction:
            return Response(
                {"status": "You have already reacted to this comment."},
                status=status.HTTP_400_BAD_REQUEST
            )

        Reaction.objects.create(
            user=user,
            content_object=comment,
            comment=comment
        )


    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unreact(self, request, pk=None):
        """
        Custom action to remove a reaction from a post.
        """
        comment = self.get_object()
        Reaction.objects.filter(
            user=request.user, comment=comment
        ).delete()
        return Response({"status": "reaction removed"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def repost(self, request, pk=None):
        """
        Custom action to repost a post.
        """
        comment = self.get_object()
        Repost.objects.create(
            user=request.user, content_object=comment, comment=comment)
        return Response({"status": "a reaction to post"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unrepost(self, request, pk=None):
        """
        Custom action to remove a repost of a post.
        """
        comment = self.get_object()
        Repost.objects.filter(
            user=request.user, comment=comment
        ).delete()
        return Response({"status": "reaction removed"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def bookmark(self, request, pk=None):
        """
        Custom action to bookmark a post.
        """
        comment = self.get_object()
        Bookmark.objects.create(
            user=request.user, content_object=comment, comment=comment)
        return Response({"status": "post bookmarked"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unbookmark(self, request, pk=None):
        """
        Custom action to remove a bookmark from a post.
        """
        comment = self.get_object()
        Bookmark.objects.filter(
            user=request.user, comment=comment
        ).delete()
        return Response({"status": "bookmark removed"})


# ViewSet for Reaction model
class ReactionViewSet(viewsets.ModelViewSet):
    queryset = Reaction.objects.all()
    serializer_class = ReactionSerializer
    permission_classes = [IsAuthenticated]


# ViewSet for Repost model
class RepostViewSet(viewsets.ModelViewSet):
    queryset = Repost.objects.all()
    serializer_class = RepostSerializer
    permission_classes = [IsAuthenticated]


# ViewSet for Follow model
class FollowViewSet(viewsets.ModelViewSet):
    queryset = Follow.objects.all()
    serializer_class = FollowSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Follow.objects.filter(follower=self.request.user).select_related(
            "follower", "following"
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = getattr(self.request, "user", None)
        if user is not None and user.is_authenticated:
            ctx["following_ids"] = set(
                Follow.objects.filter(follower=user).values_list(
                    "following_id", flat=True
                )
            )
        else:
            ctx["following_ids"] = set()
        return ctx

    @action(detail=False, methods=["get"], url_path="ids")
    def following_ids(self, request):
        """Compact list of user IDs the current user follows (for feed UI hydrate)."""
        ids = list(
            Follow.objects.filter(follower=request.user).values_list(
                "following_id", flat=True
            )
        )
        return Response({"ids": ids})

    @action(detail=False, methods=["get"], url_path="network")
    def network(self, request):
        """
        Lightweight followers + following lists for the Network page.
        Avoids /users/activity/ which serializes posts, comments, reactions, etc.
        """
        following_ids = set(
            Follow.objects.filter(follower=request.user).values_list(
                "following_id", flat=True
            )
        )
        ctx = {"request": request, "following_ids": following_ids}

        following_users = [
            f.following
            for f in Follow.objects.filter(follower=request.user)
            .select_related("following")
            .order_by("-created_at")
        ]
        follower_users = [
            f.follower
            for f in Follow.objects.filter(following=request.user)
            .select_related("follower")
            .order_by("-created_at")
        ]

        return Response(
            {
                "following": PostAuthorSerializer(
                    following_users, many=True, context=ctx
                ).data,
                "followers": PostAuthorSerializer(
                    follower_users, many=True, context=ctx
                ).data,
            }
        )

    def create(self, request, *args, **kwargs):
        following_id = request.data.get("following_id")
        already = False
        if following_id is not None:
            already = Follow.objects.filter(
                follower=request.user, following_id=following_id
            ).exists()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        follow = serializer.save()
        out = self.get_serializer(follow).data
        return Response(
            out,
            status=status.HTTP_200_OK if already else status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        following_id = kwargs.get('pk')

        if not following_id:
            raise Http404("Following ID is required.")

        try:
            follow = Follow.objects.get(
                follower=request.user, following_id=following_id)
            follow.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Follow.DoesNotExist:
            raise Http404("Follow not found.")


# ViewSet for View model
class ViewViewSet(viewsets.ModelViewSet):
    queryset = View.objects.all()
    serializer_class = ViewSerializer
    permission_classes = [IsAuthenticated]


# ViewSet for Bookmark model
class BookmarkViewSet(viewsets.ModelViewSet):
    queryset = Bookmark.objects.all()
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]


# ViewSet for Poll model
class PollViewSet(viewsets.ModelViewSet):
    queryset = Poll.objects.all()
    serializer_class = PollSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def vote(self, request, pk=None):
        """
        Custom action to vote in a poll.
        """
        poll = self.get_object()
        option = request.data.get("option")
        PollVote.objects.create(user=request.user, poll=poll, option=option)
        return Response({"status": "vote casted"})


# ViewSet for PollVote model
class PollVoteViewSet(viewsets.ModelViewSet):
    queryset = PollVote.objects.all()
    serializer_class = PollVoteSerializer
    permission_classes = [IsAuthenticated]


def status_view(request):
    return JsonResponse({"status": "up"})

# Simple WebSocket endpoint for notifications
@csrf_exempt
@require_http_methods(["GET"])
def websocket_notifications(request):
    """
    Simple WebSocket-like endpoint for notifications.
    This is a fallback for when WebSocket support is not available.
    """
    try:
        # Get user from token
        token = request.GET.get('token')
        if not token:
            return JsonResponse({"error": "Token required"}, status=401)
        
        # For now, return a simple response
        # In a real implementation, you'd validate the JWT token
        return JsonResponse({
            "type": "notification",
            "message": "WebSocket connection established",
            "status": "connected"
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# Search functionality
@csrf_exempt
@require_http_methods(["GET"])
def search_posts(request):
    """
    Search posts by content, hashtags, or location
    """
    try:
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({"results": []})
        
        # Search in content, hashtags, and location
        posts = Post.objects.filter(
            Q(content__icontains=query) |
            Q(hashtags__icontains=query) |
            Q(location__icontains=query)
        ).annotate(
            total_comments=Count('comments', distinct=True),
            total_reactions=Count('reactions', distinct=True),
            total_views=Count('views', distinct=True),
            total_reposts=Count('reposts', distinct=True),
            total_bookmarks=Count('bookmarks', distinct=True)
        ).order_by('-created_at')
        
        serializer = PostSerializer(posts, many=True, context={'request': request})
        return JsonResponse({"results": serializer.data})
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def search_users(request):
    """
    Search users by name, username, or profession
    """
    try:
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({"results": []})
        
        # Search in first_name, last_name, username, and profession
        users = User.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(username__icontains=query) |
            Q(profession__icontains=query)
        ).order_by('-date_joined')
        
        serializer = UserSerializer(users, many=True, context={'request': request})
        return JsonResponse({"results": serializer.data})
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def search_hashtags(request):
    """
    Search hashtags
    """
    try:
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({"results": []})
        
        # Extract hashtags from posts
        posts = Post.objects.filter(hashtags__icontains=query)
        hashtags = set()
        
        for post in posts:
            if post.hashtags:
                # Extract hashtags from the hashtags field
                post_hashtags = re.findall(r'#\w+', post.hashtags)
                for hashtag in post_hashtags:
                    if query.lower() in hashtag.lower():
                        hashtags.add(hashtag)
        
        # Convert to list and create results
        results = []
        for hashtag in list(hashtags)[:20]:  # Limit to 20 results
            # Count posts with this hashtag
            post_count = Post.objects.filter(hashtags__icontains=hashtag).count()
            results.append({
                "name": hashtag,
                "tag": hashtag,
                "post_count": post_count
            })
        
        return JsonResponse({"results": results})
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def search_trending(request):
    """
    Search trending topics
    """
    try:
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({"results": []})
        
        # Get trending posts that match the query
        posts = Post.objects.filter(
            Q(content__icontains=query) |
            Q(hashtags__icontains=query)
        ).annotate(
            total_comments=Count('comments', distinct=True),
            total_reactions=Count('reactions', distinct=True),
            total_views=Count('views', distinct=True),
            total_reposts=Count('reposts', distinct=True),
            total_bookmarks=Count('bookmarks', distinct=True)
        ).order_by('-total_reactions', '-total_comments', '-created_at')
        
        # Create trending topics from posts
        trending_topics = []
        seen_topics = set()
        
        for post in posts[:10]:  # Limit to 10 trending topics
            if post.hashtags:
                hashtags = re.findall(r'#\w+', post.hashtags)
                for hashtag in hashtags:
                    if query.lower() in hashtag.lower() and hashtag not in seen_topics:
                        seen_topics.add(hashtag)
                        trending_topics.append({
                            "name": hashtag,
                            "title": hashtag,
                            "post_count": Post.objects.filter(hashtags__icontains=hashtag).count(),
                            "status": "trending"
                        })
        
        return JsonResponse({"results": trending_topics})
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def global_search(request):
    """
    Global search across all content types
    """
    try:
        query = request.GET.get('q', '').strip()
        if not query:
            return JsonResponse({
                "posts": [],
                "users": [],
                "hashtags": [],
                "trending": []
            })
        
        # Search posts
        posts = Post.objects.filter(
            Q(content__icontains=query) |
            Q(hashtags__icontains=query) |
            Q(location__icontains=query)
        ).annotate(
            total_comments=Count('comments', distinct=True),
            total_reactions=Count('reactions', distinct=True),
            total_views=Count('views', distinct=True),
            total_reposts=Count('reposts', distinct=True),
            total_bookmarks=Count('bookmarks', distinct=True)
        ).order_by('-created_at')[:10]
        
        # Search users
        users = User.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(username__icontains=query) |
            Q(profession__icontains=query)
        ).order_by('-date_joined')[:10]
        
        # Search hashtags
        posts_with_hashtags = Post.objects.filter(hashtags__icontains=query)
        hashtags = set()
        
        for post in posts_with_hashtags:
            if post.hashtags:
                post_hashtags = re.findall(r'#\w+', post.hashtags)
                for hashtag in post_hashtags:
                    if query.lower() in hashtag.lower():
                        hashtags.add(hashtag)
        
        hashtag_results = []
        for hashtag in list(hashtags)[:10]:
            post_count = Post.objects.filter(hashtags__icontains=hashtag).count()
            hashtag_results.append({
                "name": hashtag,
                "tag": hashtag,
                "post_count": post_count
            })
        
        # Search trending
        trending_posts = Post.objects.filter(
            Q(content__icontains=query) |
            Q(hashtags__icontains=query)
        ).annotate(
            total_reactions=Count('reactions', distinct=True),
            total_comments=Count('comments', distinct=True)
        ).order_by('-total_reactions', '-total_comments', '-created_at')[:5]
        
        trending_results = []
        seen_trends = set()
        
        for post in trending_posts:
            if post.hashtags:
                hashtags = re.findall(r'#\w+', post.hashtags)
                for hashtag in hashtags:
                    if query.lower() in hashtag.lower() and hashtag not in seen_trends:
                        seen_trends.add(hashtag)
                        trending_results.append({
                            "name": hashtag,
                            "title": hashtag,
                            "post_count": Post.objects.filter(hashtags__icontains=hashtag).count(),
                            "status": "trending"
                        })
        
        # Serialize results
        posts_serializer = PostSerializer(posts, many=True, context={'request': request})
        users_serializer = UserSerializer(users, many=True, context={'request': request})
        
        return JsonResponse({
            "posts": posts_serializer.data,
            "users": users_serializer.data,
            "hashtags": hashtag_results,
            "trending": trending_results
        })
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# Tree Project Views
class TreeProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tree projects across Africa
    """
    queryset = TreeProject.objects.all()
    serializer_class = TreeProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'african_projects', 'stats']:
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TreeProjectCreateSerializer
        return TreeProjectSerializer

    def _require_tree_admin_write(self, request):
        from .tree_admin import user_has_tree_admin_access

        if not user_has_tree_admin_access(request.user):
            return Response(
                {
                    "detail": (
                        "Tree Admin access required. Apply at /tree-admins/apply "
                        "and wait for verification."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def create(self, request, *args, **kwargs):
        from .tree_admin import active_tree_admin_org_for
        from .tree_pricing import max_active_projects

        denied = self._require_tree_admin_write(request)
        if denied:
            return denied

        org = active_tree_admin_org_for(request.user)
        if org is not None:
            limit = max_active_projects(org)
            if limit is not None:
                active_count = TreeProject.objects.filter(
                    tree_admin_org=org,
                    status__in=["active", "pending_approval", "paused"],
                ).count()
                if active_count >= int(limit):
                    return Response(
                        {
                            "detail": (
                                f"Your {org.plan} plan allows up to {limit} active projects. "
                                "Upgrade to Growth or Partner for more."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        serializer = self.get_serializer(
            data=request.data,
            context={
                "request": request,
                "tree_admin_org": org,
            },
        )
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        denied = self._require_tree_admin_write(request)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        denied = self._require_tree_admin_write(request)
        if denied:
            return denied
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._require_tree_admin_write(request)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)
    
    def get_queryset(self):
        queryset = TreeProject.objects.all()
        
        # Filter by country
        country = self.request.query_params.get('country', None)
        if country:
            queryset = queryset.filter(country__icontains=country)
        
        # Filter by project type
        project_type = self.request.query_params.get('project_type', None)
        if project_type:
            queryset = queryset.filter(project_type=project_type)
        
        # Filter by status
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)
        
        # Filter verified projects only
        verified_only = self.request.query_params.get('verified_only', None)
        if verified_only == 'true':
            queryset = queryset.filter(is_verified=True)
        
        # Filter by organization
        organization = self.request.query_params.get('organization', None)
        if organization:
            queryset = queryset.filter(organization_id=organization)
        
        return queryset.order_by('-created_at')
    
    @action(detail=False, methods=['get'], permission_classes=[])
    def african_projects(self, request):
        """
        Get all tree projects in African countries
        """
        african_countries = [
            'Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Tanzania', 'Uganda',
            'Ethiopia', 'Morocco', 'Algeria', 'Sudan', 'Angola', 'Mozambique',
            'Madagascar', 'Cameroon', 'Niger', 'Burkina Faso', 'Mali', 'Malawi',
            'Zambia', 'Somalia', 'Senegal', 'Chad', 'Sierra Leone', 'Libya',
            'Liberia', 'Central African Republic', 'Mauritania', 'Eritrea',
            'Gambia', 'Botswana', 'Gabon', 'Lesotho', 'Guinea-Bissau',
            'Equatorial Guinea', 'Mauritius', 'Eswatini', 'Djibouti',
            'Comoros', 'Cape Verde', 'São Tomé and Príncipe', 'Seychelles'
        ]
        
        projects = TreeProject.objects.filter(
            country__in=african_countries,
            is_verified=True,
            status='active'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(projects, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_update(self, request, pk=None):
        """
        Add an update to a tree project
        """
        project = self.get_object()
        serializer = TreeProjectUpdateCreateSerializer(
            data=request.data,
            context={'project': project, 'request': request}
        )
        
        if serializer.is_valid():
            update = serializer.save()
            
            # Update project's trees_planted count
            if update.trees_planted_this_update > 0:
                project.trees_planted += update.trees_planted_this_update
                project.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def donate(self, request, pk=None):
        """
        Make a donation to a tree project
        """
        project = self.get_object()
        serializer = TreeProjectDonationCreateSerializer(
            data=request.data,
            context={'project': project, 'request': request}
        )
        
        if serializer.is_valid():
            from .tree_pricing import split_tree_payment

            donation = serializer.save()
            platform_fee, admin_share, fee_rate = split_tree_payment(donation.amount)
            donation.platform_fee = platform_fee
            donation.admin_share = admin_share
            donation.fee_rate = fee_rate
            donation.save(update_fields=["platform_fee", "admin_share", "fee_rate"])

            # Attribute Tree Admin share only
            project.funds_raised += admin_share
            project.trees_planted += donation.trees_purchased
            project.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Verify a tree project (admin only)
        """
        project = self.get_object()
        from .tree_admin import user_has_tree_admin_access

        # Staff or approved Tree Admin can verify
        if not (request.user.is_staff or user_has_tree_admin_access(request.user)):
            return Response(
                {"error": "Only administrators can verify projects"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        project.is_verified = True
        project.status = 'active'  # Change status to active when verified
        project.verified_by = request.user
        project.verification_date = timezone.now()
        project.save()
        
        return Response({"message": "Project verified successfully"})
    
    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def stats(self, request):
        """
        Get global tree project statistics
        """
        total_projects = TreeProject.objects.count()
        active_projects = TreeProject.objects.filter(status='active').count()
        verified_projects = TreeProject.objects.filter(is_verified=True).count()
        total_trees_planted = TreeProject.objects.aggregate(
            total=models.Sum('trees_planted')
        )['total'] or 0
        total_funds_raised = TreeProject.objects.aggregate(
            total=models.Sum('funds_raised')
        )['total'] or 0
        
        # Country breakdown
        country_stats = TreeProject.objects.values('country').annotate(
            project_count=models.Count('id'),
            trees_planted=models.Sum('trees_planted')
        ).order_by('-project_count')
        
        return Response({
            'total_projects': total_projects,
            'active_projects': active_projects,
            'verified_projects': verified_projects,
            'total_trees_planted': total_trees_planted,
            'total_funds_raised': total_funds_raised,
            'country_breakdown': list(country_stats)
        })


class DisasterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Disaster.objects.all().order_by('-start_date')
    serializer_class = DisasterSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def live(self, request):
        """Proxy live USGS and NASA EONET events for the public map and charts."""
        from .live_feeds import fetch_live_official_events

        return Response(fetch_live_official_events())

    @action(detail=False, methods=["get", "post"], permission_classes=[AllowAny])
    def forecast(self, request):
        """
        Historical + live-event outlook with chart series and AI narrative.
        POST body may include { "events": [...live disasters...], "days": 90 }.
        """
        from .disaster_forecast import build_forecast

        days = request.data.get("days") if request.method == "POST" else request.query_params.get("days")
        try:
            days = int(days or 90)
        except (TypeError, ValueError):
            days = 90
        live_events = []
        if request.method == "POST":
            payload = request.data.get("events") or request.data.get("disasters") or []
            if isinstance(payload, list):
                live_events = payload
        report = build_forecast(live_events=live_events, days=days)
        return Response(report)


class TreeProjectUpdateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tree project updates
    """
    queryset = TreeProjectUpdate.objects.all()
    serializer_class = TreeProjectUpdateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        project_id = self.request.query_params.get('project_id')
        if project_id:
            return TreeProjectUpdate.objects.filter(project_id=project_id)
        return TreeProjectUpdate.objects.all()


class TreeProjectDonationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tree project donations
    """
    queryset = TreeProjectDonation.objects.all()
    serializer_class = TreeProjectDonationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        claim_tree_donations(self.request.user)
        project_id = self.request.query_params.get('project_id')
        donor_id = self.request.query_params.get('donor')
        
        if project_id:
            return TreeProjectDonation.objects.filter(project_id=project_id)
        elif donor_id:
            return TreeProjectDonation.objects.filter(donor_id=donor_id)
        return TreeProjectDonation.objects.filter(donor=self.request.user)


class FileUploadViewSet(viewsets.ViewSet):
    """
    Handle file uploads and return URLs
    """
    permission_classes = [IsAuthenticated]
    
    def create(self, request):
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        file = request.FILES['file']
        folder = request.data.get('folder', 'uploads')
        
        # Generate unique filename
        file_extension = os.path.splitext(file.name)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Create folder path
        folder_path = f"{folder}/{datetime.now().strftime('%Y/%m/%d')}"
        full_path = f"{folder_path}/{unique_filename}"
        
        try:
            # Save file to storage
            saved_path = default_storage.save(full_path, ContentFile(file.read()))
            
            # Generate URL (adjust based on your media service)
            # For development, use local storage URL
            if hasattr(default_storage, 'url'):
                file_url = default_storage.url(saved_path)
            else:
                file_url = f"/media/{saved_path}"

            if file_url.startswith("/") and getattr(settings, "BACKEND_HOST", ""):
                file_url = f"{settings.BACKEND_HOST.rstrip('/')}{file_url}"
            
            return Response({
                'success': True,
                'url': file_url,
                'secure_url': file_url,
                'filename': unique_filename,
                'path': saved_path
            })
            
        except Exception as e:
            return Response({
                'error': f'Upload failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Paystack Payment Verification
@csrf_exempt
@require_http_methods(["POST"])
def verify_paystack_payment(request):
    """
    Verify a Paystack charge and store the tree donation for the payer.
    """
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Invalid JSON."}, status=400)

    try:
        payload = record_paystack_charge(
            data.get("reference"),
            request_user=user_from_request(request),
            client_data=data,
        )
    except PaymentRecordError as exc:
        return JsonResponse({"success": False, "message": str(exc)}, status=exc.status)
    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception("verify-payment failed: %s", exc)
        return JsonResponse(
            {"success": False, "message": f"Error processing payment: {exc}"},
            status=500,
        )

    return JsonResponse(payload)


verify_payment = verify_paystack_payment


@csrf_exempt
@require_http_methods(["POST"])
def paystack_webhook(request):
    """
    Paystack server callback. A successful charge is recorded even if the
    browser never returns to the site.
    """
    body = request.body or b""
    signature = request.META.get("HTTP_X_PAYSTACK_SIGNATURE", "")
    if not webhook_signature_ok(body, signature):
        return JsonResponse({"status": "error", "message": "Invalid signature"}, status=400)

    try:
        webhook_data = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"status": "error", "message": "Invalid payload"}, status=400)

    event = webhook_data.get("event")
    data = webhook_data.get("data") or {}
    if event != "charge.success":
        return JsonResponse({"status": "ignored"})

    reference = data.get("reference")
    product = payment_product_type(data)
    try:
        if product in {"rapidbrief", "responder_plan", "rapidbrief_plan"}:
            record_rapidbrief_payment(reference, client_data={"product": "rapidbrief"})
        else:
            record_tree_payment(reference)
    except PaymentRecordError as exc:
        if exc.status >= 500:
            return JsonResponse({"status": "error", "message": str(exc)}, status=500)
        return JsonResponse({"status": "ignored", "message": str(exc)})
    except Exception as exc:
        return JsonResponse({"status": "error", "message": str(exc)}, status=500)

    return JsonResponse({"status": "success"})


@csrf_exempt
@require_http_methods(["POST"])
def mark_certificate_downloaded(request):
    """
    Mark a certificate as downloaded to prevent re-downloading
    """
    try:
        data = json.loads(request.body)
        certificate_id = data.get("certificate_id")
        user_id = data.get("user_id")

        if not certificate_id or not user_id:
            return JsonResponse({
                "success": False,
                "message": "Certificate ID and User ID are required",
            }, status=400)

        return JsonResponse({
            "success": True,
            "message": "Certificate download marked",
        })

    except Exception as exc:
        return JsonResponse({
            "success": False,
            "message": f"Error marking certificate download: {exc}",
        }, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def wavers_points_rates(request):
    """Public market rates for the Wavers Points loyalty program."""
    from .points import MARKET_NOTES, gift_earn_points, redeem_cost_points

    project_id = request.query_params.get("project_id")
    project = None
    example = {
        "tree_price_usd": 2.0,
        "earn_per_gifted_tree": gift_earn_points(1, 2),
        "redeem_one_tree": redeem_cost_points(2, 1),
        "gifts_for_one_free_tree": 10,
    }
    if project_id:
        project = TreeProject.objects.filter(id=project_id).first()
        if project:
            earn = gift_earn_points(1, project.tree_price)
            cost = redeem_cost_points(project.tree_price, 1)
            example = {
                "project_id": project.id,
                "project_name": project.name,
                "tree_price_usd": float(project.tree_price),
                "earn_per_gifted_tree": earn,
                "redeem_one_tree": cost,
                "gifts_for_one_free_tree": (cost + earn - 1) // earn if earn else None,
            }
    return Response({"rates": MARKET_NOTES, "example": example})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def wavers_points_balance(request):
    from .points import account_payload

    project = None
    project_id = request.query_params.get("project_id")
    if project_id:
        project = TreeProject.objects.filter(id=project_id).first()
    return Response(account_payload(request.user, project))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def wavers_points_ledger(request):
    from .models import WaversPointsLedger

    rows = (
        WaversPointsLedger.objects.filter(user=request.user)
        .order_by("-created_at")[:50]
    )
    return Response(
        [
            {
                "id": row.id,
                "delta": row.delta,
                "balance_after": row.balance_after,
                "reason": row.reason,
                "note": row.note,
                "created_at": row.created_at,
                "donation_id": row.donation_id,
            }
            for row in rows
        ]
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def wavers_points_redeem(request):
    """Redeem Wavers Points for one or more trees on a project."""
    from .points import redeem_trees_with_points
    from .paystack_payment import _donation_payload

    project_id = request.data.get("project_id")
    trees = request.data.get("trees", 1)
    dedication = request.data.get("dedication_message", "")
    gifted_to_id = request.data.get("gifted_to") or request.data.get("gift_for_user_id")

    if not project_id:
        return Response({"detail": "project_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    project = TreeProject.objects.filter(id=project_id).first()
    if not project:
        return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

    gifted_to = None
    if gifted_to_id not in (None, ""):
        gifted_to = User.objects.filter(id=gifted_to_id).first()
        if gifted_to is None:
            return Response({"detail": "Gift recipient not found."}, status=status.HTTP_404_NOT_FOUND)

    try:
        result = redeem_trees_with_points(
            user=request.user,
            project=project,
            trees=trees,
            dedication_message=dedication,
            gifted_to=gifted_to,
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    donation = result["donation"]
    payload = _donation_payload(donation, getattr(request.user, "email", "") or "")
    payload.update(
        {
            "points_spent": result["points_spent"],
            "points_balance": result["balance"],
            "redeemed_with_points": True,
            "message": f"Redeemed {result['trees']} tree(s) with {result['points_spent']} points.",
        }
    )
    return Response(payload, status=status.HTTP_201_CREATED)
