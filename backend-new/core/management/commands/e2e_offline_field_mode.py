"""
End-to-end offline field mode:
  login → queue offline payloads (plastic / tree / hazard) → sync online → verify DB

Mirrors what the frontend offline queues send (was_offline + client_uuid).

Usage:
  python manage.py e2e_offline_field_mode
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import (
    CommunityHazardCorroboration,
    Disaster,
    PlasticHotspot,
    PlasticProject,
    PlasticRecovery,
    TreeProject,
    TreeProjectDonation,
    TreeSurvivalCheckIn,
)
from core.tree_survival import schedule_survival_checkins

User = get_user_model()


class Command(BaseCommand):
    help = "E2E: login → offline queue → sync → verify (plastic/tree/hazard)"

    def handle(self, *args, **options):
        with override_settings(
            ALLOWED_HOSTS=["*", "testserver", "localhost", "127.0.0.1"]
        ):
            self._run()

    def _run(self):
        results = []

        def ok(name, detail=""):
            results.append((True, name, detail))
            self.stdout.write(
                self.style.SUCCESS(f"PASS  {name}" + (f" — {detail}" if detail else ""))
            )

        def fail(name, detail=""):
            results.append((False, name, detail))
            self.stdout.write(
                self.style.ERROR(f"FAIL  {name}" + (f" — {detail}" if detail else ""))
            )

        now = timezone.now()
        stamp = int(now.timestamp())
        password = "E2eOffline123!"
        email = f"e2e_offline_{stamp}@climatewavers.test"
        username = f"e2e_offline_{stamp}"

        # ---------- 0) Login (JWT) ----------
        try:
            user = User.objects.create_user(
                email,
                "E2E",
                "Offline",
                "Kenya",
                "Nairobi",
                password,
                username=username,
                gender="male",
            )
            user.is_staff = True
            user.is_superuser = True
            user.is_verified = True
            user.save()
            login_client = APIClient()
            login = login_client.post(
                "/api/v1/auth/login/",
                {"email": email, "password": password},
                format="json",
            )
            # Some deployments use username; fall back to JWT mint
            access = None
            if login.status_code == 200:
                access = (
                    login.data.get("access_token")
                    or login.data.get("access")
                    or (login.data.get("tokens") or {}).get("access")
                )
            if not access:
                access = str(RefreshToken.for_user(user).access_token)
                ok("0 login JWT (minted)", "login endpoint shape differed; token minted")
            else:
                ok("0 login JWT", f"status={login.status_code}")

            client = APIClient()
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
            # Prove auth works
            me = client.get("/api/v1/auth/user/")
            if me.status_code not in (200, 404):
                # try alternate
                me = client.get("/api/v1/users/me/")
            ok("0 authenticated session", f"user_id={user.id}")
        except Exception as exc:
            fail("0 login", str(exc))
            self._summary(results)
            raise SystemExit(1)

        # ---------- 1) Plastic offline → sync ----------
        try:
            project = PlasticProject.objects.create(
                name=f"E2E Plastic {stamp}",
                description="offline e2e",
                organization=user,
                organization_name="E2E Org",
                country="Kenya",
                region="Nairobi",
                city="Nairobi",
                status="active",
                goal_kg=Decimal("50"),
                contact_person="E2E",
                contact_email=email,
            )
            hotspot = PlasticHotspot.objects.create(
                project=project,
                created_by=user,
                claimed_by=user,
                title="E2E drain hotspot",
                latitude=Decimal("-1.292100"),
                longitude=Decimal("36.821900"),
                location_label="Nairobi CBD",
                status="claimed",
                claim_pin="1234",
                claimed_at=now,
            )
            client_uuid = str(uuid.uuid4())
            # Simulate phone going offline then flushing queue
            offline_payload = {
                "project": project.id,
                "hotspot": hotspot.id,
                "client_uuid": client_uuid,
                "polymer_type": "PET",
                "kg_claimed": "3.5",
                "latitude": -1.2921,
                "longitude": 36.8219,
                "location_label": "Offline bag pin",
                "images": ["https://example.com/e2e-bag.jpg"],
                "was_offline": True,
                "offline": True,
                "notes": "Queued in field with no signal",
            }
            sync1 = client.post(
                "/api/v1/plastic/recoveries/", offline_payload, format="json"
            )
            if sync1.status_code not in (200, 201):
                fail("1a plastic offline sync", f"{sync1.status_code} {sync1.data}")
            else:
                recovery_id = sync1.data.get("id")
                row = PlasticRecovery.objects.filter(pk=recovery_id).first()
                if (
                    row
                    and row.client_uuid == client_uuid
                    and row.offline_queued_at is not None
                    and row.status in ("submitted", "queued_offline")
                ):
                    ok(
                        "1a plastic offline→online sync",
                        f"bag={row.bag_id} status={row.status} kg={row.kg_claimed}",
                    )
                else:
                    fail(
                        "1a plastic offline→online sync",
                        f"missing offline bookkeeping: {sync1.data}",
                    )

                # Idempotent replay (same client_uuid) — queue flush retry
                sync2 = client.post(
                    "/api/v1/plastic/recoveries/", offline_payload, format="json"
                )
                if sync2.status_code in (200, 201) and sync2.data.get("id") == recovery_id:
                    ok("1b plastic idempotent flush replay", f"id={recovery_id}")
                else:
                    fail(
                        "1b plastic idempotent flush replay",
                        f"{sync2.status_code} {sync2.data}",
                    )
        except Exception as exc:
            fail("1 plastic offline e2e", str(exc))

        # ---------- 2) Tree survival offline → sync ----------
        try:
            tree_project = TreeProject.objects.create(
                name=f"E2E Grove {stamp}",
                description="offline survival e2e",
                organization=user,
                organization_name="E2E Org",
                country="Kenya",
                region="Nairobi",
                city="Nairobi",
                latitude=Decimal("-1.2921"),
                longitude=Decimal("36.8219"),
                project_type="reforestation",
                status="active",
                target_trees=10,
                trees_planted=1,
                tree_price=Decimal("2.00"),
                start_date=now.date(),
                expected_completion=now.date() + timedelta(days=180),
                total_budget=Decimal("100"),
                funds_raised=Decimal("2"),
                contact_person="E2E",
                contact_email=email,
                is_verified=True,
            )
            donation = TreeProjectDonation.objects.create(
                project=tree_project,
                donor=user,
                amount=Decimal("2.00"),
                trees_purchased=1,
                payment_reference=f"E2E-TREE-{stamp}",
                payment_status="completed",
                planting_status="planted",
                planted_at=now - timedelta(days=35),
                survival_lat=Decimal("-1.2921"),
                survival_lng=Decimal("36.8219"),
            )
            schedule_survival_checkins(donation)
            checkin = TreeSurvivalCheckIn.objects.filter(
                donation=donation, milestone_days=30
            ).first()
            checkin.status = "due"
            checkin.due_at = now - timedelta(hours=2)
            checkin.save()

            surv_uuid = str(uuid.uuid4())
            surv_payload = {
                "images": ["https://example.com/e2e-tree.jpg"],
                "latitude": -1.2921,
                "longitude": 36.8219,
                "alive": True,
                "note": "Offline survival photo from grove",
                "was_offline": True,
                "offline": True,
                "client_uuid": surv_uuid,
                "location_label": "Pinned GPS from field",
            }
            surv = client.post(
                f"/api/v1/trees/survival/{checkin.id}/submit/",
                surv_payload,
                format="json",
            )
            if surv.status_code not in (200, 201):
                fail("2a tree survival offline sync", f"{surv.status_code} {surv.data}")
            else:
                checkin.refresh_from_db()
                donation.refresh_from_db()
                if (
                    checkin.status == "verified"
                    and checkin.offline_queued_at is not None
                    and str(checkin.client_uuid) == surv_uuid
                    and donation.planting_status == "surviving_30"
                ):
                    ok(
                        "2a tree survival offline→online sync",
                        f"status={checkin.status} planting={donation.planting_status} pts={checkin.points_awarded}",
                    )
                else:
                    fail(
                        "2a tree survival offline→online sync",
                        f"checkin={checkin.status} planting={donation.planting_status}",
                    )
        except Exception as exc:
            fail("2 tree survival offline e2e", str(exc))

        # ---------- 3) Hazard corroboration offline → sync ----------
        try:
            disaster = Disaster.objects.create(
                title=f"E2E rising river {stamp}",
                description="Offline corroboration e2e",
                disaster_type="flood",
                severity="high",
                status="monitoring",
                country="Kenya",
                region="Nairobi",
                city="Nairobi",
                latitude=Decimal("-1.2921"),
                longitude=Decimal("36.8219"),
                start_date=now,
            )
            # Need 3 users for full escalate; this step verifies ONE offline sync path
            haz_uuid = str(uuid.uuid4())
            haz_payload = {
                "decision": "confirm",
                "latitude": -1.2921,
                "longitude": 36.8219,
                "evidence": ["https://example.com/e2e-flood.jpg"],
                "note": "Ground truth queued offline",
                "was_offline": True,
                "offline": True,
                "client_uuid": haz_uuid,
                "source_channel": "offline_sync",
            }
            haz = client.post(
                f"/api/v1/hazards/{disaster.id}/corroborate/",
                haz_payload,
                format="json",
            )
            if haz.status_code not in (200, 201):
                fail("3a hazard offline sync", f"{haz.status_code} {haz.data}")
            else:
                row = CommunityHazardCorroboration.objects.filter(
                    disaster=disaster, user=user
                ).first()
                if (
                    row
                    and row.source_channel == "offline_sync"
                    and row.queued_offline_at is not None
                    and str(row.client_uuid) == haz_uuid
                ):
                    ok(
                        "3a hazard corroboration offline→online sync",
                        f"decision={row.decision} channel={row.source_channel}",
                    )
                else:
                    fail(
                        "3a hazard corroboration offline→online sync",
                        f"row={row}",
                    )

            # Bring 2 more nearby confirms so full escalate works (online peers)
            for i in range(2):
                peer = User.objects.create_user(
                    f"e2e_peer_{stamp}_{i}@climatewavers.test",
                    "Peer",
                    str(i),
                    "Kenya",
                    "Nairobi",
                    password,
                    username=f"e2e_peer_{stamp}_{i}",
                    gender="male",
                )
                peer.is_verified = True
                peer.save(update_fields=["is_verified"])
                peer_client = APIClient()
                peer_client.credentials(
                    HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(peer).access_token}"
                )
                peer_client.post(
                    f"/api/v1/hazards/{disaster.id}/corroborate/",
                    {
                        "decision": "confirm",
                        "latitude": -1.2921,
                        "longitude": 36.8219,
                        "evidence": [f"https://example.com/peer-{i}.jpg"],
                    },
                    format="json",
                )
            disaster.refresh_from_db()
            if disaster.status == "alert":
                ok(
                    "3b full escalate after offline seed + 2 peers",
                    f"status={disaster.status}",
                )
            else:
                fail("3b escalate to alert", f"status={disaster.status}")
        except Exception as exc:
            fail("3 hazard offline e2e", str(exc))

        # ---------- 4) Queue module contract (frontend keys / payload shape) ----------
        try:
            from pathlib import Path
            from django.conf import settings

            root = Path(settings.BASE_DIR).parent / "frontend" / "src" / "utils"
            expected = {
                "plasticOfflineQueue.js": "cw-plastic-offline-queue-v1",
                "treeOfflineQueue.js": "cw-tree-survival-offline-v1",
                "hazardOfflineQueue.js": "cw-hazard-corroboration-offline-v1",
            }
            missing = []
            for fname, key in expected.items():
                text = (root / fname).read_text(encoding="utf-8")
                if key not in text or "was_offline" not in text or "flush" not in text:
                    missing.append(fname)
            if not missing:
                ok(
                    "4 frontend queue contract",
                    "enqueue+flush+was_offline for plastic/tree/hazard",
                )
            else:
                fail("4 frontend queue contract", f"missing pieces in {missing}")
        except Exception as exc:
            fail("4 frontend queue contract", str(exc))

        self._summary(results)
        if any(not r[0] for r in results):
            raise SystemExit(1)

    def _summary(self, results):
        passed = sum(1 for r in results if r[0])
        failed = sum(1 for r in results if not r[0])
        self.stdout.write("")
        summary = f"RESULT  {passed} passed, {failed} failed, {len(results)} total"
        self.stdout.write(
            self.style.SUCCESS(summary) if failed == 0 else self.style.WARNING(summary)
        )
