from rest_framework import serializers
from .models import (
    Post,
    Poll,
    PollVote,
    Comment,
    Reaction,
    Repost,
    View,
    Follow,
    Bookmark,
    Notification,
    TreeProject,
    TreeProjectUpdate,
    TreeProjectDonation,
    Disaster,
)
from api.models import User
import requests
import json
import time


def reverse_geocode(latitude, longitude):
    """
    Convert latitude and longitude to a human-readable address using OpenStreetMap Nominatim API
    """
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={latitude}&lon={longitude}&zoom=18&addressdetails=1"
        headers = {
            'User-Agent': 'ClimateWavers/1.0'
        }
        
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'display_name' in data:
                return data['display_name']
            elif 'address' in data:
                address = data['address']
                parts = []
                if 'city' in address:
                    parts.append(address['city'])
                elif 'town' in address:
                    parts.append(address['town'])
                elif 'village' in address:
                    parts.append(address['village'])
                
                if 'state' in address:
                    parts.append(address['state'])
                if 'country' in address:
                    parts.append(address['country'])
                
                return ', '.join(parts) if parts else f"{latitude}, {longitude}"
        
        return f"{latitude}, {longitude}"
    except Exception as e:
        print(f"Reverse geocoding error: {e}")
        return f"{latitude}, {longitude}"


class UserSerializer(serializers.ModelSerializer):
    is_following = serializers.SerializerMethodField()
    profile_picture = serializers.ReadOnlyField()
    cover_image = serializers.URLField(source='cover', required=False, allow_blank=True, allow_null=True)
    
    # Allow cover and profile_pic fields to be updated
    cover = serializers.URLField(required=False, allow_blank=True, allow_null=True, max_length=500)
    profile_pic = serializers.URLField(required=False, allow_blank=True, allow_null=True, max_length=500)

    def get_is_following(self, obj):
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.followers.filter(follower=user).exists()
        return False
    
    def get_user_from_context(self):
        request = self.context.get("request", None)
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        return None

    class Meta:
        model = User
        fields = "__all__"
        extra_kwargs = {
            "password": {"write_only": True},
        }


class PostAuthorSerializer(serializers.ModelSerializer):
    profile_picture = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "profile_picture",
            "profile_pic",
        )


class PostSerializer(serializers.ModelSerializer):
    total_comments = serializers.IntegerField(read_only=True, default=0)
    total_reactions = serializers.IntegerField(read_only=True, default=0)
    total_views = serializers.IntegerField(read_only=True, default=0)
    total_reposts = serializers.IntegerField(read_only=True, default=0)
    total_bookmarks = serializers.IntegerField(read_only=True, default=0)
    user = PostAuthorSerializer(read_only=True)
    is_reacted = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    is_reposted = serializers.SerializerMethodField()
    
    # Custom field handling for image, video and audio
    image = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    video = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    audio = serializers.FileField(required=False, allow_null=True)
    location = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def _annotated_flag(self, obj, field_name):
        if field_name not in obj.__dict__:
            return None
        return bool(obj.__dict__.get(field_name))

    def get_is_reacted(self, obj):
        annotated = self._annotated_flag(obj, "is_reacted")
        if annotated is not None:
            return annotated
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.reactions.filter(user=user).exists()
        return False

    def get_is_bookmarked(self, obj):
        annotated = self._annotated_flag(obj, "is_bookmarked")
        if annotated is not None:
            return annotated
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.bookmarks.filter(user=user).exists()
        return False

    def get_is_reposted(self, obj):
        annotated = self._annotated_flag(obj, "is_reposted")
        if annotated is not None:
            return annotated
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.reposts.filter(user=user).exists()
        return False

    def get_user_from_context(self):
        request = self.context.get("request", None)
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        return None

    class Meta:
        model = Post
        fields = "__all__"

    def validate_image(self, value):
        """Validate image field - should be a string (URL) or None"""
        if value is None or value == '':
            return None
        if isinstance(value, str):
            return value
        # If it's a file object, we'll handle it in the create method
        return value
    
    def validate_video(self, value):
        """Validate video field - should be a string (URL) or None"""
        if value is None or value == '':
            return None
        if isinstance(value, str):
            return value
        # If it's a file object, we'll handle it in the create method
        return value
    
    def validate_audio(self, value):
        """Validate audio field - should be a file or None"""
        if value is None or value == '':
            return None
        return value
    
    def validate_location(self, value):
        """Validate location field - convert coordinates to address if needed"""
        if value is None or value == '':
            return None
        
        # Check if it's coordinates (lat, lon format)
        if ',' in value and len(value.split(',')) == 2:
            try:
                lat, lon = value.split(',')
                lat = float(lat.strip())
                lon = float(lon.strip())
                
                # Convert coordinates to address
                address = reverse_geocode(lat, lon)
                return address
            except (ValueError, IndexError):
                # If parsing fails, return original value
                return value
        
        return value

    def create(self, validated_data):
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            validated_data["user"] = user
        
        # Handle image field - if it's a file, we need to process it
        image_data = validated_data.get('image')
        if image_data and hasattr(image_data, 'read'):
            # If it's a file object, we need to handle it differently
            # For now, we'll skip it or handle it as needed
            validated_data['image'] = None
        
        return super().create(validated_data)


