from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from core.models import (
    CommunityChampion,
    Disaster,
    Post,
    TreeAdminOrganization,
)

User = get_user_model()


class PlatformAdminAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="member1",
            email="member1@example.com",
            password="testpass123",
            first_name="Mem",
            last_name="Ber",
            country="Kenya",
            state="Nairobi",
        )
        self.staff = User.objects.create_user(
            username="staffadmin",
            email="staffadmin@example.com",
            password="testpass123",
            first_name="Staff",
            last_name="Admin",
            country="Kenya",
            state="Nairobi",
            is_staff=True,
            is_verified=True,
        )

    def test_non_staff_forbidden(self):
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/v1/platform-admin/me/")
        self.assertEqual(res.status_code, 403)

    def test_me_and_overview(self):
        self.client.force_authenticate(self.staff)
        me = self.client.get("/api/v1/platform-admin/me/")
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.data["is_platform_admin"])
        self.assertIn("counts", me.data)
        self.assertIn("pending_champions", me.data["counts"])

        overview = self.client.get("/api/v1/platform-admin/overview/")
        self.assertEqual(overview.status_code, 200)
        self.assertIn("kpis", overview.data)
        self.assertIn("users_total", overview.data["kpis"])

    def test_list_users_champions_disasters(self):
        CommunityChampion.objects.create(
            user=self.user,
            status="pending",
            tier="trainee",
            display_name="Amina",
        )
        Disaster.objects.create(
            title="Flood test",
            description="Rising water",
            disaster_type="flood",
            severity="high",
            status="monitoring",
            country="Kenya",
            region="Nairobi",
            city="Nairobi",
            start_date=timezone.now(),
        )
        self.client.force_authenticate(self.staff)
        users = self.client.get("/api/v1/platform-admin/users/")
        self.assertEqual(users.status_code, 200)
        self.assertGreaterEqual(users.data["count"], 2)

        champs = self.client.get("/api/v1/platform-admin/champions/?status=pending")
        self.assertEqual(champs.status_code, 200)
        self.assertGreaterEqual(champs.data["count"], 1)

        disasters = self.client.get("/api/v1/platform-admin/disasters/")
        self.assertEqual(disasters.status_code, 200)
        self.assertGreaterEqual(disasters.data["count"], 1)

    def test_moderate_champion_and_donation_post(self):
        champ = CommunityChampion.objects.create(
            user=self.user,
            status="pending",
            tier="trainee",
            display_name="Amina",
        )
        post = Post.objects.create(
            user=self.user,
            content="Please donate #flood",
            is_donation=True,
            donation_approved=False,
        )
        self.client.force_authenticate(self.staff)
        approve = self.client.post(
            f"/api/v1/platform-admin/champions/{champ.id}/moderate/",
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(approve.status_code, 200)
        self.assertEqual(approve.data["champion"]["status"], "active")

        post_mod = self.client.post(
            f"/api/v1/platform-admin/posts/{post.id}/moderate/",
            {"action": "approve_donation"},
            format="json",
        )
        self.assertEqual(post_mod.status_code, 200)
        self.assertTrue(post_mod.data["post"]["donation_approved"])

    def test_moderate_tree_admin_org(self):
        org = TreeAdminOrganization.objects.create(
            name="Green Nursery",
            org_type="nursery",
            city="Nairobi",
            country="Kenya",
            contact_email="green@example.com",
            verification_status="pending",
            created_by=self.user,
        )
        self.client.force_authenticate(self.staff)
        res = self.client.post(
            f"/api/v1/platform-admin/tree-admin-orgs/{org.id}/moderate/",
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["org"]["verification_status"], "approved")

    def test_invite_and_accept_admin(self):
        self.client.force_authenticate(self.staff)
        invite = self.client.post(
            "/api/v1/platform-admin/invites/",
            {"email": self.user.email, "note": "Ops help"},
            format="json",
        )
        self.assertEqual(invite.status_code, 201)
        token = invite.data["invite"]["accept_path"].split("token=")[-1]
        self.assertTrue(token)

        # Wrong account cannot accept
        self.client.force_authenticate(self.staff)
        wrong = self.client.post(
            "/api/v1/platform-admin/invites/accept/",
            {"token": token},
            format="json",
        )
        self.assertEqual(wrong.status_code, 403)

        self.client.force_authenticate(self.user)
        ok = self.client.post(
            "/api/v1/platform-admin/invites/accept/",
            {"token": token},
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)

    def test_grant_now_existing_user(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(
            "/api/v1/platform-admin/invites/",
            {"email": self.user.email, "grant_now": True},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.data["granted"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)
