# models.py
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.utils.html import strip_tags
import re


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ("post", "Post"),
        ("comment", "Comment"),
        ("reaction", "Reaction"),
        ("repost", "Repost"),
        ("poll", "Poll"),
        ("follow", "Follow"),
        ("disaster", "Disaster"),
        ("mention", "Mention"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    notification_type = models.CharField(
        max_length=20, choices=NOTIFICATION_TYPES)
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_content(self):
        """
        Retrieves the actual content related to the notification.
        """
        if self.content_object:
            return self.content_object
        return None

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message}"


class Post(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    title = models.CharField(max_length=200, blank=True, null=True)
    content = models.TextField()
    hashtags = models.CharField(max_length=255, blank=True, null=True)
    image = models.TextField(blank=True, null=True)
    video = models.TextField(blank=True, null=True)
    audio = models.TextField(blank=True, null=True, help_text="Audio media URL")
    location = models.CharField(max_length=255, blank=True, null=True)
    emoji = models.CharField(max_length=255, blank=True)
    gif = models.URLField(blank=True)
    is_donation = models.BooleanField(default=False)
    donation_approved = models.BooleanField(default=False)
    visibility = models.CharField(
        max_length=10,
        choices=[("Everyone", "Everyone"), ("Friends", "Friends")],
        default="Everyone",
    )
    font_family = models.CharField(
        max_length=64,
        blank=True,
        default="montserrat",
        help_text="Frontend post font id (e.g. montserrat, lora, playfair).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.content:
            self.hashtags = self.extract_hashtags(self.content)
        super().save(*args, **kwargs)

    def extract_hashtags(self, content):
        """
        Extract hashtags from content.
        """
        if not content:
            return ""
        content = strip_tags(content)
        hashtags = re.findall(r"#(\w+)", content)
        return " ".join(hashtags)

    def convert_hashtags_to_links(self, content):
        """
        Converts hashtags in the content to clickable links.
        """

        def replace_hashtag(match):
            hashtag = match.group(1)
            url = f"/search/?hashtag={hashtag}"
            return f'<a href="{url}">#{hashtag}</a>'

        return re.sub(r"#(\w+)", replace_hashtag, content)

    def get_content_with_links(self):
        """
        Returns the content with hashtags converted to clickable links.
        """
        return self.convert_hashtags_to_links(self.content)

    def clean(self):
        """
        Custom validation to ensure 'visibility' is a valid choice.
        """
        super().clean()
        if (
            self.visibility
            not in dict(self._meta.get_field("visibility").choices).keys()
        ):
            raise ValidationError(
                f"Invalid value for 'visibility': {self.visibility}")

    def image_url(self):
        """
        Returns the full URL for the image if it exists.
        """
        if self.image and hasattr(self.image, "url"):
            return self.image.url
        return None

    def audio_url(self):
        """
        Returns the full URL for the audio file if it exists.
        """
        if not self.audio:
            return None
        if hasattr(self.audio, "url"):
            return self.audio.url
        return str(self.audio)

    class Meta:
        ordering = ["-created_at"]


class SocialGroup(models.Model):
    """Community interest group for Climate Wavers members."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")
    cover_image = models.URLField(max_length=500, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_social_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SocialGroupMembership(models.Model):
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("member", "Member"),
    ]

    group = models.ForeignKey(
        SocialGroup, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="social_group_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="member")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} @ {self.group_id}"


class Poll(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    question = models.CharField(max_length=255)
    options = models.JSONField()
    duration = models.DurationField()
    visibility = models.CharField(
        max_length=10,
        choices=[("Everyone", "Everyone"), ("Friends", "Friends")],
        default="Everyone",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.question


class PollInteraction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="poll_interactions",
        on_delete=models.CASCADE,
    )
    poll = models.ForeignKey(
        Poll, related_name="interactions", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)


class PollVote(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    poll = models.ForeignKey(
        Poll, on_delete=models.CASCADE, related_name="votes")
    option = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} voted on {self.poll.question}"


class Comment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments"
    )
    post = models.ForeignKey(
        Post, related_name="comments", on_delete=models.CASCADE)
    parent_comment = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="subcomments",
        null=True,
        blank=True,
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    image = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.content[:20]

    @property
    def reaction_count(self):
        return self.reactions.count()

    def image_url(self):
        """
        Returns the full URL for the image if it exists.
        """
        if self.image and hasattr(self.image, "url"):
            return self.image.url
        return None

    def get_replies(self):
        """
        Returns replies to this comment.
        """
        return Comment.objects.filter(parent_comment=self)

    def get_all_comments(self):
        """
        Returns all comments, including replies.
        """
        comments = [self]
        stack = list(self.get_replies())
        while stack:
            comment = stack.pop()
            comments.append(comment)
            stack.extend(comment.get_replies())
        return comments

    class Meta:
        ordering = ["-created_at"]


class Reaction(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    post = models.ForeignKey(
        Post, related_name="reactions", on_delete=models.CASCADE, null=True,
        blank=True,)
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="reactions",
        null=True,
        blank=True,
    )
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    reaction_type = models.CharField(
        max_length=10,
        choices=[
            ("Like", "Like"),
            ("Love", "Love"),
            ("Haha", "Haha"),
            ("Wow", "Wow"),
            ("Sad", "Sad"),
            ("Angry", "Angry"),
        ],
        default="Like",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} reacted {self.reaction_type} on {self.post.title}"


class Repost(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name="reposts", null=True, blank=True
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="reposts",
        null=True,
        blank=True,
    )
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    poll = models.ForeignKey(
        Poll, on_delete=models.CASCADE, related_name="reposts", null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["post"]),
            models.Index(fields=["poll"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} reposted"


class View(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name="views", null=True, blank=True
    )
    poll = models.ForeignKey(
        Poll, on_delete=models.CASCADE, related_name="views", null=True, blank=True
    )
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["post"]),
            models.Index(fields=["poll"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.user.username} viewed"


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="following", on_delete=models.CASCADE
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="followers", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        """
        Ensures a user cannot follow themselves.
        """
        if self.follower_id and self.following_id and self.follower_id == self.following_id:
            raise ValidationError("User cannot follow themselves.")

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"


class Bookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    post = models.ForeignKey(Post, related_name="bookmarks",  null=True,
                             blank=True, on_delete=models.CASCADE)
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="bookmarks",
        null=True,
        blank=True,
    )
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "post")
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["post"]),
        ]

    def __str__(self):
        return f"{self.user.username} bookmarked {self.post.title}"


class TreeProject(models.Model):
    """
    Model for tree planting projects across Africa
    """
    PROJECT_STATUS = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('paused', 'Paused'),
        ('pending_approval', 'Pending Approval'),
    ]
    
    PROJECT_TYPES = [
        ('reforestation', 'Reforestation'),
        ('urban_greening', 'Urban Greening'),
        ('agroforestry', 'Agroforestry'),
        ('mangrove_restoration', 'Mangrove Restoration'),
        ('community_garden', 'Community Garden'),
        ('school_garden', 'School Garden'),
        ('carbon_offset', 'Carbon Offset'),
    ]
    
    # Basic Information
    name = models.CharField(max_length=200)
    description = models.TextField()
    short_description = models.CharField(max_length=500, blank=True, null=True)
    
    # Organization Details
    organization = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='tree_projects'
    )
    tree_admin_org = models.ForeignKey(
        "TreeAdminOrganization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
        help_text="Verified Tree Admin org that owns this project",
    )
    organization_name = models.CharField(max_length=200)
    organization_description = models.TextField(blank=True, null=True)
    organization_website = models.URLField(blank=True, null=True)
    organization_logo = models.CharField(max_length=500, blank=True, null=True, help_text="Organization logo URL or path")
    
    # Location Details
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    address = models.TextField(blank=True, null=True)
    
    # Project Details
    project_type = models.CharField(max_length=50, choices=PROJECT_TYPES)
    status = models.CharField(max_length=20, choices=PROJECT_STATUS, default='pending_approval')
    
    # Tree Information
    target_trees = models.PositiveIntegerField()
    trees_planted = models.PositiveIntegerField(default=0)
    tree_species = models.JSONField(default=list, blank=True)  # List of tree species
    tree_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price in USD")
    
    # Environmental Impact
    co2_absorption_per_tree = models.DecimalField(max_digits=8, decimal_places=2, default=22.0)
    biodiversity_impact = models.TextField(blank=True, null=True)
    soil_improvement = models.TextField(blank=True, null=True)
    water_conservation = models.TextField(blank=True, null=True)
    
    # Media
    cover_image = models.CharField(max_length=500, blank=True, null=True, help_text="Project cover image URL or path")
    gallery = models.JSONField(default=list, blank=True, help_text="List of image URLs")
    
    # Project Timeline
    start_date = models.DateField()
    expected_completion = models.DateField()
    actual_completion = models.DateField(null=True, blank=True)
    
    # Funding
    total_budget = models.DecimalField(max_digits=12, decimal_places=2, help_text="Budget in USD")
    funds_raised = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Funds raised in USD")
    funding_goal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Funding goal in USD")
    
    # Verification
    is_verified = models.BooleanField(default=False)
    verification_documents = models.JSONField(default=list, blank=True)
    verification_date = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='verified_projects'
    )
    
    # Contact Information
    contact_person = models.CharField(max_length=200)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Social Media
    facebook_url = models.URLField(blank=True, null=True)
    twitter_url = models.URLField(blank=True, null=True)
    instagram_url = models.URLField(blank=True, null=True)
    linkedin_url = models.URLField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['country']),
            models.Index(fields=['project_type']),
            models.Index(fields=['status']),
            models.Index(fields=['is_verified']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.country}"
    
    @property
    def progress_percentage(self):
        """Calculate project progress percentage"""
        if self.target_trees == 0:
            return 0
        return min((self.trees_planted / self.target_trees) * 100, 100)
    
    @property
    def funding_percentage(self):
        """Calculate funding progress percentage"""
        if not self.funding_goal or self.funding_goal == 0:
            return 0
        return min((self.funds_raised / self.funding_goal) * 100, 100)
    
    @property
    def total_co2_offset(self):
        """Calculate total CO2 offset from planted trees"""
        return self.trees_planted * self.co2_absorption_per_tree
    
    def get_absolute_url(self):
        return f"/projects/{self.id}/"


class TreeProjectUpdate(models.Model):
    """
    Model for project updates and progress reports
    """
    project = models.ForeignKey(
        TreeProject, 
        on_delete=models.CASCADE, 
        related_name='updates'
    )
    title = models.CharField(max_length=200)
    content = models.TextField()
    images = models.JSONField(default=list, blank=True)  # List of image file paths
    trees_planted_this_update = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Update for {self.project.name}: {self.title}"


class TreeProjectDonation(models.Model):
    """
    Model for tracking donations to tree projects
    """
    project = models.ForeignKey(
        TreeProject, 
        on_delete=models.CASCADE, 
        related_name='donations'
    )
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='tree_donations',
        null=True,
        blank=True,
    )
    gifted_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="gifted_tree_donations",
        null=True,
        blank=True,
        help_text="User this tree gift is dedicated to (shared profile purchases)",
    )
    payer_email = models.EmailField(blank=True, default="")
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount charged, in major units")
    platform_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Climate Wavers platform fee share",
    )
    admin_share = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Amount attributed to the Tree Admin project",
    )
    fee_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.18,
        help_text="Platform fee rate applied at payment time",
    )
    trees_purchased = models.PositiveIntegerField()
    payment_reference = models.CharField(max_length=100, unique=True)
    payment_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('refunded', 'Refunded'),
        ],
        default='pending'
    )
    dedication_message = models.TextField(blank=True, null=True)
    is_anonymous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        donor_label = self.donor.username if self.donor_id else (self.payer_email or "anonymous")
        return f"Donation to {self.project.name} by {donor_label}"


class WaversPointsAccount(models.Model):
    """Loyalty wallet: gift trees → earn points → redeem a free tree."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wavers_points",
    )
    balance = models.PositiveIntegerField(default=0)
    lifetime_earned = models.PositiveIntegerField(default=0)
    lifetime_redeemed = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user_id}: {self.balance} pts"


