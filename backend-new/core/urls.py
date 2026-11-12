from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PostViewSet, PollViewSet, PollVoteViewSet, CommentViewSet,
    ReactionViewSet, RepostViewSet, ViewViewSet, FollowViewSet,
    BookmarkViewSet, UserViewSet, NotificationListView, MarkNotificationsAsReadView, 
    status_view, websocket_notifications, search_posts, search_users, 
    search_hashtags, search_trending, global_search,
    TreeProjectViewSet, TreeProjectUpdateViewSet, TreeProjectDonationViewSet,
    DisasterViewSet,
    FileUploadViewSet, verify_paystack_payment, paystack_webhook, mark_certificate_downloaded,
    verify_payment,
    wavers_points_rates, wavers_points_balance, wavers_points_ledger, wavers_points_redeem,
)
from .ai_views import generate_content, analyze_content, generate_hashtags
from .newsletter import NewsletterSubscribeView
from .alerts import fanout_disaster_alert
from .alert_preferences import (
    AlertPreferenceView,
    AlertPhoneVerifyConfirmView,
    AlertPhoneVerifyRequestView,
)
from .responder import (
    ResponderApplyView,
    ResponderPublicApplyView,
    ResponderMeView,
    ResponderOrgView,
    ResponderDispatchListView,
    ResponderDispatchDetailView,
    ResponderDispatchStatusView,
    ResponderBriefView,
    ResponderTeamView,
    ResponderTeamMemberDetailView,
    ResponderSeatInviteDetailView,
    ResponderBillingCheckoutView,
    ResponderBillingVerifyView,
)
from .tree_admin import (
    TreeAdminApplyView,
    TreeAdminPublicApplyView,
    TreeAdminMeView,
)
from .profile_share import public_profile
from .chat import (
    ChatBootstrapView,
    ChatDirectMessageView,
    ChatMessageListCreateView,
    ChatMarkReadView,
    ChatPresenceView,
    ChatDirectoryView,
)


# Initialize the default router
router = DefaultRouter()

# Register viewsets with the router
router.register(r'post', PostViewSet)
router.register(r'polls', PollViewSet)
router.register(r'poll-votes', PollVoteViewSet)
router.register(r'users', UserViewSet, basename='user')
router.register(r'comments', CommentViewSet)
router.register(r'reactions', ReactionViewSet)
router.register(r'reposts', RepostViewSet)
router.register(r'views', ViewViewSet)
router.register(r'follows', FollowViewSet)
router.register(r'bookmark', BookmarkViewSet)
router.register(r'tree-projects', TreeProjectViewSet)
router.register(r'disasters', DisasterViewSet)
router.register(r'tree-project-updates', TreeProjectUpdateViewSet)
router.register(r'tree-project-donations', TreeProjectDonationViewSet)
router.register(r'upload', FileUploadViewSet, basename='upload')

