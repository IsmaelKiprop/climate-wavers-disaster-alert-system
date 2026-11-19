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
    TreeAdminEnsureView,
    TreeAdminMeView,
    TreeAdminDonationsView,
    TreeAdminDonationProofView,
)
from .tree_certificate import TreeCertificateVerifyView
from .plastic import (
    PlasticProjectListCreateView,
    PlasticProjectDetailView,
    PlasticHotspotCreateView,
    PlasticHotspotClaimView,
    PlasticRecoveryCreateView,
    PlasticRecoveryVerifyView,
    PlasticIntakeScanView,
    PlasticBagLookupView,
    PlasticRecyclerListCreateView,
    PlasticRecyclerInviteView,
    PlasticRecyclerInviteRevokeView,
    PlasticRecyclerInviteDetailView,
    PlasticRecyclerInviteAcceptView,
    PlasticRecyclerMeView,
    PlasticCertificateVerifyView,
    PlasticFloodHotspotsView,
    PlasticSponsorCheckoutView,
    PlasticAdminQueueView,
)
from .fx import UsdKesRateView
from .groups import (
    SocialGroupListCreateView,
    SocialGroupDetailView,
    SocialGroupJoinView,
    SocialGroupLeaveView,
)
from .profile_share import public_profile
from .og_image import profile_og_image
from .chat import (
    ChatBootstrapView,
    ChatDirectMessageView,
    ChatMessageListCreateView,
    ChatConversationMembersView,
    ChatMarkReadView,
    ChatPresenceView,
    ChatDirectoryView,
)
from .climate_events import ClimateEventViewSet
from .calendar_observances import CalendarObservanceViewSet
from .champions import (
    ChampionApplyView,
    ChampionMeView,
    ChampionCheckInView,
    ChampionDirectoryView,
    ChampionApproveView,
    ChampionVerifyQueueView,
    ChampionVerificationCreateView,
    ChampionLiveCamView,
    ChampionEnrollmentListCreateView,
    ChampionTrainingView,
    ChampionTrainingModuleView,
    ChampionTrainingQuizView,
    ChampionCertificateView,
    ChampionCertificateVerifyView,
    ChampionImpactView,
    ChampionRatingListCreateView,
    PartnerCameraNearbyView,
    PartnerCameraRegisterView,
    PartnerCameraPlaybackTokenView,
    PartnerCameraRecordMomentView,
    DevicePushTokenView,
    DeviceLocationPingView,
    WarnNearbyPreviewView,
    WarnNearbyCreateView,
    WarnNearbyAckView,
    WarnNearbyDetailView,
)
from .platform_admin import (
    PlatformAdminMeView,
    PlatformAdminOverviewView,
    PlatformAdminUsersView,
    PlatformAdminUserDetailView,
    PlatformAdminUserModerateView,
    PlatformAdminPostsView,
    PlatformAdminPostModerateView,
    PlatformAdminCommentsView,
    PlatformAdminCommentModerateView,
    PlatformAdminDisastersView,
    PlatformAdminDisasterDetailView,
    PlatformAdminDisasterAlertView,
    PlatformAdminTreeProjectsView,
    PlatformAdminTreeProjectVerifyView,
    PlatformAdminTreeDonationsView,
    PlatformAdminTreeDonationCertificateView,
    PlatformAdminTreeDonationPayoutView,
    PlatformAdminTreeOrgsView,
    PlatformAdminTreeOrgModerateView,
    PlatformAdminResponderPaymentsView,
    PlatformAdminChampionsView,
    PlatformAdminChampionModerateView,
    PlatformAdminCamerasView,
    PlatformAdminCameraActivateView,
    PlatformAdminRespondersView,
    PlatformAdminResponderModerateView,
    PlatformAdminEventsView,
    PlatformAdminEventStatusView,
    PlatformAdminObservancesView,
    PlatformAdminOutreachView,
    PlatformAdminNewsletterView,
    PlatformAdminInvitesView,
    PlatformAdminInviteRevokeView,
    PlatformAdminInviteAcceptView,
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
router.register(r'climate-events', ClimateEventViewSet, basename='climate-events')
router.register(
    r'calendar-observances',
    CalendarObservanceViewSet,
    basename='calendar-observances',
)

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
    # Plastic Pulse
    path("plastic/projects/", PlasticProjectListCreateView.as_view(), name="plastic-projects"),
    path(
        "plastic/projects/<int:project_id>/",
        PlasticProjectDetailView.as_view(),
        name="plastic-project-detail",
    ),
    path(
        "plastic/projects/<int:project_id>/hotspots/",
        PlasticHotspotCreateView.as_view(),
        name="plastic-hotspots-create",
    ),
    path(
        "plastic/projects/<int:project_id>/sponsor/",
        PlasticSponsorCheckoutView.as_view(),
        name="plastic-sponsor",
    ),
    path(
        "plastic/hotspots/<int:hotspot_id>/claim/",
        PlasticHotspotClaimView.as_view(),
        name="plastic-hotspot-claim",
    ),
    path("plastic/recoveries/", PlasticRecoveryCreateView.as_view(), name="plastic-recoveries"),
    path(
        "plastic/recoveries/<int:recovery_id>/verify/",
        PlasticRecoveryVerifyView.as_view(),
        name="plastic-recovery-verify",
    ),
    path("plastic/intake/scan/", PlasticIntakeScanView.as_view(), name="plastic-intake-scan"),
    path(
        "plastic/bags/<str:bag_id>/",
        PlasticBagLookupView.as_view(),
        name="plastic-bag-lookup",
    ),
    path(
        "plastic/bags/",
        PlasticBagLookupView.as_view(),
        name="plastic-bag-lookup-query",
    ),
    path("plastic/recyclers/", PlasticRecyclerListCreateView.as_view(), name="plastic-recyclers"),
    path(
        "plastic/recyclers/<int:recycler_id>/invite/",
        PlasticRecyclerInviteView.as_view(),
        name="plastic-recycler-invite",
    ),
    path(
        "plastic/recyclers/<int:recycler_id>/invite/revoke/",
        PlasticRecyclerInviteRevokeView.as_view(),
        name="plastic-recycler-invite-revoke",
    ),
    path(
        "plastic/recycler-invites/<str:token>/",
        PlasticRecyclerInviteDetailView.as_view(),
        name="plastic-recycler-invite-detail",
    ),
    path(
        "plastic/recycler-invites/<str:token>/accept/",
        PlasticRecyclerInviteAcceptView.as_view(),
        name="plastic-recycler-invite-accept",
    ),
    path("plastic/recycler/me/", PlasticRecyclerMeView.as_view(), name="plastic-recycler-me"),
    path(
        "plastic/certificates/<str:code>/",
        PlasticCertificateVerifyView.as_view(),
        name="plastic-certificate-verify",
    ),
    path(
        "plastic/certificates/",
        PlasticCertificateVerifyView.as_view(),
        name="plastic-certificate-verify-query",
    ),
    path("plastic/flood-hotspots/", PlasticFloodHotspotsView.as_view(), name="plastic-flood-hotspots"),
    path("plastic/admin/queue/", PlasticAdminQueueView.as_view(), name="plastic-admin-queue"),

    path("tree-admin/apply/", TreeAdminApplyView.as_view(), name="tree-admin-apply"),
    path(
        "tree-admin/apply-public/",
        TreeAdminPublicApplyView.as_view(),
        name="tree-admin-apply-public",
    ),
    path(
        "tree-admin/ensure/",
        TreeAdminEnsureView.as_view(),
        name="tree-admin-ensure",
    ),
    path("tree-admin/me/", TreeAdminMeView.as_view(), name="tree-admin-me"),
    path(
        "tree-admin/donations/",
        TreeAdminDonationsView.as_view(),
        name="tree-admin-donations",
    ),
    path(
        "tree-admin/donations/<int:donation_id>/proof/",
        TreeAdminDonationProofView.as_view(),
        name="tree-admin-donation-proof",
    ),
    path("groups/", SocialGroupListCreateView.as_view(), name="social-groups"),
    path(
        "groups/<int:group_id>/",
        SocialGroupDetailView.as_view(),
        name="social-group-detail",
    ),
    path(
        "groups/<int:group_id>/join/",
        SocialGroupJoinView.as_view(),
        name="social-group-join",
    ),
    path(
        "groups/<int:group_id>/leave/",
        SocialGroupLeaveView.as_view(),
        name="social-group-leave",
    ),
    path('notifications/', NotificationListView.as_view(),
         name='notification_list'),
    path('notifications/mark-read/', MarkNotificationsAsReadView.as_view(),
         name='mark_notifications_as_read'),
    path(
        "users/<int:user_id>/public/",
        public_profile,
        name="public-profile",
    ),
    path(
        "users/<int:user_id>/og-image/",
        profile_og_image,
        name="profile-og-image",
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

    # Community Champions
    path("champions/apply/", ChampionApplyView.as_view(), name="champions-apply"),
    path("champions/me/", ChampionMeView.as_view(), name="champions-me"),
    path("champions/me/check-in/", ChampionCheckInView.as_view(), name="champions-check-in"),
    path("champions/directory/", ChampionDirectoryView.as_view(), name="champions-directory"),
    path("champions/me/impact/", ChampionImpactView.as_view(), name="champions-me-impact"),
    path(
        "champions/<int:champion_id>/impact/",
        ChampionImpactView.as_view(),
        name="champions-impact",
    ),
    path(
        "champions/<int:champion_id>/ratings/",
        ChampionRatingListCreateView.as_view(),
        name="champions-ratings",
    ),
    path(
        "champions/<int:champion_id>/moderate/",
        ChampionApproveView.as_view(),
        name="champions-moderate",
    ),
    path(
        "champions/verify-queue/",
        ChampionVerifyQueueView.as_view(),
        name="champions-verify-queue",
    ),
    path(
        "champions/verifications/",
        ChampionVerificationCreateView.as_view(),
        name="champions-verifications",
    ),
    path(
        "champions/live-cam/",
        ChampionLiveCamView.as_view(),
        name="champions-live-cam",
    ),
    path(
        "champions/verifications/<int:verification_id>/live-cam/",
        ChampionLiveCamView.as_view(),
        name="champions-verification-live-cam",
    ),
    path(
        "champions/enrollments/",
        ChampionEnrollmentListCreateView.as_view(),
        name="champions-enrollments",
    ),
    path(
        "champions/training/",
        ChampionTrainingView.as_view(),
        name="champions-training",
    ),
    path(
        "champions/training/<str:module_id>/",
        ChampionTrainingModuleView.as_view(),
        name="champions-training-module",
    ),
    path(
        "champions/training/<str:module_id>/quiz/",
        ChampionTrainingQuizView.as_view(),
        name="champions-training-quiz",
    ),
    path(
        "champions/certificate/",
        ChampionCertificateView.as_view(),
        name="champions-certificate",
    ),
    path(
        "champions/certificate/verify/",
        ChampionCertificateVerifyView.as_view(),
        name="champions-certificate-verify-query",
    ),
    path(
        "champions/certificate/verify/<str:code>/",
        ChampionCertificateVerifyView.as_view(),
        name="champions-certificate-verify",
    ),
    path("fx/usd-kes/", UsdKesRateView.as_view(), name="fx-usd-kes"),
    path(
        "trees/certificate/verify/",
        TreeCertificateVerifyView.as_view(),
        name="trees-certificate-verify-query",
    ),
    path(
        "trees/certificate/verify/<path:code>/",
        TreeCertificateVerifyView.as_view(),
        name="trees-certificate-verify",
    ),
    path(
        "champions/cameras/nearby/",
        PartnerCameraNearbyView.as_view(),
        name="champions-cameras-nearby",
    ),
    path(
        "champions/cameras/",
        PartnerCameraRegisterView.as_view(),
        name="champions-cameras-register",
    ),
    path(
        "champions/cameras/<str:camera_id>/playback-token/",
        PartnerCameraPlaybackTokenView.as_view(),
        name="champions-cameras-playback",
    ),
    path(
        "champions/cameras/<str:camera_id>/record-moment/",
        PartnerCameraRecordMomentView.as_view(),
        name="champions-cameras-record",
    ),
    path(
        "champions/devices/push-token/",
        DevicePushTokenView.as_view(),
        name="champions-push-token",
    ),
    path(
        "champions/devices/location-ping/",
        DeviceLocationPingView.as_view(),
        name="champions-location-ping",
    ),
    path(
        "champions/warn-nearby/preview/",
        WarnNearbyPreviewView.as_view(),
        name="champions-warn-preview",
    ),
    path(
        "champions/warn-nearby/",
        WarnNearbyCreateView.as_view(),
        name="champions-warn-create",
    ),
    path(
        "champions/warn-nearby/<int:blast_id>/ack/",
        WarnNearbyAckView.as_view(),
        name="champions-warn-ack",
    ),
    path(
        "champions/warn-nearby/<int:blast_id>/",
        WarnNearbyDetailView.as_view(),
        name="champions-warn-detail",
    ),

    # Platform Admin (staff only)
    path("platform-admin/me/", PlatformAdminMeView.as_view(), name="platform-admin-me"),
    path("platform-admin/overview/", PlatformAdminOverviewView.as_view(), name="platform-admin-overview"),
    path("platform-admin/users/", PlatformAdminUsersView.as_view(), name="platform-admin-users"),
    path("platform-admin/users/<int:user_id>/", PlatformAdminUserDetailView.as_view(), name="platform-admin-user-detail"),
    path("platform-admin/users/<int:user_id>/moderate/", PlatformAdminUserModerateView.as_view(), name="platform-admin-user-moderate"),
    path("platform-admin/posts/", PlatformAdminPostsView.as_view(), name="platform-admin-posts"),
    path("platform-admin/posts/<int:post_id>/moderate/", PlatformAdminPostModerateView.as_view(), name="platform-admin-post-moderate"),
    path("platform-admin/comments/", PlatformAdminCommentsView.as_view(), name="platform-admin-comments"),
    path("platform-admin/comments/<int:comment_id>/moderate/", PlatformAdminCommentModerateView.as_view(), name="platform-admin-comment-moderate"),
    path("platform-admin/disasters/", PlatformAdminDisastersView.as_view(), name="platform-admin-disasters"),
    path("platform-admin/disasters/<int:disaster_id>/", PlatformAdminDisasterDetailView.as_view(), name="platform-admin-disaster-detail"),
    path("platform-admin/disasters/<int:disaster_id>/alerts/", PlatformAdminDisasterAlertView.as_view(), name="platform-admin-disaster-alert"),
    path("platform-admin/tree-projects/", PlatformAdminTreeProjectsView.as_view(), name="platform-admin-tree-projects"),
    path("platform-admin/tree-projects/<int:project_id>/verify/", PlatformAdminTreeProjectVerifyView.as_view(), name="platform-admin-tree-verify"),
    path("platform-admin/tree-donations/", PlatformAdminTreeDonationsView.as_view(), name="platform-admin-tree-donations"),
    path(
        "platform-admin/tree-donations/<int:donation_id>/payout/",
        PlatformAdminTreeDonationPayoutView.as_view(),
        name="platform-admin-tree-donation-payout",
    ),
    path(
        "platform-admin/tree-donations/<int:donation_id>/certificate/",
        PlatformAdminTreeDonationCertificateView.as_view(),
        name="platform-admin-tree-donation-certificate",
    ),
    path("platform-admin/tree-admin-orgs/", PlatformAdminTreeOrgsView.as_view(), name="platform-admin-tree-orgs"),
    path("platform-admin/tree-admin-orgs/<int:org_id>/moderate/", PlatformAdminTreeOrgModerateView.as_view(), name="platform-admin-tree-org-moderate"),
    path("platform-admin/responder-payments/", PlatformAdminResponderPaymentsView.as_view(), name="platform-admin-responder-payments"),
    path("platform-admin/champions/", PlatformAdminChampionsView.as_view(), name="platform-admin-champions"),
    path("platform-admin/champions/<int:champion_id>/moderate/", PlatformAdminChampionModerateView.as_view(), name="platform-admin-champion-moderate"),
    path("platform-admin/cameras/", PlatformAdminCamerasView.as_view(), name="platform-admin-cameras"),
    path("platform-admin/cameras/<int:camera_id>/activate/", PlatformAdminCameraActivateView.as_view(), name="platform-admin-camera-activate"),
    path("platform-admin/responder-orgs/", PlatformAdminRespondersView.as_view(), name="platform-admin-responders"),
    path("platform-admin/responder-orgs/<int:org_id>/moderate/", PlatformAdminResponderModerateView.as_view(), name="platform-admin-responder-moderate"),
    path("platform-admin/climate-events/", PlatformAdminEventsView.as_view(), name="platform-admin-events"),
    path("platform-admin/climate-events/<int:event_id>/", PlatformAdminEventStatusView.as_view(), name="platform-admin-event-status"),
    path("platform-admin/observances/", PlatformAdminObservancesView.as_view(), name="platform-admin-observances"),
    path("platform-admin/outreach/", PlatformAdminOutreachView.as_view(), name="platform-admin-outreach"),
    path("platform-admin/newsletter/", PlatformAdminNewsletterView.as_view(), name="platform-admin-newsletter"),
    path("platform-admin/invites/", PlatformAdminInvitesView.as_view(), name="platform-admin-invites"),
    path(
        "platform-admin/invites/accept/",
        PlatformAdminInviteAcceptView.as_view(),
        name="platform-admin-invite-accept",
    ),
    path(
        "platform-admin/invites/<int:invite_id>/revoke/",
        PlatformAdminInviteRevokeView.as_view(),
        name="platform-admin-invite-revoke",
    ),

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
        'chat/conversations/<int:conversation_id>/members/',
        ChatConversationMembersView.as_view(),
        name='chat-members',
    ),
    path(
        'chat/conversations/<int:conversation_id>/read/',
        ChatMarkReadView.as_view(),
        name='chat-mark-read',
    ),
]