class WaversPointsLedger(models.Model):
    REASON_CHOICES = [
        ("gift_earn", "Gift reward"),
        ("redeem_tree", "Redeem tree"),
        ("adjustment", "Adjustment"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wavers_points_ledger",
    )
    delta = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=32, choices=REASON_CHOICES)
    note = models.CharField(max_length=255, blank=True, default="")
    donation = models.ForeignKey(
        TreeProjectDonation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="points_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} {self.delta} ({self.reason})"


class Campaign(models.Model):
    """
    Comprehensive model for all types of climate and environmental campaigns
    """
    CAMPAIGN_TYPES = [
        ('disaster_relief', 'Disaster Relief'),
        ('tree_planting', 'Tree Planting'),
        ('renewable_energy', 'Renewable Energy'),
        ('ocean_cleanup', 'Ocean Cleanup'),
        ('wildlife_conservation', 'Wildlife Conservation'),
        ('climate_education', 'Climate Education'),
        ('carbon_offset', 'Carbon Offset'),
        ('sustainable_agriculture', 'Sustainable Agriculture'),
        ('waste_reduction', 'Waste Reduction'),
        ('water_conservation', 'Water Conservation'),
        ('air_quality', 'Air Quality Improvement'),
        ('biodiversity', 'Biodiversity Protection'),
        ('renewable_transport', 'Renewable Transport'),
        ('green_building', 'Green Building'),
        ('environmental_justice', 'Environmental Justice'),
        ('other', 'Other'),
    ]
    
    CAMPAIGN_STATUS = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Approval'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    URGENCY_LEVELS = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    # Basic Information
    title = models.CharField(max_length=200)
    description = models.TextField()
    short_description = models.CharField(max_length=500, blank=True, null=True)
    campaign_type = models.CharField(max_length=50, choices=CAMPAIGN_TYPES)
    status = models.CharField(max_length=20, choices=CAMPAIGN_STATUS, default='draft')
    urgency_level = models.CharField(max_length=20, choices=URGENCY_LEVELS, default='medium')
    
    # Creator Information
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='created_campaigns'
    )
    organization_name = models.CharField(max_length=200, blank=True, null=True)
    organization_description = models.TextField(blank=True, null=True)
    organization_website = models.URLField(blank=True, null=True)
    organization_logo = models.CharField(max_length=500, blank=True, null=True)
    
    # Location Information
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    address = models.TextField(blank=True, null=True)
    
    # Campaign Goals and Metrics
    target_amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Target amount in USD")
    amount_raised = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Amount raised in USD")
    target_metric = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., '1000 trees planted', '500 kg waste collected'")
    current_metric = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Current progress metric")
    metric_unit = models.CharField(max_length=50, blank=True, null=True, help_text="e.g., 'trees', 'kg', 'people helped'")
    
    # Timeline
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Media
    cover_image = models.CharField(max_length=500, blank=True, null=True)
    gallery = models.JSONField(default=list, blank=True)
    video_url = models.URLField(blank=True, null=True)
    
    # AI Generated Fields
    is_ai_generated = models.BooleanField(default=False)
    ai_source = models.CharField(max_length=100, blank=True, null=True, help_text="Source of AI generation (e.g., 'disaster_report', 'climate_data')")
    ai_confidence_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, help_text="AI confidence score 0-1")
    
    # Disaster Relief Specific Fields
    disaster_type = models.CharField(max_length=100, blank=True, null=True)
    disaster_severity = models.CharField(max_length=50, blank=True, null=True)
    affected_population = models.PositiveIntegerField(null=True, blank=True)
    emergency_contact = models.CharField(max_length=200, blank=True, null=True)
    emergency_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Environmental Impact
    expected_co2_reduction = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Expected CO2 reduction in tons")
    environmental_benefits = models.TextField(blank=True, null=True)
    sustainability_goals = models.JSONField(default=list, blank=True, help_text="List of UN SDGs addressed")
    
    # Verification and Trust
    is_verified = models.BooleanField(default=False)
    verification_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('under_review', 'Under Review'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
            ('needs_more_info', 'Needs More Information'),
        ],
        default='pending'
    )
    verification_documents = models.JSONField(default=list, blank=True)
    verification_notes = models.TextField(blank=True, null=True)
    verification_date = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_campaigns'
    )
    rejection_reason = models.TextField(blank=True, null=True)
    verification_score = models.DecimalField(
        max_digits=3, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Verification confidence score 0-1"
    )
    
    # Contact Information
    contact_person = models.CharField(max_length=200)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Social Media
    facebook_url = models.URLField(blank=True, null=True)
    twitter_url = models.URLField(blank=True, null=True)
    instagram_url = models.URLField(blank=True, null=True)
    linkedin_url = models.URLField(blank=True, null=True)
    
    # Analytics
    view_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    donation_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['campaign_type']),
            models.Index(fields=['status']),
            models.Index(fields=['country']),
            models.Index(fields=['urgency_level']),
            models.Index(fields=['is_verified']),
            models.Index(fields=['is_ai_generated']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.get_campaign_type_display()}"
    
    @property
    def progress_percentage(self):
        """Calculate campaign progress percentage"""
        if self.target_amount == 0:
            return 0
        return min((self.amount_raised / self.target_amount) * 100, 100)
    
    @property
    def metric_progress_percentage(self):
        """Calculate metric progress percentage"""
        if not self.target_metric or not self.current_metric:
            return 0
        try:
            target_value = float(self.target_metric.split()[0])  # Extract number from "1000 trees"
            return min((float(self.current_metric) / target_value) * 100, 100)
        except:
            return 0
    
    @property
    def days_remaining(self):
        """Calculate days remaining until end date"""
        if not self.end_date:
            return None
        from django.utils import timezone
        today = timezone.now().date()
        return (self.end_date - today).days
    
    @property
    def is_urgent(self):
        """Check if campaign is urgent based on urgency level and days remaining"""
        return self.urgency_level in ['high', 'critical'] or (self.days_remaining and self.days_remaining <= 7)
    
    def get_absolute_url(self):
        return f"/campaigns/{self.id}/"
    
    def approve_campaign(self, verified_by_user, verification_score=None, notes=None):
        """Approve a campaign for public display"""
        from django.utils import timezone
        
        self.verification_status = 'approved'
        self.is_verified = True
        self.verified_by = verified_by_user
        self.verification_date = timezone.now()
        if verification_score:
            self.verification_score = verification_score
        if notes:
            self.verification_notes = notes
        self.save()
        
    def reject_campaign(self, verified_by_user, rejection_reason):
        """Reject a campaign"""
        from django.utils import timezone
        
        self.verification_status = 'rejected'
        self.is_verified = False
        self.verified_by = verified_by_user
        self.verification_date = timezone.now()
        self.rejection_reason = rejection_reason
        self.save()
        
    def request_more_info(self, verified_by_user, notes):
        """Request more information from campaign creator"""
        from django.utils import timezone
        
        self.verification_status = 'needs_more_info'
        self.verified_by = verified_by_user
        self.verification_date = timezone.now()
        self.verification_notes = notes
        self.save()
        
    def start_review(self, verified_by_user):
        """Start the review process"""
        self.verification_status = 'under_review'
        self.verified_by = verified_by_user
        self.save()


