from django.contrib import admin
from django.utils import timezone
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
    NewsletterSubscriber,
    UserAlertPreference,
    EmergencyAgency,
    OfficialAlertEvent,
    ResponderOrganization,
    ResponderMembership,
    ResponderDispatch,
    TreeAdminOrganization,
    TreeAdminMembership,
)
from unfold.admin import ModelAdmin

class PostAdmin(ModelAdmin):
    list_display = ['content', 'user', 'is_donation', 'donation_approved']
    actions = ['approve_donations']

    def approve_donations(self, request, queryset):
        queryset.update(donation_approved=True)
    approve_donations.short_description = "Approve selected donation posts"

admin.site.register(Post, PostAdmin)

class PollAdmin(ModelAdmin):
    list_display = ('question', 'user', 'created_at', 'updated_at', 'visibility', 'duration')
    list_filter = ('visibility', 'created_at', 'updated_at')
    search_fields = ('question', 'user__username')
    ordering = ('-created_at',)

admin.site.register(Poll, PollAdmin)

class PollVoteAdmin(ModelAdmin):
    list_display = ('user', 'poll', 'option', 'created_at')
    list_filter = ('poll', 'created_at')
    search_fields = ('user__username', 'poll__question')
    ordering = ('-created_at',)

admin.site.register(PollVote, PollVoteAdmin)

# Register models with default configuration
class CommentAdmin(ModelAdmin):
    list_display = ('user', 'content', 'post', "parent_comment", 'image')
    
admin.site.register(Comment, CommentAdmin)

admin.site.register(Reaction)
admin.site.register(Repost)
admin.site.register(View)
admin.site.register(Follow)
admin.site.register(Bookmark)
admin.site.register(Notification)

class NewsletterSubscriberAdmin(ModelAdmin):
    list_display = ("email", "source", "is_active", "created_at")
    list_filter = ("is_active", "source")
    search_fields = ("email",)
    ordering = ("-created_at",)

admin.site.register(NewsletterSubscriber, NewsletterSubscriberAdmin)


@admin.register(UserAlertPreference)
class UserAlertPreferenceAdmin(ModelAdmin):
    list_display = (
        "user",
        "email_alerts",
        "whatsapp_alerts",
        "radius_km",
        "phone_verified",
        "updated_at",
    )
    list_filter = ("email_alerts", "whatsapp_alerts", "phone_verified")
    search_fields = ("user__email", "phone")


@admin.register(EmergencyAgency)
class EmergencyAgencyAdmin(ModelAdmin):
    list_display = (
        "name",
        "agency_type",
        "city",
        "country",
        "phone",
        "whatsapp_opt_in",
        "is_active",
    )
    list_filter = ("agency_type", "country", "is_active", "whatsapp_opt_in")
    search_fields = ("name", "city", "phone", "email")


@admin.register(OfficialAlertEvent)
class OfficialAlertEventAdmin(ModelAdmin):
    list_display = ("event_id", "source", "title", "disaster_type", "created_at")
    list_filter = ("source", "disaster_type")
    search_fields = ("event_id", "title")


@admin.register(ResponderOrganization)
class ResponderOrganizationAdmin(ModelAdmin):
    list_display = (
        "name",
        "org_type",
        "city",
        "country",
        "verification_status",
        "plan",
        "plan_status",
        "plan_ends_at",
        "contact_email",
        "whatsapp_opt_in",
        "created_at",
    )
    list_filter = (
        "verification_status",
        "plan",
        "plan_status",
        "org_type",
        "country",
        "whatsapp_opt_in",
    )
    search_fields = ("name", "city", "contact_email", "contact_phone")
    actions = [
        "approve_organizations",
        "reject_organizations",
        "activate_paid_plans",
    ]

    @admin.action(description="Approve + start 90-day RapidBrief pilot")
    def approve_organizations(self, request, queryset):
        from .pricing import start_pilot

        for org in queryset:
            org.verification_status = "approved"
            org.verified_at = timezone.now()
            start_pilot(org)
            org.save()

    @admin.action(description="Reject selected responder organizations")
    def reject_organizations(self, request, queryset):
        queryset.update(
            verification_status="rejected",
            verified_at=None,
            plan_status="pending",
        )

    @admin.action(description="Mark plan active (paid / 30 days)")
    def activate_paid_plans(self, request, queryset):
        from .pricing import activate_paid_plan

        for org in queryset.filter(verification_status="approved"):
            activate_paid_plan(org)
            org.save()


@admin.register(ResponderMembership)
class ResponderMembershipAdmin(ModelAdmin):
    list_display = ("org", "user", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("org__name", "user__email", "user__username")


@admin.register(TreeAdminOrganization)
class TreeAdminOrganizationAdmin(ModelAdmin):
    list_display = (
        "name",
        "org_type",
        "city",
        "country",
        "verification_status",
        "plan",
        "plan_status",
        "plan_ends_at",
        "contact_email",
        "created_at",
    )
    list_filter = (
        "verification_status",
        "plan",
        "plan_status",
        "org_type",
        "country",
    )
    search_fields = ("name", "city", "contact_email", "contact_phone")
    actions = [
        "approve_tree_admins",
        "reject_tree_admins",
        "activate_paid_plans",
    ]

    @admin.action(description="Approve + start 90-day Tree Admin pilot + grant staff")
    def approve_tree_admins(self, request, queryset):
        from .tree_pricing import start_tree_pilot

        for org in queryset:
            org.verification_status = "approved"
            org.verified_at = timezone.now()
            start_tree_pilot(org)
            org.save()
            owners = org.memberships.filter(role="owner").select_related("user")
            for membership in owners:
                user = membership.user
                if not user:
                    continue
                user.is_staff = True
                user.is_verified = True
                user.is_active = True
                user.save(update_fields=["is_staff", "is_verified", "is_active"])

    @admin.action(description="Reject selected Tree Admin organizations")
    def reject_tree_admins(self, request, queryset):
        queryset.update(
            verification_status="rejected",
            verified_at=None,
            plan_status="pending",
        )

    @admin.action(description="Mark Tree Admin plan active (paid / 30 days)")
    def activate_paid_plans(self, request, queryset):
        from .tree_pricing import activate_paid_plan

        for org in queryset.filter(verification_status="approved"):
            activate_paid_plan(org)
            org.save()


@admin.register(TreeAdminMembership)
class TreeAdminMembershipAdmin(ModelAdmin):
    list_display = ("org", "user", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("org__name", "user__email", "user__username")


@admin.register(ResponderDispatch)
class ResponderDispatchAdmin(ModelAdmin):
    list_display = (
        "event_key",
        "org",
        "disaster_type",
        "place",
        "status",
        "is_official",
        "created_at",
    )
    list_filter = ("status", "is_official", "disaster_type")
    search_fields = ("event_key", "place", "org__name")


