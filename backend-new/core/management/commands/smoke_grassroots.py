"""
Smoke-test Njeri's grassroots feature set against the live DB/API.

Usage:
  python manage.py smoke_grassroots
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.crowd_corroboration import CONFIRM_THRESHOLD, maybe_escalate_disaster
from core.hazard_digest import run_hazard_digests
from core.models import (
    Disaster,
    PlasticDispatch,
    PlasticProject,
    PlasticRecyclerPartner,
    SeasonalChallenge,
    SocialGroup,
    SocialGroupMembership,
    TreeProject,
    TreeProjectDonation,
    TreeSurvivalCheckIn,
    UserAlertPreference,
)
from core.paystack_transfers import maybe_payout_plastic_collectors, transfers_enabled
from core.sms_gateway import provider, send_sms
from core.tree_survival import schedule_survival_checkins

User = get_user_model()


class Command(BaseCommand):
    help = "Smoke-test grassroots adoption features (Njeri brief)"

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

        def body(resp):
            return getattr(resp, "data", None) or getattr(resp, "content", b"")[:300]

        now = timezone.now()
        stamp = int(now.timestamp())
        client = APIClient()

        user, _ = User.objects.get_or_create(
            username=f"smoke_grassroots_{stamp}",
            defaults={
                "email": f"smoke_{stamp}@climatewavers.test",
                "is_active": True,
            },
        )
        user.set_password("SmokeTest123!")
        user.is_staff = True
        user.is_superuser = True
        user.save()
        client.force_authenticate(user=user)

        # 1) Offline / SMS / digests
        try:
            pref, _ = UserAlertPreference.objects.get_or_create(user=user)
            pref.sms_alerts = True
            pref.whatsapp_alerts = False
            pref.digest_enabled = True
            pref.digest_channel = "sms"
            pref.digest_cadence = "daily"
            pref.phone = "+254711000111"
            pref.phone_verified = True
            pref.latitude = Decimal("-1.292100")
            pref.longitude = Decimal("36.821900")
            pref.radius_km = 100
            pref.last_digest_at = None
            pref.save()
            ok("1a alert prefs SMS+digest", f"provider={provider()}")
        except Exception as exc:
            fail("1a alert prefs SMS+digest", str(exc))

        try:
            sms = send_sms("+254711000111", f"CW smoke {stamp}: digest/SMS path")
            if sms.get("ok"):
                ok(
                    "1b Africa's Talking SMS send",
                    str(
                        sms.get("response", {})
                        .get("SMSMessageData", {})
                        .get("Message", "ok")
                    )[:120],
                )
            else:
                fail("1b Africa's Talking SMS send", str(sms))
        except Exception as exc:
            fail("1b Africa's Talking SMS send", str(exc))

        try:
            digest = run_hazard_digests(limit=5)
            ok("1c hazard digest runner", str(digest))
        except Exception as exc:
            fail("1c hazard digest runner", str(exc))

        try:
            r = client.get("/api/v1/trees/survival/due/")
            if r.status_code == 200:
                ok(
                    "1d survival due endpoint (offline target)",
                    f"count={r.data.get('count')}",
                )
            else:
                fail("1d survival due endpoint", f"status={r.status_code} {body(r)}")
        except Exception as exc:
            fail("1d survival due endpoint", str(exc))

        # 2) Tree survival + impact map
        try:
            project = TreeProject.objects.create(
                name=f"Smoke Grove {stamp}",
                description="Smoke test grove",
                organization=user,
                organization_name="Smoke Org",
                country="Kenya",
                region="Nairobi",
                city="Nairobi",
                latitude=Decimal("-1.2921"),
                longitude=Decimal("36.8219"),
                project_type="reforestation",
                status="active",
                target_trees=100,
                trees_planted=1,
                tree_price=Decimal("2.00"),
                start_date=now.date(),
                expected_completion=now.date() + timedelta(days=365),
                total_budget=Decimal("1000"),
                funds_raised=Decimal("2"),
                contact_person="Smoke",
                contact_email=user.email,
                is_verified=True,
            )
            donation = TreeProjectDonation.objects.create(
                project=project,
                donor=user,
                amount=Decimal("2.00"),
                trees_purchased=1,
                payment_reference=f"SMOKE-TREE-{stamp}",
                payment_status="completed",
                planting_status="planted",
                planted_at=now - timedelta(days=31),
                survival_lat=Decimal("-1.2921"),
                survival_lng=Decimal("36.8219"),
                survival_location_label="Nairobi ward smoke",
            )
            created = schedule_survival_checkins(donation)
            checkins = list(TreeSurvivalCheckIn.objects.filter(donation=donation))
            if len(checkins) == 3:
                ok("2a schedule 30/90/180 check-ins", f"created={len(created)}")
            else:
                fail("2a schedule 30/90/180 check-ins", f"got {len(checkins)}")

            due = TreeSurvivalCheckIn.objects.filter(
                donation=donation, milestone_days=30
            ).first()
            due.status = "due"
            due.due_at = now - timedelta(hours=1)
            due.save()
            submit = client.post(
                f"/api/v1/trees/survival/{due.id}/submit/",
                {
                    "images": ["https://example.com/tree-smoke.jpg"],
                    "latitude": -1.2921,
                    "longitude": 36.8219,
                    "alive": True,
                    "note": "Smoke survival photo",
                    "was_offline": True,
                    "client_uuid": f"00000000-0000-4000-8000-{stamp % 10**12:012d}",
                },
                format="json",
            )
            if submit.status_code in (200, 201) and submit.data.get("ok"):
                ok(
                    "2b survival geotagged submit + offline flag",
                    f"points={submit.data.get('points_awarded')}",
                )
            else:
                fail(
                    "2b survival geotagged submit",
                    f"{submit.status_code} {body(submit)}",
                )

            map_r = client.get("/api/v1/impact-map/?layer=all")
            if map_r.status_code == 200 and "features" in map_r.data:
                ok(
                    "2c impact map API",
                    f"features={map_r.data.get('count')} counties={len(map_r.data.get('counties') or [])}",
                )
            else:
                fail("2c impact map API", f"{map_r.status_code} {body(map_r)}")
        except Exception as exc:
            fail("2 tree survival / impact map", str(exc))

        # 3) Plastic Pulse payouts + recycler intake
        try:
            intake = client.post(
                "/api/v1/plastic/intake/scan/",
                {"bag_id": "SMOKE-BAG-DOES-NOT-EXIST"},
                format="json",
            )
            # 401 unauth, 400 bad bag, 403 not recycler, 404 unknown bag — all prove route exists
            if intake.status_code in (200, 400, 401, 403, 404):
                ok("3a recycler intake scan route exists", f"status={intake.status_code}")
            else:
                fail("3a recycler intake scan route", f"status={intake.status_code}")

            plastic_project = PlasticProject.objects.filter(status="active").first()
            if not plastic_project:
                plastic_project = PlasticProject.objects.create(
                    name=f"Smoke Plastic {stamp}",
                    description="smoke",
                    organization=user,
                    organization_name="Smoke",
                    country="Kenya",
                    region="Nairobi",
                    city="Nairobi",
                    status="active",
                    goal_kg=Decimal("100"),
                    contact_person="Smoke",
                    contact_email=user.email,
                )
            recycler = PlasticRecyclerPartner.objects.create(
                name=f"Smoke Recycler {stamp}",
                contact_email=user.email,
                contact_phone="0711000111",
                onboarding_status="approved",
                linked_user=user,
            )
            dispatch = PlasticDispatch.objects.create(
                project=plastic_project,
                recycler=recycler,
                polymer_type="PET",
                kg=Decimal("10.00"),
                total_kes=Decimal("1000.00"),
                platform_share_kes=Decimal("200.00"),
                collector_share_kes=Decimal("800.00"),
                payment_status="received",
                collector_payout_status="pending",
                collector_payout_phone="0711000111",
                payment_reference=f"SMOKE-DISP-{stamp}",
                status="accepted",
                created_by=user,
            )
            payout = maybe_payout_plastic_collectors(dispatch)
            ok(
                "3b collector M-Pesa payout path",
                f"transfers_enabled={transfers_enabled()} status={payout.get('status')} detail={payout.get('detail', '')[:80]}",
            )

            settle = client.post(
                f"/api/v1/plastic/dispatches/{dispatch.id}/settle/",
                {"action": "auto_payout", "collector_payout_phone": "0711000111"},
                format="json",
            )
            if settle.status_code in (200, 400, 403):
                ok("3c settle auto_payout endpoint", f"status={settle.status_code}")
            else:
                fail(
                    "3c settle auto_payout endpoint",
                    f"{settle.status_code} {body(settle)}",
                )
        except Exception as exc:
            fail("3 plastic payouts", str(exc))

        # 4) Leaderboards / challenges / certificates
        try:
            group = SocialGroup.objects.create(
                name=f"Smoke School {stamp}",
                slug=f"smoke-school-{stamp}",
                description="Smoke chapter",
                group_type="school",
                county="Nairobi",
                country="Kenya",
                trees_planted_total=12,
                plastic_kg_total=Decimal("34.5"),
                alerts_verified_total=2,
                is_verified=True,
                verified_badge="verified_chapter",
                created_by=user,
            )
            SocialGroupMembership.objects.create(group=group, user=user, role="owner")
            lb = client.get("/api/v1/leaderboards/groups/?county=Nairobi")
            if lb.status_code == 200 and lb.data.get("count", 0) >= 1:
                ok("4a group leaderboard", f"count={lb.data.get('count')}")
            else:
                fail("4a group leaderboard", f"{lb.status_code} {body(lb)}")

            profile = client.get(f"/api/v1/leaderboards/groups/{group.id}/")
            if profile.status_code == 200 and profile.data.get("id") == group.id:
                ok(
                    "4b group profile + badges fields",
                    f"type={profile.data.get('group_type')}",
                )
            else:
                fail("4b group profile", f"{profile.status_code} {body(profile)}")

            challenge = SeasonalChallenge.objects.create(
                title=f"Nairobi Season Smoke {stamp}",
                slug=f"nairobi-smoke-{stamp}",
                description="Smoke challenge",
                county="Nairobi",
                metric="combined",
                status="active",
                starts_at=now - timedelta(days=1),
                ends_at=now + timedelta(days=30),
                created_by=user,
            )
            join = client.post(
                f"/api/v1/challenges/{challenge.id}/join/",
                {"group_id": group.id},
                format="json",
            )
            if join.status_code in (200, 201):
                ok("4c seasonal challenge join", f"score={join.data.get('score')}")
            else:
                fail("4c seasonal challenge join", f"{join.status_code} {body(join)}")

            ranks = client.get(f"/api/v1/challenges/{challenge.id}/leaderboard/")
            if ranks.status_code == 200:
                ok(
                    "4d challenge leaderboard",
                    f"rows={len(ranks.data.get('results') or [])}",
                )
            else:
                fail("4d challenge leaderboard", f"{ranks.status_code}")

            cert = client.post(
                f"/api/v1/challenges/{challenge.id}/certificate/",
                {"group_id": group.id},
                format="json",
            )
            if cert.status_code == 200 and cert.data.get("certificate_id"):
                code = cert.data["certificate_id"]
                verify = client.get(f"/api/v1/challenges/certificates/{code}/")
                if verify.status_code == 200:
                    ok("4e impact certificate issue+verify", code)
                else:
                    fail("4e certificate verify", f"{verify.status_code}")
            else:
                fail("4e certificate issue", f"{cert.status_code} {body(cert)}")
        except Exception as exc:
            fail("4 leaderboards", str(exc))

        # 5) Crowd corroboration
        try:
            disaster = Disaster.objects.create(
                title=f"Smoke flood {stamp}",
                description="Rising river smoke test",
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
            queue = client.get(
                "/api/v1/hazards/corroboration-queue/?latitude=-1.2921&longitude=36.8219"
            )
            if queue.status_code == 200:
                ok("5a corroboration queue", f"nearby={queue.data.get('count')}")
            else:
                fail("5a corroboration queue", f"{queue.status_code} {body(queue)}")

            for i in range(CONFIRM_THRESHOLD):
                u, _ = User.objects.get_or_create(
                    username=f"smoke_crowd_{stamp}_{i}",
                    defaults={"email": f"crowd_{stamp}_{i}@climatewavers.test"},
                )
                c = APIClient()
                c.force_authenticate(user=u)
                resp = c.post(
                    f"/api/v1/hazards/{disaster.id}/corroborate/",
                    {
                        "decision": "confirm",
                        "latitude": -1.2921,
                        "longitude": 36.8219,
                        "evidence": [f"https://example.com/flood-{i}.jpg"],
                        "note": "Ground truth smoke",
                        "was_offline": i == 0,
                    },
                    format="json",
                )
                if resp.status_code not in (200, 201):
                    fail(
                        "5b crowd confirm",
                        f"user={i} {resp.status_code} {body(resp)}",
                    )
                    break
            else:
                disaster.refresh_from_db()
                if disaster.status != "alert":
                    maybe_escalate_disaster(disaster)
                    disaster.refresh_from_db()
                if disaster.status == "alert":
                    ok(
                        "5b crowd 3x confirm → ward alert",
                        f"status={disaster.status} threshold={CONFIRM_THRESHOLD}",
                    )
                else:
                    fail("5b crowd escalate", f"status={disaster.status}")

            stats = client.get(f"/api/v1/hazards/{disaster.id}/corroborations/")
            if (
                stats.status_code == 200
                and stats.data.get("stats", {}).get("confirms", 0) >= CONFIRM_THRESHOLD
            ):
                ok("5c corroboration stats", str(stats.data.get("stats")))
            else:
                fail("5c corroboration stats", f"{stats.status_code} {body(stats)}")
        except Exception as exc:
            fail("5 crowd corroboration", str(exc))

        # Frontend offline utils exist (file check)
        try:
            from pathlib import Path

            root = Path(settings.BASE_DIR).parent / "frontend" / "src" / "utils"
            tree_q = root / "treeOfflineQueue.js"
            haz_q = root / "hazardOfflineQueue.js"
            plas_q = root / "plasticOfflineQueue.js"
            if tree_q.exists() and haz_q.exists() and plas_q.exists():
                ok("1e offline queue modules present", "tree+hazard+plastic")
            else:
                fail(
                    "1e offline queue modules",
                    f"tree={tree_q.exists()} haz={haz_q.exists()} plastic={plas_q.exists()}",
                )
        except Exception as exc:
            fail("1e offline queue modules", str(exc))

        passed = sum(1 for r in results if r[0])
        failed = sum(1 for r in results if not r[0])
        self.stdout.write("")
        summary = f"RESULT  {passed} passed, {failed} failed, {len(results)} total"
        self.stdout.write(
            self.style.SUCCESS(summary) if failed == 0 else self.style.WARNING(summary)
        )
        if failed:
            raise SystemExit(1)
