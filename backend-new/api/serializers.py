from rest_framework import serializers, status
from .models import User
from django.contrib.auth import authenticate
from rest_framework.exceptions import AuthenticationFailed, APIException
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import smart_str, smart_bytes
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.conf import settings
from .tasks import send_reset_password_email, send_onboarding_email


class MailDeliveryFailed(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Could not send the reset email right now. Wait a moment and try again."
    default_code = "mail_delivery_failed"


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        max_length=68, min_length=6, write_only=True)
    password2 = serializers.CharField(
        max_length=68, min_length=6, write_only=True)
    profile_pic = serializers.ImageField(required=False)
    picture = serializers.CharField(required=False)

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "country",
            "state",
            "gender",
            "password",
            "password2",
            "profile_pic",
            "profession",
            "cover",
            "picture",
            "default_avatar",
            "auth_provider"
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )

        if attrs.get("profile_pic") and attrs.get("default_avatar"):
            raise serializers.ValidationError(
                "Please provide either a profile picture or an avatar, not both."
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")

        if not validated_data.get("profile_pic"):
            if validated_data.get("gender") == "male":
                validated_data["default_avatar"] = User.AVATAR_CHOICES[0][0]
            else:
                validated_data["default_avatar"] = User.AVATAR_CHOICES[1][0]

        else:
            validated_data["default_avatar"] = None

        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(max_length=255, min_length=6)
    password = serializers.CharField(max_length=68, write_only=True)
    full_name = serializers.CharField(max_length=255, read_only=True)
    access_token = serializers.CharField(max_length=255, read_only=True)
    refresh_token = serializers.CharField(max_length=255, read_only=True)
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["email", "password", "id", "full_name",
                  "username", "access_token", "refresh_token"]

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        request = self.context.get("request")
        user = authenticate(request, email=email, password=password)
        if not user:
            raise AuthenticationFailed("Invalid credentials, try again")
        if not user.is_verified:
            raise AuthenticationFailed("Email is not verified")

        organizer_emails = {"hello@flowops.africa", "flowopsafrica@gmail.com"}
        if (user.email or "").lower() in organizer_emails and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        if not user.is_onboarded:
            user.is_onboarded = True
            send_onboarding_email(user.email)
            user.save(update_fields=['is_onboarded'])


        user_tokens = user.tokens()

        return {
            "email": user.email,
            "full_name": user.get_full_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "access_token": str(user_tokens.get("access")),
            "refresh_token": str(user_tokens.get("refresh")),
            "id": user.id,
            "username": user.username,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_admin": bool(user.is_staff or user.is_superuser),
            "profile_pic": user.profile_pic,
            "profile_picture": user.profile_picture,
            "picture": user.picture,
        }


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=255)

    def validate(self, attrs):
        email = str(attrs.get("email") or "").strip().lower()
        attrs["email"] = email
        user = User.objects.filter(email__iexact=email).first()
        if user:
            uidb64 = urlsafe_base64_encode(smart_bytes(user.id))
            token = PasswordResetTokenGenerator().make_token(user)
            frontend = str(settings.FRONTEND_URL or "https://climate-wavers-three.vercel.app").rstrip("/")
            if "," in frontend or ";" in frontend:
                candidates = [
                    part.strip().rstrip("/")
                    for part in frontend.replace(";", ",").split(",")
                    if part.strip()
                ]
                public = [
                    part
                    for part in candidates
                    if part.startswith("https://")
                    and "localhost" not in part
                    and "127.0.0.1" not in part
                ]
                frontend = (public or candidates or [frontend])[0]
            reset_url = f"{frontend}/verifypasswordreset/{uidb64}/{token}"
            data = {
                "url": reset_url,
                "email": user.email,
            }
            try:
                send_reset_password_email(data)
            except Exception as exc:
                raise MailDeliveryFailed() from exc
        return super().validate(attrs)


class SetNewPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(
        max_length=100, min_length=6, write_only=True)
    confirm_password = serializers.CharField(
        max_length=100, min_length=6, write_only=True
    )
    uidb64 = serializers.CharField(write_only=True)
    token = serializers.CharField(write_only=True)

    class Meta:
        fields = ["password", "confirm_password", "uidb64", "token"]

    def validate(self, attrs):
        try:
            token = attrs.get("token")
            uidb64 = attrs.get("uidb64")
            password = attrs.get("password")
            confirm_password = attrs.get("confirm_password")

            user_id = smart_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(id=user_id)
            if not PasswordResetTokenGenerator().check_token(user, token):
                raise AuthenticationFailed(
                    "Reset link is invalid or has expired", 401)
            if password != confirm_password:
                raise AuthenticationFailed("Passwords do not match")
            user.set_password(password)
            user.save()
            return user
        except Exception as e:
            raise AuthenticationFailed(f"Failed to reset password: {e}")


class LogoutUserSerializer(serializers.Serializer):
    refresh_token = serializers.CharField()

    default_error_messages = {"bad_token": "Token is invalid or has expired"}

    def validate(self, attrs):
        self.token = attrs.get("refresh_token")
        return attrs  # Make sure to return attrs after validation

    def save(self, **kwargs):
        try:
            token = RefreshToken(self.token)
            token.blacklist()
        except TokenError:
            self.fail("bad_token")