class CampaignUpdate(models.Model):
    """
    Model for campaign updates and progress reports
    """
    campaign = models.ForeignKey(
        Campaign, 
        on_delete=models.CASCADE, 
        related_name='updates'
    )
    title = models.CharField(max_length=200)
    content = models.TextField()
    images = models.JSONField(default=list, blank=True)
    metric_progress = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Update for {self.campaign.title}: {self.title}"


class CampaignDonation(models.Model):
    """
    Model for tracking donations to campaigns
    """
    campaign = models.ForeignKey(
        Campaign, 
        on_delete=models.CASCADE, 
        related_name='donations'
    )
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='campaign_donations'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount in USD")
    payment_reference = models.CharField(max_length=100, unique=True)
    payment_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('refunded', 'Refunded'),
        ],
        default='pending'
    )
    is_anonymous = models.BooleanField(default=False)
    message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Donation by {self.donor.username} for {self.campaign.title}"


class Disaster(models.Model):
    """
    Comprehensive model for disaster management and tracking
    """
    DISASTER_TYPES = [
        ('earthquake', 'Earthquake'),
        ('flood', 'Flood'),
        ('wildfire', 'Wildfire'),
        ('hurricane', 'Hurricane'),
        ('tornado', 'Tornado'),
        ('drought', 'Drought'),
        ('tsunami', 'Tsunami'),
        ('volcanic_eruption', 'Volcanic Eruption'),
        ('landslide', 'Landslide'),
        ('heatwave', 'Heatwave'),
        ('coldwave', 'Coldwave'),
        ('storm', 'Storm'),
        ('cyclone', 'Cyclone'),
        ('typhoon', 'Typhoon'),
        ('blizzard', 'Blizzard'),
        ('avalanche', 'Avalanche'),
        ('pandemic', 'Pandemic'),
        ('industrial_accident', 'Industrial Accident'),
        ('nuclear_accident', 'Nuclear Accident'),
        ('terrorist_attack', 'Terrorist Attack'),
        ('civil_unrest', 'Civil Unrest'),
        ('war', 'War'),
        ('other', 'Other'),
    ]
    
    SEVERITY_LEVELS = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
        ('severe', 'Severe'),
        ('extreme', 'Extreme'),
        ('catastrophic', 'Catastrophic'),
    ]
    
    STATUS_CHOICES = [
        ('monitoring', 'Monitoring'),
        ('alert', 'Alert'),
        ('warning', 'Warning'),
        ('ongoing', 'Ongoing'),
        ('contained', 'Contained'),
        ('resolved', 'Resolved'),
        ('investigating', 'Investigating'),
    ]
    
    # Basic Information
    title = models.CharField(max_length=200)
    description = models.TextField()
    disaster_type = models.CharField(max_length=50, choices=DISASTER_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_LEVELS)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='monitoring')
    
    # Location Information
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    address = models.TextField(blank=True, null=True)
    affected_area_radius = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Affected area radius in kilometers")
    
    # Impact Assessment
    affected_population = models.PositiveIntegerField(null=True, blank=True)
    casualties = models.PositiveIntegerField(null=True, blank=True, help_text="Number of deaths")
    injured = models.PositiveIntegerField(null=True, blank=True)
    missing = models.PositiveIntegerField(null=True, blank=True)
    displaced = models.PositiveIntegerField(null=True, blank=True, help_text="Number of displaced people")
    economic_damage = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text="Economic damage in USD")
    
    # Timeline
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    # Media and Documentation
    cover_image = models.CharField(max_length=500, blank=True, null=True, help_text="Cover image URL or path")
    gallery = models.JSONField(default=list, blank=True, help_text="List of image URLs")
    video_urls = models.JSONField(default=list, blank=True, help_text="List of video URLs")
    documents = models.JSONField(default=list, blank=True, help_text="List of document URLs")
    
    # Official Information
    official_source = models.CharField(max_length=200, blank=True, null=True, help_text="Official source organization")
    official_website = models.URLField(blank=True, null=True)
    emergency_contact = models.CharField(max_length=200, blank=True, null=True)
    emergency_phone = models.CharField(max_length=20, blank=True, null=True)
    emergency_email = models.EmailField(blank=True, null=True)
    
    # Weather and Environmental Data
    weather_conditions = models.TextField(blank=True, null=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Temperature in Celsius")
    wind_speed = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Wind speed in km/h")
    humidity = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Humidity percentage")
    precipitation = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Precipitation in mm")
    
    # Response and Relief
    response_organizations = models.JSONField(default=list, blank=True, help_text="List of responding organizations")
    relief_efforts = models.TextField(blank=True, null=True)
    evacuation_centers = models.JSONField(default=list, blank=True, help_text="List of evacuation centers")
    emergency_shelters = models.JSONField(default=list, blank=True, help_text="List of emergency shelters")
    
    # Related Campaigns and Projects
    related_campaigns = models.ManyToManyField(
        'Campaign', 
        blank=True, 
        related_name='related_disasters',
        help_text="Campaigns created in response to this disaster"
    )
    
    # Verification and Trust
    is_verified = models.BooleanField(default=False)
    verification_source = models.CharField(max_length=200, blank=True, null=True)
    verification_date = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_disasters'
    )
    
    # Analytics
    view_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    alert_count = models.PositiveIntegerField(default=0, help_text="Number of people who received alerts")
    
    # AI and Automation
    is_ai_detected = models.BooleanField(default=False)
    ai_confidence_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True, help_text="AI confidence score 0-1")
    ai_source = models.CharField(max_length=100, blank=True, null=True, help_text="AI detection source")
    
    # Social Media and Communication
    social_media_hashtags = models.JSONField(default=list, blank=True, help_text="Relevant hashtags")
    social_media_mentions = models.PositiveIntegerField(default=0)
    
    # International Classification
    disaster_id = models.CharField(max_length=50, unique=True, blank=True, null=True, help_text="International disaster ID")
    emdat_id = models.CharField(max_length=50, blank=True, null=True, help_text="EM-DAT disaster ID")
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['disaster_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['status']),
            models.Index(fields=['country']),
            models.Index(fields=['start_date']),
            models.Index(fields=['is_verified']),
            models.Index(fields=['latitude', 'longitude']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.get_disaster_type_display()} ({self.country})"
    
    @property
    def duration_days(self):
        """Calculate disaster duration in days"""
        if not self.end_date:
            from django.utils import timezone
            return (timezone.now() - self.start_date).days
        return (self.end_date - self.start_date).days
    
    @property
    def is_active(self):
        """Check if disaster is currently active"""
        return self.status in ['monitoring', 'alert', 'warning', 'ongoing']
    
    @property
    def is_urgent(self):
        """Check if disaster requires urgent attention"""
        return self.severity in ['severe', 'extreme', 'catastrophic'] or self.status in ['alert', 'warning', 'ongoing']
    
    @property
    def total_affected(self):
        """Calculate total affected people"""
        return (self.casualties or 0) + (self.injured or 0) + (self.missing or 0) + (self.displaced or 0)
    
    def get_absolute_url(self):
        return f"/disasters/{self.id}/"
    
    def increment_view_count(self):
        """Increment view count"""
        self.view_count += 1
        self.save(update_fields=['view_count'])
    
    def increment_share_count(self):
        """Increment share count"""
        self.share_count += 1
        self.save(update_fields=['share_count'])
    
    def increment_alert_count(self):
        """Increment alert count"""
        self.alert_count += 1
        self.save(update_fields=['alert_count'])


class DisasterUpdate(models.Model):
    """
    Model for disaster updates and progress reports
    """
    UPDATE_TYPES = [
        ('status_change', 'Status Change'),
        ('casualty_update', 'Casualty Update'),
        ('response_update', 'Response Update'),
        ('weather_update', 'Weather Update'),
        ('evacuation_update', 'Evacuation Update'),
        ('relief_update', 'Relief Update'),
        ('recovery_update', 'Recovery Update'),
        ('other', 'Other'),
    ]
    
    disaster = models.ForeignKey(
        Disaster, 
        on_delete=models.CASCADE, 
        related_name='updates'
    )
    title = models.CharField(max_length=200)
    content = models.TextField()
    update_type = models.CharField(max_length=20, choices=UPDATE_TYPES, default='other')
    images = models.JSONField(default=list, blank=True)
    video_urls = models.JSONField(default=list, blank=True)
    
    # Updated metrics
    casualties_update = models.PositiveIntegerField(null=True, blank=True)
    injured_update = models.PositiveIntegerField(null=True, blank=True)
    missing_update = models.PositiveIntegerField(null=True, blank=True)
    displaced_update = models.PositiveIntegerField(null=True, blank=True)
    
    # Author information
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='disaster_updates'
    )
    author_name = models.CharField(max_length=200, blank=True, null=True)
    author_title = models.CharField(max_length=100, blank=True, null=True)
    author_organization = models.CharField(max_length=200, blank=True, null=True)
    
    # Verification
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_disaster_updates'
    )
    verification_date = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Update for {self.disaster.title}: {self.title}"