# Define urlpatterns with included router URLs and additional custom paths
urlpatterns = [
    # Include all the router URLs
    path('', include(router.urls)),
    path("status/", status_view, name='status'),
    path("newsletter/", NewsletterSubscribeView.as_view(), name="newsletter-subscribe"),
    path("alerts/fanout/", fanout_disaster_alert, name="disaster-alert-fanout"),
    path("alerts/preferences/", AlertPreferenceView.as_view(), name="alert-preferences"),
    path(
        "alerts/phone/request-code/",
        AlertPhoneVerifyRequestView.as_view(),
        name="alert-phone-request",
    ),
    path(
        "alerts/phone/confirm/",
        AlertPhoneVerifyConfirmView.as_view(),
        name="alert-phone-confirm",
    ),
    path("responder/apply/", ResponderApplyView.as_view(), name="responder-apply"),
    path(
        "responder/apply-public/",
        ResponderPublicApplyView.as_view(),
        name="responder-apply-public",
    ),
    path("responder/me/", ResponderMeView.as_view(), name="responder-me"),
    path("responder/org/", ResponderOrgView.as_view(), name="responder-org"),
    path(
        "responder/dispatches/",
        ResponderDispatchListView.as_view(),
        name="responder-dispatches",
    ),
    path(
        "responder/dispatches/<int:dispatch_id>/",
        ResponderDispatchDetailView.as_view(),
        name="responder-dispatch-detail",
    ),
    path(
        "responder/dispatches/<int:dispatch_id>/status/",
        ResponderDispatchStatusView.as_view(),
        name="responder-dispatch-status",
    ),
    path("responder/brief/", ResponderBriefView.as_view(), name="responder-brief"),
    path("responder/team/", ResponderTeamView.as_view(), name="responder-team"),
    path(
        "responder/team/members/<int:membership_id>/",
        ResponderTeamMemberDetailView.as_view(),
        name="responder-team-member",
    ),
    path(
        "responder/team/invites/<int:invite_id>/",
        ResponderSeatInviteDetailView.as_view(),
        name="responder-team-invite",
    ),
    path(
        "responder/billing/checkout/",
        ResponderBillingCheckoutView.as_view(),
        name="responder-billing-checkout",
    ),
    path(
        "responder/billing/verify/",
        ResponderBillingVerifyView.as_view(),
        name="responder-billing-verify",
    ),
    path("tree-admin/apply/", TreeAdminApplyView.as_view(), name="tree-admin-apply"),
    path(
        "tree-admin/apply-public/",
        TreeAdminPublicApplyView.as_view(),
        name="tree-admin-apply-public",
    ),
    path("tree-admin/me/", TreeAdminMeView.as_view(), name="tree-admin-me"),
    path('notifications/', NotificationListView.as_view(),
         name='notification_list'),
    path('notifications/mark-read/', MarkNotificationsAsReadView.as_view(),
         name='mark_notifications_as_read'),
    path(
        "users/<int:user_id>/public/",
        public_profile,
        name="public-profile",
    ),

    # Additional custom actions for PostViewSet
    path('search-by-hashtag/',
         PostViewSet.as_view({'get': 'search_by_hashtag'})),
    path('trending/', PostViewSet.as_view({'get': 'trending'})),
    
    # AI endpoints
    path('ai/generate-content/', generate_content, name='generate_content'),
    path('ai/analyze-content/', analyze_content, name='analyze_content'),
    path('ai/generate-hashtags/', generate_hashtags, name='generate_hashtags'),
    
    # WebSocket-like endpoint for notifications
    path('ws/notifications/', websocket_notifications, name='websocket_notifications'),
    
    # Search endpoints
    path('search/posts/', search_posts, name='search_posts'),
    path('search/users/', search_users, name='search_users'),
    path('search/hashtags/', search_hashtags, name='search_hashtags'),
    path('search/trending/', search_trending, name='search_trending'),
    path('search/', global_search, name='global_search'),
    
    # Payment verification
    path('verify-payment/', verify_paystack_payment, name='verify_payment'),
    path('verify-payment-new/', verify_payment, name='verify_payment_new'),
    
    # Paystack webhook
    path('paystack-webhook/', paystack_webhook, name='paystack_webhook'),
    
    # Certificate download tracking
    path('mark-certificate-downloaded/', mark_certificate_downloaded, name='mark_certificate_downloaded'),

    # Wavers Points loyalty
    path('points/rates/', wavers_points_rates, name='wavers-points-rates'),
    path('points/balance/', wavers_points_balance, name='wavers-points-balance'),
    path('points/ledger/', wavers_points_ledger, name='wavers-points-ledger'),
    path('points/redeem/', wavers_points_redeem, name='wavers-points-redeem'),

    # Community + responder chat
    path('chat/conversations/', ChatBootstrapView.as_view(), name='chat-conversations'),
    path('chat/dm/', ChatDirectMessageView.as_view(), name='chat-dm'),
    path('chat/directory/', ChatDirectoryView.as_view(), name='chat-directory'),
    path('chat/presence/', ChatPresenceView.as_view(), name='chat-presence'),
    path(
        'chat/conversations/<int:conversation_id>/messages/',
        ChatMessageListCreateView.as_view(),
        name='chat-messages',
    ),
    path(
        'chat/conversations/<int:conversation_id>/read/',
        ChatMarkReadView.as_view(),
        name='chat-mark-read',
    ),
]
