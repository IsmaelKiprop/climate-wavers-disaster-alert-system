# Disaster alerts (email + Meta WhatsApp + nearby agencies)

Climate Wavers sends **source-tagged operational alerts**. They are not government emergency warnings.

## What ships

1. **Official poller** — `python manage.py poll_live_official_alerts` every 10 minutes (Render cron `climate-wavers-alert-poller`) reads USGS + NASA EONET, dedupes via `OfficialAlertEvent`, AI-summarizes, then fans out.
2. **Community reports** — `response_system` still calls `/api/v1/alerts/fanout/` with AI summary + optional lat/lng.
3. **Channels**
   - Email via notification service + Resend (`disaster_alert` template)
   - WhatsApp via **Meta Cloud API** (`disaster_alert_whatsapp`)
4. **Nearby agencies** — `EmergencyAgency` rows (seed with `python manage.py seed_emergency_agencies`), included in user messages and emailed / WhatsApp’d when opted in.
5. **User prefs** — `/app/alert-settings` → `GET/PUT /api/v1/alerts/preferences/`, phone OTP via WhatsApp template or email fallback.

## Django commands

```bash
cd backend-new
python manage.py migrate
python manage.py seed_emergency_agencies
python manage.py poll_live_official_alerts --dry-run
python manage.py poll_live_official_alerts
```

## Meta WhatsApp setup

1. Create a Meta Business app with WhatsApp product.
2. Set env on `climate-wavers-notifications`:
   - `META_WA_TOKEN`
   - `META_WA_PHONE_NUMBER_ID`
   - `META_WA_BUSINESS_ACCOUNT_ID`
   - `META_WA_APP_SECRET`
   - `META_WA_VERIFY_TOKEN` (for webhook)
3. Approve templates (names used in code):
   - `disaster_alert_user` — body vars: type, place, confidence, magnitude, tip, link
   - `disaster_alert_agency` — same shape for responders
   - `phone_verify_otp` — body var: code
4. Webhook URL: `https://climate-wavers-notifications.onrender.com/api/v1/whatsapp/webhook`

Until Meta credentials and templates are live, email fanout still works; WhatsApp calls no-op with a log line.

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/alerts/fanout/` | Internal fanout (`X-Internal-Secret`) |
| GET/PUT | `/api/v1/alerts/preferences/` | Auth user prefs |
| POST | `/api/v1/alerts/phone/request-code/` | Send OTP |
| POST | `/api/v1/alerts/phone/confirm/` | Confirm OTP |
| POST | response `/api/v1/alerts/summary` | AI short summary |

## Product copy

Every alert includes confidence language (“Confirmed official feed” vs “Community report — unconfirmed”) and: follow local emergency instructions.