class CommentSerializer(serializers.ModelSerializer):
    total_comments = serializers.IntegerField(read_only=True)
    total_reactions = serializers.IntegerField(read_only=True)
    total_views = serializers.IntegerField(read_only=True)
    total_reposts = serializers.IntegerField(read_only=True)
    total_bookmarks = serializers.IntegerField(read_only=True)
    user = UserSerializer(read_only=True)
    post = PostSerializer(read_only=True)
    post_id = serializers.IntegerField(write_only=True, required=False)
    is_reposted = serializers.SerializerMethodField()
    is_reacted = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    def get_is_reacted(self, obj):
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.reactions.filter(user=user).exists()
        return False

    def get_is_reposted(self, obj):
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.reposts.filter(user=user).exists()
        return False

    def get_is_bookmarked(self, obj):
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            return obj.bookmarks.filter(user=user).exists()
        return False

    def get_user_from_context(self):
        request = self.context.get("request", None)
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        return None

    class Meta:
        model = Comment
        fields = "__all__"
    
    def create(self, validated_data):
        user = self.get_user_from_context()
        if user and user.is_authenticated:
            validated_data["user"] = user
        
        # Handle post_id if provided
        post_id = validated_data.pop('post_id', None)
        if post_id:
            from .models import Post
            try:
                post = Post.objects.get(id=post_id)
                validated_data['post'] = post
            except Post.DoesNotExist:
                raise serializers.ValidationError("Post not found")
        
        return super().create(validated_data)


class ReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    post = PostSerializer(read_only=True)
    comment = CommentSerializer(read_only=True)
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = Reaction
        fields = "__all__"

    def get_content_type(self, obj):
        return 'post' if obj.content_type.model == 'post' else 'comments'


class ViewSerializer(serializers.ModelSerializer):
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = View
        fields = "__all__"

    def get_content_type(self, obj):
        return 'post' if obj.content_type.model == 'post' else 'comments'


class FollowSerializer(serializers.ModelSerializer):
    follower = UserSerializer(read_only=True)
    following = UserSerializer(read_only=True)
    following_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Follow
        fields = "__all__"

    def create(self, validated_data):
        # Add the user from the request context to the validated data
        follower = self.context["request"].user
        
        # Handle following_id if provided
        following_id = validated_data.pop('following_id', None)
        if following_id:
            try:
                from api.models import User
                following = User.objects.get(id=following_id)
                validated_data['following'] = following
            except User.DoesNotExist:
                raise serializers.ValidationError("User to follow not found.")
        
        following = validated_data.get("following")
        
        # Check if the follow relationship already exists
        if Follow.objects.filter(follower=follower, following=following).exists():
            raise serializers.ValidationError("You are already following this user.")
        
        # Check if user is trying to follow themselves
        if follower == following:
            raise serializers.ValidationError("You cannot follow yourself.")
        
        validated_data["follower"] = follower
        return super().create(validated_data)