class DisasterAlert(models.Model):
    """
    Model for disaster alerts and notifications
    """
    ALERT_TYPES = [
        ('warning', 'Warning'),
        ('alert', 'Alert'),
        ('emergency', 'Emergency'),
        ('evacuation', 'Evacuation'),
        ('shelter_in_place', 'Shelter in Place'),
        ('all_clear', 'All Clear'),
    ]
    
    ALERT_PRIORITIES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    disaster = models.ForeignKey(
        Disaster,
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    priority = models.CharField(max_length=10, choices=ALERT_PRIORITIES, default='medium')
    
    # Target audience
    target_country = models.CharField(max_length=100, blank=True, null=True)
    target_region = models.CharField(max_length=100, blank=True, null=True)
    target_city = models.CharField(max_length=100, blank=True, null=True)
    target_radius = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Target radius in kilometers")
    
    # Delivery
    delivery_methods = models.JSONField(default=list, blank=True, help_text="List of delivery methods: email, sms, push, web")
    is_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    recipients_count = models.PositiveIntegerField(default=0)
    
    # Expiry
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_disaster_alerts'
    )
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.alert_type.title()} Alert: {self.title}"
    
    @property
    def is_expired(self):
        """Check if alert has expired"""
        if not self.expires_at:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    source = models.CharField(max_length=40, default="footer")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email


class UserAlertPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="alert_preference",
    )
    email_alerts = models.BooleanField(default=True)
    whatsapp_alerts = models.BooleanField(default=False)
    radius_km = models.PositiveIntegerField(default=100)
    min_magnitude = models.DecimalField(
        max_digits=3, decimal_places=1, default=4.5
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    phone = models.CharField(max_length=32, blank=True, null=True)
    phone_verified = models.BooleanField(default=False)
    phone_otp = models.CharField(max_length=12, blank=True, null=True)
    phone_otp_expires = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Alert prefs for {self.user.email}"


class EmergencyAgency(models.Model):
    AGENCY_TYPES = [
        ("fire", "Fire"),
        ("police", "Police"),
        ("medical", "Medical"),
        ("red_cross", "Red Cross"),
        ("county", "County Emergency"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=200)
    agency_type = models.CharField(max_length=20, choices=AGENCY_TYPES, default="other")
    phone = models.CharField(max_length=32, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    whatsapp_opt_in = models.BooleanField(default=False)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    country = models.CharField(max_length=100, default="Kenya")
    city = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(
                fields=["latitude", "longitude"],
                name="core_emerge_latitud_idx",
            ),
            models.Index(
                fields=["country", "is_active"],
                name="core_emerge_country_idx",
            ),
        ]

    def __str__(self):
        return self.name


class OfficialAlertEvent(models.Model):
    """Dedupes official USGS/NASA (and similar) fanouts."""

    event_id = models.CharField(max_length=120, unique=True)
    source = models.CharField(max_length=40)
    title = models.CharField(max_length=300, blank=True)
    disaster_type = models.CharField(max_length=80, blank=True)
    magnitude = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    source_url = models.URLField(blank=True, null=True)
    payload = models.JSONField(default=dict, blank=True)
    ai_summary = models.TextField(blank=True)
    fanout_result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source}:{self.event_id}"


class WaverXTweet(models.Model):
    """Log of WaverX posts to X (Twitter) — alerts, tips, and dry-runs."""

    KIND_CHOICES = [
        ("alert", "Verified alert"),
        ("tip", "Climate tip"),
    ]
    STATUS_CHOICES = [
        ("posted", "Posted"),
        ("failed", "Failed"),
        ("skipped", "Skipped"),
        ("dry_run", "Dry run"),
    ]

    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    fingerprint = models.CharField(max_length=160, unique=True)
    event_id = models.CharField(max_length=120, blank=True, default="")
    text = models.TextField()
    tweet_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="skipped")
    response = models.JSONField(default=dict, blank=True)
    feed_post_id = models.CharField(max_length=64, blank=True, default="")
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["kind", "status"]),
            models.Index(fields=["event_id"]),
        ]

    def __str__(self):
        return f"{self.kind}:{self.fingerprint}:{self.status}"


