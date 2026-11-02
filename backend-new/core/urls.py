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
    verify_payment
)
from .ai_views import generate_content, analyze_content, generate_hashtags
from .newsletter import NewsletterSubscribeView


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
    path('notifications/', NotificationListView.as_view(),
         name='notification_list'),
    path('notifications/mark-read/', MarkNotificationsAsReadView.as_view(),
         name='mark_notifications_as_read'),

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
]