class BookmarkSerializer(serializers.ModelSerializer):
    post = PostSerializer(read_only=True)
    comment = CommentSerializer(read_only=True)
    content_type = serializers.SerializerMethodField()

    class Meta:
        model = Bookmark
        fields = "__all__"

    def get_content_type(self, obj):
        return 'post' if obj.content_type.model == 'post' else 'comments'


class PollSerializer(serializers.ModelSerializer):
    class Meta:
        model = Poll
        fields = "__all__"


class PollVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollVote
        fields = "__all__"


class RepostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    post = PostSerializer(read_only=True)
    comment = CommentSerializer(read_only=True)
    content_type = serializers.SerializerMethodField()
    poll = PollSerializer(read_only=True)

    class Meta:
        model = Repost
        fields = "__all__"

    def get_content_type(self, obj):
        return 'post' if obj.content_type.model == 'post' else 'comments'


class UserActivitySerializer(serializers.Serializer):
    posts = PostSerializer(many=True, read_only=True)
    comments = CommentSerializer(many=True, read_only=True)
    repost = RepostSerializer(many=True, read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    followers = FollowSerializer(many=True, read_only=True)
    followings = FollowSerializer(many=True, read_only=True)
    bookmarks = BookmarkSerializer(many=True, read_only=True)
    polls = PollSerializer(many=True, read_only=True)
    user_id = serializers.CharField()
    user = UserSerializer(read_only=True)


class NotificationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    content = serializers.SerializerMethodField()
    actor = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = "__all__"
        extra_kwargs = {
            'post': {'write_only': True},
            'comment': {'write_only': True},
        }

    def get_content(self, obj):
        if hasattr(obj, "_content_cache"):
            return obj._content_cache
        request = self.context.get("request")
        payload = None
        try:
            if obj.content_type and obj.content_type.model == 'post':
                payload = PostSerializer(Post.objects.get(id=obj.object_id), context={'request': request}).data
            elif obj.content_type and obj.content_type.model == 'comment':
                payload = CommentSerializer(Comment.objects.get(id=obj.object_id), context={'request': request}).data
            elif obj.content_type and obj.content_type.model == 'follow':
                payload = FollowSerializer(Follow.objects.get(id=obj.object_id), context={'request': request}).data
        except Exception:
            payload = None
        obj._content_cache = payload
        return payload

    def get_actor(self, obj):
        content = self.get_content(obj)
        if isinstance(content, dict):
            return content.get("user")
        return None


# Tree Project Serializers
class TreeProjectUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreeProjectUpdate
        fields = ['id', 'title', 'content', 'images', 'trees_planted_this_update', 'created_at', 'updated_at']


class TreeProjectDonationSerializer(serializers.ModelSerializer):
    donor_name = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.name', read_only=True)
    project_city = serializers.CharField(source='project.city', read_only=True)
    project_country = serializers.CharField(source='project.country', read_only=True)
    co2_absorption_per_tree = serializers.DecimalField(source='project.co2_absorption_per_tree', max_digits=5, decimal_places=2, read_only=True)
    
    class Meta:
        model = TreeProjectDonation
        fields = ['id', 'amount', 'trees_purchased', 'payment_reference', 'payment_status', 
                 'dedication_message', 'is_anonymous', 'created_at', 'donor_name',
                 'project_name', 'project_city', 'project_country', 'co2_absorption_per_tree']
        read_only_fields = ['payment_reference', 'created_at']
    
    def get_donor_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous"
        return f"{obj.donor.first_name} {obj.donor.last_name}".strip() or obj.donor.username


class TreeProjectSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.ReadOnlyField()
    funding_percentage = serializers.ReadOnlyField()
    total_co2_offset = serializers.ReadOnlyField()
    updates = TreeProjectUpdateSerializer(many=True, read_only=True)
    donations = TreeProjectDonationSerializer(many=True, read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    organization_logo_url = serializers.SerializerMethodField()
    gallery_urls = serializers.SerializerMethodField()
    
    class Meta:
        model = TreeProject
        fields = [
            'id', 'name', 'description', 'short_description', 'organization', 'organization_name',
            'organization_description', 'organization_website', 'organization_logo', 'organization_logo_url',
            'country', 'region', 'city', 'latitude', 'longitude', 'address',
            'project_type', 'status', 'target_trees', 'trees_planted', 'tree_species', 'tree_price',
            'co2_absorption_per_tree', 'biodiversity_impact', 'soil_improvement', 'water_conservation',
            'cover_image', 'cover_image_url', 'gallery', 'gallery_urls', 'start_date', 'expected_completion', 'actual_completion',
            'total_budget', 'funds_raised', 'funding_goal', 'is_verified', 'verification_date',
            'contact_person', 'contact_email', 'contact_phone',
            'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url',
            'progress_percentage', 'funding_percentage', 'total_co2_offset',
            'updates', 'donations', 'created_at', 'updated_at'
        ]
        read_only_fields = ['trees_planted', 'funds_raised', 'is_verified', 'verification_date', 'created_at', 'updated_at']
    
    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                # If it's a relative URL, make it absolute
                if obj.cover_image.startswith('/'):
                    return request.build_absolute_uri(obj.cover_image)
                return obj.cover_image
            return obj.cover_image
        return None
    
    def get_organization_logo_url(self, obj):
        if obj.organization_logo:
            request = self.context.get('request')
            if request:
                # If it's a relative URL, make it absolute
                if obj.organization_logo.startswith('/'):
                    return request.build_absolute_uri(obj.organization_logo)
                return obj.organization_logo
            return obj.organization_logo
        return None
    
    def get_gallery_urls(self, obj):
        if obj.gallery:
            request = self.context.get('request')
            if request:
                return [
                    request.build_absolute_uri(url) if url.startswith('/') else url
                    for url in obj.gallery
                ]
            return obj.gallery
        return []


class TreeProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreeProject
        fields = [
            'name', 'description', 'short_description', 'organization_name', 'organization_description',
            'organization_website', 'organization_logo', 'country', 'region', 'city', 'latitude', 'longitude', 'address',
            'project_type', 'target_trees', 'tree_species', 'tree_price', 'co2_absorption_per_tree',
            'biodiversity_impact', 'soil_improvement', 'water_conservation', 'cover_image', 'gallery', 'start_date',
            'expected_completion', 'total_budget', 'funding_goal', 'contact_person', 'contact_email',
            'contact_phone', 'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url'
        ]
    
    def create(self, validated_data):
        # Set the organization to the current user
        validated_data['organization'] = self.context['request'].user
        return super().create(validated_data)


class TreeProjectUpdateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreeProjectUpdate
        fields = ['title', 'content', 'images', 'trees_planted_this_update']
    
    def create(self, validated_data):
        validated_data['project'] = self.context['project']
        return super().create(validated_data)


class TreeProjectDonationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TreeProjectDonation
        fields = ['amount', 'trees_purchased', 'dedication_message', 'is_anonymous']
    
    def create(self, validated_data):
        validated_data['project'] = self.context['project']
        validated_data['donor'] = self.context['request'].user
        validated_data['payment_reference'] = f"TREE_{self.context['project'].id}_{int(time.time())}"
        return super().create(validated_data)


class DisasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disaster
        fields = [
            'id', 'title', 'description', 'disaster_type', 'severity', 'status',
            'country', 'region', 'city', 'latitude', 'longitude', 'address',
            'cover_image', 'gallery', 'start_date', 'end_date', 'is_verified',
            'affected_population', 'casualties', 'created_at', 'updated_at',
        ]
