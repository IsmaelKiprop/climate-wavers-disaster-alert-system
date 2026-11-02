# api urls.py

from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    RegisterUserView,
    VerifyUserEmail,
    ResendVerificationView,
    LoginUserView,
    TestCaseView,
    PasswordResetConfirm,
    PasswordResetRequestView,
    SetNewPassword,
    LogoutUserView,
    UserDetailView,
)

urlpatterns = [
    path("user/", UserDetailView.as_view(), name="user-detail"),
    path("register/", RegisterUserView.as_view(), name="register"),
    path("verify-email/", VerifyUserEmail.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("login/", LoginUserView.as_view(), name="login"),
    path(
        "token/", TokenObtainPairView.as_view(), name="token_obtain_pair"
    ),  # For login and getting tokens
    path(
        "token/refresh/", TokenRefreshView.as_view(), name="token_refresh"
    ),  # For refreshing tokens
    path("profile/", TestCaseView.as_view(), name="granted"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password-reset-confirm/<uidb64>/<token>/",
        PasswordResetConfirm.as_view(),
        name="password-reset-confirm",
    ),
    path("set-new-password/", SetNewPassword.as_view(), name="set-new-password"),
    path("logout/", LogoutUserView.as_view(), name="logout"),
]
