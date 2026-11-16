from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from core.models import (
    CommunityChampion,
    DeviceLocationPing,
    Disaster,
    PartnerCamera,
)
from core.public_cctv import _safe_http_url

User = get_user_model()


class ChampionsAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="champ1",
            email="champ1@example.com",
            password="testpass123",
            first_name="Champ",
            last_name="One",
            country="Kenya",
            state="Nairobi",
        )
        self.staff = User.objects.create_user(
            username="staff1",
            email="staff1@example.com",
            password="testpass123",
            first_name="Staff",
            last_name="One",
            country="Kenya",
            state="Nairobi",
            is_staff=True,
        )
        self.neighbor = User.objects.create_user(
            username="neighbor1",
            email="neighbor1@example.com",
            password="testpass123",
            first_name="Near",
            last_name="By",
            country="Kenya",
            state="Nairobi",
        )
        self.disaster = Disaster.objects.create(
            title="Test flood near river",
            description="Rising water",
            disaster_type="flood",
            severity="high",
            status="monitoring",
            country="Kenya",
            region="Nairobi",
            city="Nairobi",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            affected_area_radius=Decimal("5"),
            start_date=timezone.now(),
        )

    def test_apply_and_approve(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            "/api/v1/champions/apply/",
            {
                "display_name": "Amina",
                "city": "Nairobi",
                "latitude": -1.286389,
                "longitude": 36.817223,
                "affiliation": "Local church",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        champ_id = res.data["champion"]["id"]
        self.assertEqual(res.data["champion"]["status"], "pending")

        self.client.force_authenticate(self.staff)
        res = self.client.post(
            f"/api/v1/champions/{champ_id}/moderate/",
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["champion"]["status"], "active")

    def test_verify_confirm_requires_gps_and_updates_disaster(self):
        champ = CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="active",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=15,
        )
        self.client.force_authenticate(self.user)
        res = self.client.post(
            "/api/v1/champions/verifications/",
            {
                "disaster_id": self.disaster.id,
                "decision": "confirm",
                "note": "Water at doorstep",
                "feed_comparison": "worse",
                "latitude": -1.2865,
                "longitude": 36.8173,
                "accuracy_m": 20,
                "evidence": [{"kind": "photo", "url": "/media/x.jpg"}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertGreaterEqual(res.data["verification"]["evidence_score"], 40)
        self.disaster.refresh_from_db()
        self.assertIn(self.disaster.status, ("investigating", "alert"))
        champ.refresh_from_db()
        self.assertEqual(champ.verifications_count, 1)

    def test_verify_queue_filters_by_radius(self):
        CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="trainee",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=5,
        )
        # Far away disaster
        Disaster.objects.create(
            title="Far quake",
            description="Elsewhere",
            disaster_type="earthquake",
            severity="moderate",
            status="monitoring",
            country="Kenya",
            region="Mombasa",
            city="Mombasa",
            latitude=Decimal("-4.0435"),
            longitude=Decimal("39.6682"),
            start_date=timezone.now(),
        )
        self.client.force_authenticate(self.user)
        res = self.client.get("/api/v1/champions/verify-queue/")
        self.assertEqual(res.status_code, 200)
        ids = [r["id"] for r in res.data["results"]]
        self.assertIn(self.disaster.id, ids)

    def test_warn_nearby_targets_location_pings(self):
        CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="trusted",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=30,
        )
        DeviceLocationPing.objects.create(
            user=self.neighbor,
            latitude=Decimal("-1.2864"),
            longitude=Decimal("36.8173"),
            accuracy_m=15,
            proximity_alerts_opt_in=True,
        )
        self.client.force_authenticate(self.user)
        preview = self.client.get(
            f"/api/v1/champions/warn-nearby/preview/?disaster_id={self.disaster.id}&radius_m=2000"
        )
        self.assertEqual(preview.status_code, 200)
        self.assertGreaterEqual(preview.data["count"], 1)

        res = self.client.post(
            "/api/v1/champions/warn-nearby/",
            {
                "disaster_id": self.disaster.id,
                "radius_m": 2000,
                "message_template": "Hazard nearby — move to safety now",
                "note": "North bank",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertGreaterEqual(res.data["delivered_count"], 1)

    def test_partner_camera_register_and_record(self):
        CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="active",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=15,
        )
        self.client.force_authenticate(self.user)
        res = self.client.post(
            "/api/v1/champions/cameras/",
            {
                "name": "School gate cam",
                "latitude": -1.286389,
                "longitude": 36.817223,
                "stream_type": "hls",
                "stream_url": "https://example.com/live.m3u8",
                "consent_note": "School board approved",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        cam = PartnerCamera.objects.get(id=res.data["id"])
        cam.status = "active"
        cam.save(update_fields=["status"])

        rec = self.client.post(
            f"/api/v1/champions/cameras/{cam.id}/record-moment/",
            {"disaster_id": self.disaster.id, "duration_s": 30, "snapshot": True},
            format="json",
        )
        self.assertEqual(rec.status_code, 201)
        self.assertEqual(rec.data["sync_status"], "synced")

    def test_training_alx_path_quiz_and_certificate(self):
        from core.champion_curriculum import CURRICULUM

        champ = CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="trainee",
            display_name="Amina",
            city="Nairobi",
            country="Kenya",
        )
        self.client.force_authenticate(self.user)

        path = self.client.get("/api/v1/champions/training/")
        self.assertEqual(path.status_code, 200)
        self.assertEqual(path.data["style"], "alx_path")
        self.assertEqual(path.data["total"], len(CURRICULUM))
        self.assertFalse(path.data["modules"][0]["locked"])
        self.assertTrue(path.data["modules"][1]["locked"])

        locked = self.client.get(
            "/api/v1/champions/training/location_proof/"
        )
        self.assertEqual(locked.status_code, 403)

        lesson = self.client.get("/api/v1/champions/training/ground_rules/")
        self.assertEqual(lesson.status_code, 200)
        self.assertGreaterEqual(len(lesson.data["quiz"]), 3)
        # answers must not leak in lesson payload
        self.assertNotIn("answer", lesson.data["quiz"][0])

        fail = self.client.post(
            "/api/v1/champions/training/ground_rules/quiz/",
            {"answers": {"q1": 0, "q2": 0, "q3": 0}},
            format="json",
        )
        self.assertEqual(fail.status_code, 200)
        self.assertFalse(fail.data["result"]["passed"])
        self.assertFalse(fail.data["module_completed"])

        for mod in CURRICULUM:
            answers = {q["id"]: q["answer"] for q in mod["quiz"]}
            res = self.client.post(
                f"/api/v1/champions/training/{mod['id']}/quiz/",
                {"answers": answers},
                format="json",
            )
            self.assertEqual(res.status_code, 200, mod["id"])
            self.assertTrue(res.data["result"]["passed"], mod["id"])
            self.assertTrue(res.data["module_completed"], mod["id"])

        self.assertTrue(res.data["path_complete"])
        self.assertTrue(res.data["certificate_issued"])
        self.assertTrue(res.data["certificate"]["certificate_code"])

        champ.refresh_from_db()
        self.assertTrue(champ.certificate_code)
        self.assertIsNotNone(champ.trained_at)
        self.assertEqual(champ.tier, "active")

        mine = self.client.get("/api/v1/champions/certificate/")
        self.assertEqual(mine.status_code, 200)
        code = mine.data["certificate"]["certificate_code"]

        # Public verify (no auth)
        self.client.force_authenticate(user=None)
        verify = self.client.get(f"/api/v1/champions/certificate/verify/{code}/")
        self.assertEqual(verify.status_code, 200)
        self.assertTrue(verify.data["certificate"]["valid"])
        self.assertEqual(verify.data["certificate"]["holder_name"], "Amina")

        missing = self.client.get(
            "/api/v1/champions/certificate/verify/CW-CHAMP-NOT-REAL/"
        )
        self.assertEqual(missing.status_code, 404)
        self.assertFalse(missing.data["valid"])

    def test_directory_public(self):
        CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="active",
            display_name="Amina",
            city="Nairobi",
            country="Kenya",
        )
        res = self.client.get("/api/v1/champions/directory/")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.data["count"], 1)

    def test_rating_and_impact(self):
        champ = CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="active",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=15,
        )
        self.client.force_authenticate(self.neighbor)
        res = self.client.post(
            f"/api/v1/champions/{champ.id}/ratings/",
            {"score": 5, "comment": "Helped our street"},
            format="json",
        )
        self.assertIn(res.status_code, (200, 201), res.data)
        self.assertEqual(res.data["rating"]["score"], 5)
        self.assertGreaterEqual(res.data["rating_count"], 1)
        self.assertGreaterEqual(res.data["impact_score"], 0)

        # Cannot self-rate
        self.client.force_authenticate(self.user)
        bad = self.client.post(
            f"/api/v1/champions/{champ.id}/ratings/",
            {"score": 5},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)

        impact = self.client.get(f"/api/v1/champions/{champ.id}/impact/")
        self.assertEqual(impact.status_code, 200)
        self.assertIn("impact", impact.data)

    def test_public_url_safety(self):
        self.assertTrue(_safe_http_url("https://example.com/cam.jpg").startswith("https://"))
        self.assertEqual(_safe_http_url("rtsp://192.168.1.5/stream"), "")
        self.assertEqual(_safe_http_url("http://user:pass@host/cam"), "")

    @patch("core.public_cctv.fetch_public_webcams")
    def test_nearby_cameras_public_fallback(self, mock_public):
        CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="active",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=15,
        )
        mock_public.return_value = [
            {
                "id": "public-osm-node-99",
                "public": True,
                "source": "openstreetmap",
                "name": "City square webcam",
                "latitude": -1.2864,
                "longitude": 36.8173,
                "coverage_radius_m": 150,
                "stream_type": "mjpeg",
                "status": "active",
                "distance_km": 0.1,
                "has_stream": True,
                "preview_url": "https://example.com/cam.jpg",
                "stream_url": "https://example.com/cam.jpg",
                "note": "Public OSM",
            }
        ]
        self.client.force_authenticate(self.user)
        res = self.client.get(
            f"/api/v1/champions/cameras/nearby/?disaster_id={self.disaster.id}&include_public=1"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["partner_count"], 0)
        self.assertEqual(res.data["public_count"], 1)
        self.assertTrue(res.data["public_fallback"])
        self.assertEqual(res.data["results"][0]["id"], "public-osm-node-99")

    def test_stale_location_excluded_from_warn(self):
        CommunityChampion.objects.create(
            user=self.user,
            status="active",
            tier="trusted",
            display_name="Amina",
            latitude=Decimal("-1.286389"),
            longitude=Decimal("36.817223"),
            radius_km=30,
        )
        ping = DeviceLocationPing.objects.create(
            user=self.neighbor,
            latitude=Decimal("-1.2864"),
            longitude=Decimal("36.8173"),
            proximity_alerts_opt_in=True,
        )
        DeviceLocationPing.objects.filter(id=ping.id).update(
            updated_at=timezone.now() - timedelta(hours=5)
        )
        self.client.force_authenticate(self.user)
        preview = self.client.get(
            f"/api/v1/champions/warn-nearby/preview/?disaster_id={self.disaster.id}&radius_m=2000"
        )
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["count"], 0)