class ResponderOrganization(models.Model):
    """Verified disaster-response org (Red Cross, county, UN, NGO, etc.)."""

    ORG_TYPES = [
        ("fire", "Fire"),
        ("police", "Police"),
        ("medical", "Medical"),
        ("red_cross", "Red Cross"),
        ("county", "County Emergency"),
        ("government", "Government"),
        ("un", "United Nations"),
        ("ngo", "NGO"),
        ("other", "Other"),
    ]
    VERIFICATION_STATUSES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    name = models.CharField(max_length=200)
    org_type = models.CharField(max_length=20, choices=ORG_TYPES, default="other")
    agency = models.ForeignKey(
        EmergencyAgency,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responder_orgs",
    )
    logo = models.URLField(max_length=500, blank=True, null=True)
    website = models.URLField(max_length=500, blank=True, null=True)
    country = models.CharField(max_length=100, default="Kenya")
    city = models.CharField(max_length=100, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    coverage_radius_km = models.PositiveIntegerField(default=150)
    disaster_types = models.JSONField(
        default=list,
        blank=True,
        help_text="Disaster types this org responds to; empty = all",
    )
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=32, blank=True, null=True)
    whatsapp_opt_in = models.BooleanField(default=False)
    verification_status = models.CharField(
        max_length=20, choices=VERIFICATION_STATUSES, default="pending"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    # RapidBrief monetization — pilot starts on admin approve.
    PLAN_CHOICES = [
        ("pilot", "RapidBrief Pilot"),
        ("ngo", "RapidBrief NGO"),
        ("org", "RapidBrief Org"),
        ("partner", "FlowOps Partner"),
    ]
    PLAN_STATUS_CHOICES = [
        ("pending", "Pending verification"),
        ("trial", "Trial"),
        ("active", "Active"),
        ("expired", "Expired"),
    ]
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default="pilot")
    plan_status = models.CharField(
        max_length=20, choices=PLAN_STATUS_CHOICES, default="pending"
    )
    plan_started_at = models.DateTimeField(null=True, blank=True)
    plan_ends_at = models.DateTimeField(null=True, blank=True)
    max_seats = models.PositiveIntegerField(default=5)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_responder_orgs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["verification_status"]),
            models.Index(fields=["latitude", "longitude"]),
            models.Index(fields=["country", "verification_status"]),
            models.Index(fields=["plan", "plan_status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.verification_status})"

    @property
    def has_rapidbrief_access(self):
        from .pricing import has_rapidbrief_access

        return has_rapidbrief_access(self)


class ResponderMembership(models.Model):
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("dispatcher", "Dispatcher"),
        ("viewer", "Viewer"),
    ]

    org = models.ForeignKey(
        ResponderOrganization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="responder_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="owner")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("org", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} @ {self.org_id} ({self.role})"


class ResponderSeatInvite(models.Model):
    """Pending seat invite counted against max_seats until accepted or revoked."""

    ROLE_CHOICES = ResponderMembership.ROLE_CHOICES
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("revoked", "Revoked"),
        ("expired", "Expired"),
    ]

    org = models.ForeignKey(
        ResponderOrganization,
        on_delete=models.CASCADE,
        related_name="seat_invites",
    )
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="dispatcher")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_responder_invites",
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accepted_responder_invites",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "status"]),
            models.Index(fields=["org", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["org", "email"],
                condition=models.Q(status="pending"),
                name="uniq_pending_responder_seat_invite",
            )
        ]

    def __str__(self):
        return f"Invite {self.email} → {self.org_id} ({self.status})"


