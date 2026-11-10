# Disaster alerts (email + Meta WhatsApp + nearby agencies + RapidBrief)

Climate Wavers sends **source-tagged operational alerts**. They are not government emergency warnings.

## What ships

1. **Official poller** — `python manage.py poll_live_official_alerts` every 10 minutes (Render cron `climate-wavers-alert-poller`) reads USGS + NASA EONET, dedupes via `OfficialAlertEvent`, AI-summarizes, then fans out.
2. **Community reports** — `response_system` still calls `/api/v1/alerts/fanout/` with AI summary + lat/lng when the reporter shares location.
3. **Channels**
   - Email via notification service + Resend (`disaster_alert` template)
   - WhatsApp via **Meta Cloud API** (`disaster_alert_whatsapp`)
4. **Nearby agencies** — `EmergencyAgency` rows (seed with `python manage.py seed_emergency_agencies`), included in user messages and emailed / WhatsApp’d when opted in.
5. **User prefs** — `/app/alert-settings` → `GET/PUT /api/v1/alerts/preferences/`, phone OTP via WhatsApp template or email fallback.
6. **RapidBrief responders** — verified orgs (Red Cross, county, UN, NGOs) apply at `/app/responder/apply`, admin approves in Django admin, then receive durable dispatches + AI 30-minute mobilization briefs at `/app/responder`.

## RapidBrief onboarding

1. **New organizations (no account yet):** open public `/responders/apply` — creates an org workspace account + pending RapidBrief application in one step (not a personal social signup). API: `POST /api/v1/responder/apply-public/`.
2. **Existing users:** sign in → **Responder Desk** / `/app/responder/apply` (`POST /api/v1/responder/apply/`).
3. Admin opens **Responder organizations** → Approve selected.
4. On the next official or community fanout within coverage, a `ResponderDispatch` is created with an AI RapidBrief; members get in-app notifications; contact email/WhatsApp fire when configured.
5. Desk workflow: **Acknowledge → Mobilizing → On scene / Declined / Resolved**.

Seed creates an **approved** Kenya Red Cross RapidBrief sample (email contact only; no login membership) so fanout can exercise email paths after `seed_emergency_agencies`.

## Django commands

```bash
cd backend-new
python manage.py migrate
python manage.py seed_emergency_agencies
python manage.py poll_live_official_alerts --dry-run
python manage.py poll_live_official_alerts
```

## Meta WhatsApp setup

You can reuse the **same FlowOps Africa WhatsApp number** already on Meta (Cloud API). Climate Wavers alerts send as template messages from that Phone number ID; Grace / FlowOps chat can keep using the same number.

1. Open the FlowOps Meta app → **WhatsApp → API setup** (or Production setup).
2. Copy these into Render → **both** `climate-wavers-notifications` and `climate-wavers-api`
   (API sends phone OTP directly via Graph when Cloudflare blocks the notification service):
   - `META_WA_TOKEN` — permanent System User / access token with `whatsapp_business_messaging`
   - `META_WA_PHONE_NUMBER_ID` — **Phone number ID** (not the dial digits)
   - `META_WA_BUSINESS_ACCOUNT_ID` — WhatsApp Business Account ID (WABA) — notifications only
   - `META_WA_APP_SECRET` — App settings → Basic → App secret — notifications only
   - `META_WA_VERIFY_TOKEN` — any string you choose (must match webhook verify token in Meta)
3. Approve templates (names used in code):
   - `disaster_alert_user` — body vars: type, place, confidence, magnitude, tip, link
   - `disaster_alert_agency` — same shape for responders
   - `phone_verify_otp` — body var: code
4. Optional webhook (delivery status / inbound log):  
   `https://climate-wavers-notifications.onrender.com/api/v1/whatsapp/webhook`  
   If FlowOps/Grace already owns the app webhook, leave theirs in place — **outbound alerts only need token + phone number ID**.

Until Meta credentials and templates are live, email fanout still works; WhatsApp calls no-op with a log line.

Check: `GET https://climate-wavers-notifications.onrender.com/api/v1/whatsapp/status` → `{ "configured": true }`.

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/alerts/fanout/` | Internal fanout (`X-Internal-Secret`) |
| GET/PUT | `/api/v1/alerts/preferences/` | Auth user prefs |
| POST | `/api/v1/alerts/phone/request-code/` | Send OTP |
| POST | `/api/v1/alerts/phone/confirm/` | Confirm OTP |
| POST | `/api/v1/responder/apply/` | Apply as responder org |
| GET | `/api/v1/responder/me/` | Memberships + verification |
| GET/PATCH | `/api/v1/responder/org/` | Org profile (owner) |
| GET | `/api/v1/responder/dispatches/` | RapidBrief inbox |
| GET | `/api/v1/responder/dispatches/{id}/` | Dispatch detail |
| POST | `/api/v1/responder/dispatches/{id}/status/` | Acknowledge / mobilize / … |
| POST | `/api/v1/responder/brief/` | Regenerate AI brief |
| POST | response `/api/v1/alerts/summary` | AI short summary / brief assist |

## Product copy

Every alert includes confidence language (“Confirmed official feed” vs “Community report — unconfirmed”) and: follow local emergency instructions.
