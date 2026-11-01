from rest_framework import viewsets
from django.db.models import Count, Q
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
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
from datetime import datetime
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
)
from .serializers import (
    NotificationSerializer,
    UserSerializer,
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
    queryset = Post.objects.all().order_by("-created_at")
    serializer_class = PostSerializer
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
        """
        # Get the ContentType for Post
        # post_content_type = ContentType.objects.get_for_model(Post)

        queryset = super().get_queryset()

        # Annotate the queryset with counts
        queryset = queryset.annotate(
            total_comments=Count("comments", distinct=True),
            total_reactions=Count("reactions", distinct=True),
            total_views=Count("views",  distinct=True),
            total_reposts=Count("reposts",  distinct=True),
            total_bookmarks=Count("bookmarks",  distinct=True),
        )
        return queryset

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
        Custom action to get trending hashtags.
        """
        trending_hashtags = (
            Post.objects.values("hashtags")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        return Response(trending_hashtags)

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


# ViewSet for User model
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = []  # Allow public access for popular users
    serializer_class = UserSerializer

    def get_object(self):
        return User.objects.get(pk=self.kwargs["pk"])

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
            if not user_id:
                return Response(
                    {"detail": "user_id is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {"detail": f"User with ID {user_id} does not exist"}, 
                    status=status.HTTP_404_NOT_FOUND
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

    def create(self, request, *args, **kwargs):
        try:
            # Get the serializer with the request data
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            if "UNIQUE constraint failed" in str(e) or "already following" in str(e):
                return Response(
                    {"detail": "You are already following this user."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {"detail": f"Error creating follow relationship: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
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
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TreeProjectCreateSerializer
        return TreeProjectSerializer
    
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
            donation = serializer.save()
            
            # Update project's funds_raised
            project.funds_raised += donation.amount
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
        
        # Check if user is admin or staff
        if not request.user.is_staff:
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
    
    @action(detail=False, methods=['get'])
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
    Verify Paystack payment and create tree donation record
    """
    try:
        import requests
        
        data = json.loads(request.body)
        reference = data.get('reference')
        project_id = data.get('project_id')
        amount = float(data.get('amount', 0))  # Convert to float
        trees_purchased = int(data.get('trees_purchased', 1))  # Convert to int
        donor_name = data.get('donor_name', 'Anonymous')
        dedication_message = data.get('dedication_message', '')
        selected_species = data.get('selected_species', {})
        
        print(f"Payment data - amount: {amount} (type: {type(amount)}), trees: {trees_purchased} (type: {type(trees_purchased)})")
        
        if not reference or not project_id:
            return JsonResponse({
                'success': False,
                'message': 'Missing required parameters'
            }, status=400)
        
        # Verify payment with Paystack
        paystack_secret_key = os.getenv('PAYSTACK_SECRET_KEY', 'test_secret_key')
        headers = {
            'Authorization': f'Bearer {paystack_secret_key}',
            'Content-Type': 'application/json'
        }
        
        verify_url = f'https://api.paystack.co/transaction/verify/{reference}'
        print(f"Verifying payment with reference: {reference}")
        print(f"Using secret key: {paystack_secret_key[:10]}...")
        response = requests.get(verify_url, headers=headers)
        print(f"Paystack verification response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Paystack verification error: {response.text}")
            return JsonResponse({
                'success': False,
                'message': f'Payment verification failed: {response.text}'
            }, status=400)
        
        payment_data = response.json()
        print(f"Paystack verification response: {payment_data}")
        
        if payment_data['status'] != True:
            print(f"Payment verification failed: {payment_data}")
            return JsonResponse({
                'success': False,
                'message': f'Payment verification failed: {payment_data.get("message", "Unknown error")}'
            }, status=400)
        
        print(f"Payment verification successful: {payment_data['data']['status']}")
        
        # Get the project
        try:
            project = TreeProject.objects.get(id=project_id)
        except TreeProject.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'Project not found'
            }, status=404)
        
        # Get or create user (for anonymous donations, create a placeholder)
        user = None
        if request.user.is_authenticated:
            user = request.user
        else:
            # Create anonymous user or use a default user
            User = get_user_model()
            customer_email = payment_data['data']['customer']['email']
            
            try:
                # Try to get existing user by email first
                user = User.objects.get(email=customer_email)
                print(f"Found existing user: {user.id} - {user.email}")
            except User.DoesNotExist:
                # Create new user only if doesn't exist
                try:
                    user = User.objects.create(
                        username=f'anonymous_{reference}',
                        email=customer_email,
                        first_name=donor_name,
                        is_active=False
                    )
                    print(f"Created new user: {user.id} - {user.email}")
                except Exception as create_error:
                    print(f"Error creating user: {str(create_error)}")
                    # If creation fails due to unique constraint, try to get the user again
                    try:
                        user = User.objects.get(email=customer_email)
                        print(f"Retrieved existing user after creation error: {user.id} - {user.email}")
                    except User.DoesNotExist:
                        # If still can't find user, create with unique email
                        import time
                        unique_email = f"anonymous_{int(time.time())}@example.com"
                        user = User.objects.create(
                            username=f'anonymous_{reference}',
                            email=unique_email,
                            first_name=donor_name,
                            is_active=False
                        )
                        print(f"Created user with unique email: {user.id} - {user.email}")
        
        # Create donation record
        try:
            print(f"Creating donation record - project: {project.id}, user: {user.id if user else 'None'}, amount: {amount}")
            # Add selected species to dedication message
            final_dedication_message = dedication_message
            if selected_species:
                species_text = ", ".join([f"{species}: {qty}" for species, qty in selected_species.items() if qty > 0])
                if species_text:
                    final_dedication_message = f"{dedication_message}\n\nSelected Species: {species_text}".strip()
            
            donation = TreeProjectDonation.objects.create(
                project=project,
                donor=user,
                amount=amount,
                trees_purchased=trees_purchased,
                payment_reference=reference,
                payment_status='completed',
                dedication_message=final_dedication_message,
                is_anonymous=not request.user.is_authenticated
            )
            print(f"Donation record created successfully: {donation.id}")
        except Exception as donation_error:
            print(f"Error creating donation record: {str(donation_error)}")
            import traceback
            print(f"Donation creation traceback: {traceback.format_exc()}")
            raise donation_error
        
        # Update project stats
        print(f"Before update - trees_planted: {project.trees_planted} (type: {type(project.trees_planted)}), funds_raised: {project.funds_raised} (type: {type(project.funds_raised)})")
        print(f"Adding - trees: {trees_purchased} (type: {type(trees_purchased)}), amount: {amount} (type: {type(amount)})")
        
        try:
            from decimal import Decimal
            # Convert amount to Decimal to match database field type
            amount_decimal = Decimal(str(amount))
            print(f"Converting amount from {amount} (type: {type(amount)}) to {amount_decimal} (type: {type(amount_decimal)})")
            
            project.trees_planted += trees_purchased
            project.funds_raised += amount_decimal
            project.save()
            print(f"After update - trees_planted: {project.trees_planted}, funds_raised: {project.funds_raised}")
            
            # Calculate user's total trees planted for badge system
            if user:
                # Calculate total trees planted by this user from all donations
                from django.db.models import Sum
                total_trees = TreeProjectDonation.objects.filter(donor=user).aggregate(
                    total=Sum('trees_purchased')
                )['total'] or 0
                print(f"User {user.id} total trees planted: {total_trees}")
            
        except Exception as update_error:
            print(f"Error updating project stats: {str(update_error)}")
            import traceback
            print(f"Update traceback: {traceback.format_exc()}")
            raise update_error
        
        print(f"Tree donation created successfully: {donation.id}")
        
        # Generate certificate ID
        certificate_id = f"CW{reference}{donation.id}"
        
        # Calculate user's total trees planted for badge system
        user_total_trees = 0
        if user:
            from django.db.models import Sum
            user_total_trees = TreeProjectDonation.objects.filter(donor=user).aggregate(
                total=Sum('trees_purchased')
            )['total'] or 0
        
        return JsonResponse({
            'success': True,
            'message': 'Payment verified successfully',
            'donation_id': donation.id,
            'payment_reference': reference,
            'certificate_id': certificate_id,
            'user_total_trees': user_total_trees,  # For badge system
            'certificate_data': {
                'certificate_id': certificate_id,
                'tree_type': project.name,
                'co2_absorption': float(project.co2_absorption_per_tree),
                'location': f"{project.city}, {project.country}",
                'planting_date': donation.created_at.strftime('%m/%d/%Y'),
                'user_name': user.first_name + ' ' + user.last_name if user else 'Anonymous',
                'trees_planted': trees_purchased,
                'amount': amount,
                'selected_species': selected_species
            }
        })
        
    except Exception as e:
        import traceback
        print(f"Payment processing error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({
            'success': False,
            'message': f'Error processing payment: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def paystack_webhook(request):
    """
    Paystack webhook endpoint for payment notifications
    """
    try:
        # Get the raw request body
        body = request.body.decode('utf-8')
        signature = request.META.get('HTTP_X_PAYSTACK_SIGNATURE', '')
        
        print(f"Webhook received - Signature: {signature[:20]}...")
        print(f"Webhook body: {body[:200]}...")
        
        # Verify webhook signature (optional but recommended)
        import hashlib
        import hmac
        import os
        
        paystack_secret_key = os.getenv('PAYSTACK_SECRET_KEY', 'test_secret_key')
        
        # Create expected signature
        expected_signature = hmac.new(
            paystack_secret_key.encode('utf-8'),
            body.encode('utf-8'),
            hashlib.sha512
        ).hexdigest()
        
        # Verify signature
        if not hmac.compare_digest(signature, expected_signature):
            print("Webhook signature verification failed")
            return JsonResponse({'status': 'error', 'message': 'Invalid signature'}, status=400)
        
        # Parse webhook data
        import json
        webhook_data = json.loads(body)
        
        print(f"Webhook event: {webhook_data.get('event')}")
        print(f"Webhook data: {webhook_data}")
        
        # Handle different webhook events
        event = webhook_data.get('event')
        data = webhook_data.get('data', {})
        
        if event == 'charge.success':
            # Payment was successful
            reference = data.get('reference')
            amount = data.get('amount', 0) / 100  # Convert from kobo to naira
            status = data.get('status')
            
            print(f"Payment successful - Reference: {reference}, Amount: {amount}, Status: {status}")
            
            # You can add additional processing here
            # For example, send confirmation emails, update analytics, etc.
            
        elif event == 'charge.failed':
            # Payment failed
            reference = data.get('reference')
            print(f"Payment failed - Reference: {reference}")
            
        elif event == 'subscription.create':
            # Subscription created
            print(f"Subscription created - {data.get('subscription_code')}")
            
        else:
            print(f"Unhandled webhook event: {event}")
        
        return JsonResponse({'status': 'success', 'message': 'Webhook processed'})
        
    except Exception as e:
        print(f"Webhook processing error: {str(e)}")
        import traceback
        print(f"Webhook traceback: {traceback.format_exc()}")
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def mark_certificate_downloaded(request):
    """
    Mark a certificate as downloaded to prevent re-downloading
    """
    try:
        data = json.loads(request.body)
        certificate_id = data.get('certificate_id')
        user_id = data.get('user_id')
        
        if not certificate_id or not user_id:
            return JsonResponse({
                'success': False,
                'message': 'Certificate ID and User ID are required'
            }, status=400)
        
        # Store certificate download in user's profile or session
        # For now, we'll use localStorage on frontend, but this could be stored in database
        return JsonResponse({
            'success': True,
            'message': 'Certificate download marked'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Error marking certificate download: {str(e)}'
        }, status=500)


# Paystack Webhook Handler
@csrf_exempt
@require_http_methods(["POST"])
def paystack_webhook(request):
    """
    Handle Paystack webhook notifications for payment events
    """
    try:
        # Get the raw request body
        payload = request.body
        signature = request.headers.get('X-Paystack-Signature', '')
        
        # Verify webhook signature (you should implement this with your Paystack secret)
        # For now, we'll process the webhook without signature verification
        # In production, you should verify the signature for security
        
        data = json.loads(payload)
        event_type = data.get('event')
        
        if event_type == 'charge.success':
            # Payment was successful
            payment_data = data.get('data', {})
            reference = payment_data.get('reference')
            amount = payment_data.get('amount', 0) / 100  # Convert from cents
            customer_email = payment_data.get('customer', {}).get('email', '')
            metadata = payment_data.get('metadata', {})
            
            # Extract project information from metadata
            project_id = metadata.get('project_id')
            donor_name = metadata.get('donor_name', 'Anonymous')
            dedication_message = metadata.get('dedication_message', '')
            trees_purchased = int(metadata.get('trees_purchased', 1))
            
            if project_id:
                try:
                    # Get the project
                    project = TreeProject.objects.get(id=project_id)
                    
                    # Create donation record
                    donation = TreeProjectDonation.objects.create(
                        project=project,
                        donor=None,  # Webhook doesn't have user context
                        amount=amount,
                        trees_purchased=trees_purchased,
                        payment_reference=reference,
                        payment_status='completed',
                        dedication_message=dedication_message,
                        donor_name=donor_name
                    )
                    
                    # Update project stats
                    project.funds_raised += amount
                    project.trees_planted += trees_purchased
                    project.save()
                    
                    return JsonResponse({'status': 'success'}, status=200)
                    
                except TreeProject.DoesNotExist:
                    return JsonResponse({'error': 'Project not found'}, status=404)
                except Exception as e:
                    return JsonResponse({'error': str(e)}, status=500)
        
        return JsonResponse({'status': 'ignored'}, status=200)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# Payment Verification Endpoint
@csrf_exempt
@require_http_methods(["POST"])
def verify_payment(request):
    """
    Verify payment with Paystack and create donation record
    """
    try:
        data = json.loads(request.body)
        reference = data.get('reference')
        project_id = data.get('project_id')
        amount = data.get('amount', 0)
        trees_purchased = data.get('trees_purchased', 1)
        donor_name = data.get('donor_name', 'Anonymous')
        dedication_message = data.get('dedication_message', '')
        selected_species = data.get('selected_species', {})
        
        if not reference or not project_id:
            return JsonResponse({'success': False, 'message': 'Missing required fields'}, 
                              status=400)
        
        # Verify payment with Paystack
        import requests
        paystack_secret = os.getenv('PAYSTACK_SECRET_KEY', 'sk_test_your_secret_key')
        
        verify_url = f"https://api.paystack.co/transaction/verify/{reference}"
        headers = {
            'Authorization': f'Bearer {paystack_secret}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(verify_url, headers=headers)
        paystack_data = response.json()
        
        if paystack_data.get('status') and paystack_data.get('data', {}).get('status') == 'success':
            # Payment is verified, create donation record
            try:
                project = TreeProject.objects.get(id=project_id)
                
                # Create donation record
                donation = TreeProjectDonation.objects.create(
                    project=project,
                    donor=None,  # This endpoint doesn't require authentication
                    amount=amount,
                    trees_purchased=trees_purchased,
                    payment_reference=reference,
                    payment_status='completed',
                    dedication_message=dedication_message,
                    donor_name=donor_name
                )
                
                # Store selected species in donation metadata (you might want to add a JSONField for this)
                # For now, we'll log it or store it in the dedication message
                if selected_species:
                    species_text = ", ".join([f"{species}: {qty}" for species, qty in selected_species.items() if qty > 0])
                    if species_text:
                        donation.dedication_message = f"{dedication_message}\n\nSelected Species: {species_text}".strip()
                        donation.save()
                
                # Update project stats
                project.funds_raised += amount
                project.trees_planted += trees_purchased
                project.save()
                
                # Prepare certificate data
                certificate_data = {
                    'certificate_id': donation.id,
                    'donor_name': donor_name,
                    'project_name': project.name,
                    'project_location': f"{project.city}, {project.country}",
                    'trees_planted': trees_purchased,
                    'amount': amount,
                    'date': donation.created_at.strftime('%B %d, %Y'),
                    'dedication_message': dedication_message
                }
                
                return JsonResponse({
                    'success': True,
                    'message': 'Payment verified successfully',
                    'certificate_data': certificate_data
                })
                
            except TreeProject.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Project not found'}, 
                                  status=404)
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, 
                                  status=500)
        else:
            return JsonResponse({'success': False, 'message': 'Payment verification failed'}, 
                              status=400)
            
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, 
                          status=500)