class ResponderPlanPayment(models.Model):
    """Idempotent Paystack records for RapidBrief NGO / Org renewals."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    org = models.ForeignKey(
        ResponderOrganization,
        on_delete=models.CASCADE,
        related_name="plan_payments",
    )
    plan = models.CharField(max_length=20)
    months = models.PositiveIntegerField(default=1)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=8, default="KES")
    payment_reference = models.CharField(max_length=100, unique=True)
    payment_status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending"
    )
    payer_email = models.EmailField(blank=True, default="")
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responder_plan_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"RapidBrief {self.plan} {self.payment_reference} ({self.payment_status})"


class ResponderDispatch(models.Model):
    STATUS_CHOICES = [
        ("new", "New"),
        ("acknowledged", "Acknowledged"),
        ("mobilizing", "Mobilizing"),
        ("on_scene", "On scene"),
        ("declined", "Declined"),
        ("resolved", "Resolved"),
    ]

    org = models.ForeignKey(
        ResponderOrganization,
        on_delete=models.CASCADE,
        related_name="dispatches",
    )
    event_key = models.CharField(max_length=200)
    source = models.CharField(max_length=40, blank=True, default="")
    disaster_type = models.CharField(max_length=80, blank=True, default="")
    place = models.CharField(max_length=300, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    magnitude = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    is_official = models.BooleanField(default=False)
    confidence = models.CharField(max_length=120, blank=True, default="")
    ai_summary = models.TextField(blank=True, default="")
    ai_brief = models.TextField(blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    distance_km = models.DecimalField(
        max_digits=8, decimal_places=1, null=True, blank=True
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    notified_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acknowledged_dispatches",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("org", "event_key")
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["event_key"]),
        ]

    def __str__(self):
        return f"Dispatch {self.event_key} → {self.org_id} ({self.status})"


class TreeAdminOrganization(models.Model):
    """Local planter / nursery / CBO that runs Climate Wavers tree projects."""

    ORG_TYPES = [
        ("nursery", "Tree Nursery"),
        ("cbo", "Community CBO"),
        ("school", "School / Campus"),
        ("church", "Faith Group"),
        ("county", "County / Government"),
        ("ngo", "NGO"),
        ("other", "Other"),
    ]
    VERIFICATION_STATUSES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    PLAN_CHOICES = [
        ("pilot", "Tree Admin Pilot"),
        ("growth", "Tree Admin Growth"),
        ("partner", "Tree Admin Partner"),
    ]
    PLAN_STATUS_CHOICES = [
        ("pending", "Pending verification"),
        ("trial", "Trial"),
        ("active", "Active"),
        ("expired", "Expired"),
    ]

    name = models.CharField(max_length=200)
    org_type = models.CharField(max_length=20, choices=ORG_TYPES, default="cbo")
    website = models.URLField(max_length=500, blank=True, null=True)
    country = models.CharField(max_length=100, default="Kenya")
    city = models.CharField(max_length=100, blank=True, null=True)
    contact_email = models.EmailField(blank=True, null=True)
    contact_phone = models.CharField(max_length=40, blank=True, null=True)
    planting_sites_note = models.TextField(
        blank=True,
        null=True,
        help_text="Where they can plant (school, farm, riverbank, etc.)",
    )
    verification_status = models.CharField(
        max_length=20, choices=VERIFICATION_STATUSES, default="pending"
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default="pilot")
    plan_status = models.CharField(
        max_length=20, choices=PLAN_STATUS_CHOICES, default="pending"
    )
    plan_started_at = models.DateTimeField(null=True, blank=True)
    plan_ends_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tree_admin_orgs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["verification_status"]),
            models.Index(fields=["country", "city"]),
            models.Index(fields=["plan", "plan_status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.verification_status})"

    @property
    def has_tree_admin_access(self):
        from .tree_pricing import has_tree_admin_access

        return has_tree_admin_access(self)


class TreeAdminMembership(models.Model):
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("manager", "Manager"),
        ("viewer", "Viewer"),
    ]

    org = models.ForeignKey(
        TreeAdminOrganization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tree_admin_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="owner")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("org", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} @ tree-admin {self.org_id} ({self.role})"



class Conversation(models.Model):
    """Community, DM, responder-org, or social-group chat room."""

    TYPE_CHOICES = [
        ("community", "Community"),
        ("dm", "Direct"),
        ("responder", "Responder"),
        ("group", "Group"),
    ]

    conversation_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    name = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    avatar = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Room logo/avatar URL (community & rooms without a social group)",
    )
    # Stable key: community:global, responder:{org_id}, dm:{min}:{max}, group:{group_id}
    room_key = models.CharField(max_length=120, unique=True, db_index=True)
    responder_org = models.ForeignKey(
        "ResponderOrganization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat_rooms",
    )
    social_group = models.ForeignKey(
        "SocialGroup",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat_rooms",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_conversations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["conversation_type", "updated_at"]),
        ]

    def __str__(self):
        return f"{self.conversation_type}:{self.room_key}"


class ConversationMember(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    last_read_message_id = models.PositiveIntegerField(null=True, blank=True)
    muted = models.BooleanField(default=False)

    class Meta:
        unique_together = ("conversation", "user")
        indexes = [
            models.Index(fields=["user", "joined_at"]),
        ]

    def __str__(self):
        return f"user {self.user_id} in conv {self.conversation_id}"


class ChatMessage(models.Model):
    MEDIA_TYPE_CHOICES = [
        ("image", "Image"),
        ("video", "Video"),
        ("audio", "Audio"),
        ("file", "File"),
    ]

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    body = models.TextField(blank=True, default="")
    media_url = models.TextField(blank=True, default="")
    media_type = models.CharField(
        max_length=16, choices=MEDIA_TYPE_CHOICES, blank=True, default=""
    )
    mentions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    client_id = models.CharField(max_length=64, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"]),
            models.Index(fields=["sender", "created_at"]),
        ]

    def __str__(self):
        return f"msg {self.id} in {self.conversation_id}"


class UserChatPresence(models.Model):
    """Persisted last-seen; online state is primarily from Channels."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_presence",
    )
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now=True)
    connection_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["is_online", "last_seen"]),
        ]

    def __str__(self):
        return f"presence {self.user_id} online={self.is_online}"
