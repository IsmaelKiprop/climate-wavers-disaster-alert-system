from django.shortcuts import render
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import (
    UserRegisterSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer,
    SetNewPasswordSerializer,
    LogoutUserSerializer,
)
from .models import OneTimePassword, User
from rest_framework.permissions import IsAuthenticated
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import smart_str, DjangoUnicodeDecodeError
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from rest_framework import generics, permissions
from core.serializers import UserSerializer
from .tasks import send_activation_email


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class RegisterUserView(GenericAPIView):
    serializer_class = UserRegisterSerializer

    def post(self, request):
        user_data = request.data
        serializer = self.serializer_class(data=user_data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            user = serializer.data
            if user.get("auth_provider") == "email":
                try:
                    send_activation_email(user["email"])
                    message = f"Hi {user['first_name']}, thank you for signing up. A passcode has been sent to your email."
                except Exception as e:
                    print(f"Email sending failed: {e}")
                    message = f"Hi {user['first_name']}, thank you for signing up. Please check your email for verification."
            else:
                message = f"Hi {user['first_name']}, thank you for signing up."
            return Response(
                {
                    "data": user,
                    "message": message,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyUserEmail(GenericAPIView):
    def post(self, request):
        otp_code = request.data.get("otp")
        email = request.data.get("email")

        try:
            user_code_obj = (
                OneTimePassword.objects.filter(user__email=email).order_by("-id").first()
            )
            if not user_code_obj:
                raise OneTimePassword.DoesNotExist
            decrypted_code = user_code_obj.decrypt_code(user_code_obj.code)

            if decrypted_code == otp_code:
                user = user_code_obj.user
                if not user.is_verified:
                    user.is_verified = True
                    user.save()
                    return Response(
                        {"message": "Account email verified successfully."},
                        status=status.HTTP_200_OK,
                    )
                return Response(
                    {"message": "User already verified."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"message": "Invalid passcode."}, status=status.HTTP_400_BAD_REQUEST
            )
        except OneTimePassword.DoesNotExist:
            return Response(
                {"message": "No OTP found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )


class ResendVerificationView(GenericAPIView):
    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {"email": ["Enter your email."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"message": "If that email has an account, we sent a new code."},
                status=status.HTTP_200_OK,
            )
        if user.is_verified:
            return Response(
                {"message": "This email is already verified. Sign in."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            send_activation_email(user.email)
        except Exception as exc:
            print(f"Resend verification failed: {exc}")
            return Response(
                {"message": "Could not send the code. Try again in a moment."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {"message": "A new 6-digit code was sent to your email."},
            status=status.HTTP_200_OK,
        )


class LoginUserView(GenericAPIView):
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TestCaseView(GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = {"msg": "It works"}
        return Response(data, status=status.HTTP_200_OK)


class PasswordResetRequestView(GenericAPIView):
    serializer_class = PasswordResetRequestSerializer

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(
            {"message": "A link has been sent to your email to reset your password"},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirm(GenericAPIView):
    def get(self, request, uidb64, token):
        try:
            user_id = smart_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(id=user_id)
            if not PasswordResetTokenGenerator().check_token(user, token):
                return Response(
                    {"message": "Token is invalid or has expired"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            return Response(
                {
                    "success": True,
                    "message": "Credentials are valid",
                    "uidb64": uidb64,
                    "token": token,
                },
                status=status.HTTP_200_OK,
            )
        except DjangoUnicodeDecodeError:
            return Response(
                {"message": "Token is invalid or has expired"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class SetNewPassword(GenericAPIView):
    serializer_class = SetNewPasswordSerializer

    def patch(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            {"message": "Password reset successful"}, status=status.HTTP_200_OK
        )


class LogoutUserView(GenericAPIView):
    serializer_class = LogoutUserSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
