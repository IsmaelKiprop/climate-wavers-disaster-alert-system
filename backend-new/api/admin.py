from django.contrib import admin, messages
from .models import User, OneTimePassword
from unfold.admin import ModelAdmin

@admin.register(User)
class UserAdmin(ModelAdmin):
    list_display = (
        'id',
        'email', 
        'first_name', 
        'last_name', 
        'username', 
        'country', 
        'state', 
        'is_verified', 
        'is_staff', 
        'is_superuser', 
        'is_active', 
        'date_joined', 
        'last_login'
    )
    search_fields = ('email', 'username', 'first_name', 'last_name')
    list_filter = ('is_verified', 'is_staff', 'is_superuser', 'is_active', 'country', 'state')
    ordering = ('-date_joined',)
    readonly_fields = ('date_joined', 'last_login')
    actions = ("approve_as_tree_admin",)

    @admin.action(description="Approve as Tree Admin (create org if needed + start pilot)")
    def approve_as_tree_admin(self, request, queryset):
        from core.tree_admin import approve_user_as_tree_admin

        ok = 0
        for user in queryset:
            try:
                org, _membership, created = approve_user_as_tree_admin(user)
                ok += 1
                self.message_user(
                    request,
                    f"{'Created + approved' if created else 'Approved'} "
                    f"{user.email} → {org.name}",
                    messages.SUCCESS,
                )
            except Exception as exc:
                self.message_user(
                    request,
                    f"Failed for {user.email}: {exc}",
                    messages.ERROR,
                )
        if ok:
            self.message_user(
                request,
                f"Tree Admin approved for {ok} user(s). They can create projects now.",
                messages.SUCCESS,
            )

@admin.register(OneTimePassword)
class OneTimePasswordAdmin(ModelAdmin):
    list_display = ('user', 'code')
    search_fields = ('user__email', 'code')
