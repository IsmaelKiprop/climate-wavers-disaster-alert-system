# Live hosting: Vercel + Supabase + compute

Climate Wavers is several services, not one app. Supabase cannot run Django, Node, or Flask. Use it for **Postgres and file storage**. Put the React app on **Vercel**. Run the APIs on a container host such as **Render**, Railway, or Fly.io.

```
Browser
   │
   ▼
Vercel  (frontend/)
   │  VITE_APP_BACKEND_URL
   │  VITE_APP_CHATBOT_URL
   ▼
Django API  (backend-new/)     Node response  (response_system/)
   │                                │
   ├── DATABASE_URL ──────────────► Supabase Postgres
   ├── STORAGE_BACKEND=supabase ──► Supabase Storage
   └── optional AMQP / Redis ─────► CloudAMQP / Redis
```

| Piece | Host | Why |
|---|---|---|
| Web UI | Vercel | Vite static build |
| Auth, posts, campaigns, admin | Render / Railway / Fly | Django + Channels |
| Chat / disaster text | Same compute host | Node `response_system` |
| Emails | Same compute host | Node `notification_service` |
| Image / magnitude models | Same compute host (optional) | Flask `models` |
| Database | Supabase | Managed Postgres |
| Uploaded media | Supabase Storage | S3-compatible bucket |

You can go live with **Vercel + Django + Supabase** only. Chatbot, mail, and ML stay optional until their env vars are set.

---

## 1. Supabase (database + storage)

1. Create a project at [supabase.com](https://supabase.com).
2. **Database** → **Connection string** → Session pooler (port `5432`). Copy it as `DATABASE_URL`.
3. **Storage** → create a public bucket named `media`.
4. **Project Settings** → **Storage** / S3 credentials. You need:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_S3_ENDPOINT_URL=https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3`
   - `AWS_STORAGE_BUCKET_NAME=media`
   - `AWS_S3_REGION_NAME` (shown in the dashboard)

Use the session pooler for Django migrations. The transaction pooler (port `6543`) also works; the app disables server-side cursors automatically.

---

## 2. Django API (compute host)

Render is already described in `render.yaml`. Railway and Fly work with the same Docker image in `backend-new/`.

Generate secrets once:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Set these on the API service:

```bash
DEBUG=False
SECRET_KEY=<generated>
FERNET_KEY=<generated>
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DB_SSL_REQUIRE=True

ALLOWED_HOSTS=your-api.onrender.com
BASE_URL=https://your-api.onrender.com
BACKEND_HOST=https://your-api.onrender.com
FRONTEND_URL=https://your-app.vercel.app

ALLOWED_ORIGINS=https://your-app.vercel.app
ALLOW_ALL_ORIGINS=False
CSRF_TRUSTED_ORIGINS=https://your-app.vercel.app,https://your-api.onrender.com
CORS_ORIGIN_REGEXES=^https://.*\.vercel\.app$

STORAGE_BACKEND=supabase
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=media
AWS_S3_ENDPOINT_URL=https://<PROJECT_REF>.storage.supabase.co/storage/v1/s3
AWS_S3_REGION_NAME=us-east-1
```

Health check: `GET https://your-api.onrender.com/health/` should return `{"status":"ok"}`.

The container runs migrations on boot (`entrypoint.sh`).

---

## 3. Frontend (Vercel)

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework: Vite. Build: `npm run build`. Output: `dist`.
4. Add Production env vars from `frontend/.env.production.example`:

```bash
VITE_APP_BACKEND_URL=https://your-api.onrender.com
VITE_APP_BACKEND_STATUS=true
VITE_APP_CHATBOT_URL=https://your-response.onrender.com
VITE_DOMAIN=your-app.vercel.app
VITE_SITE_URL=https://your-app.vercel.app
```

Leave `VITE_APP_CHATBOT_URL` empty until the response service is live. Disaster pages fall back to mock data.

Vite bakes `VITE_*` values at **build** time. Change them, then redeploy.

`frontend/src/config/env.js` is the only place the UI reads service URLs. Do not hardcode hosts in components.

---

## 4. Optional services

Each service reads its own `.env.example`. Point them at each other with public HTTPS URLs.

### Response system (chat + disasters)

```bash
PORT=3004
CORS_ORIGINS=https://your-app.vercel.app
OPENAI_API_KEY=...
AMQP_URL=amqps://user:pass@host/vhost
ANALYSIS_MODEL_URL=https://your-models.onrender.com/api/v1/analysis
RECOGNITION_MODEL_URL=https://your-models.onrender.com/api/v1/recognition
```

### Notifications

Needs SMTP plus `AMQP_URL`. Firebase is optional.

### Models

```bash
API_KEY=...
```

Then set `ANALYSIS_MODEL_URL` and `RECOGNITION_MODEL_URL` on the response service.

### Redis / RabbitMQ

- Redis: Render Redis, Upstash, or Railway Redis → `REDIS`
- RabbitMQ: CloudAMQP → `AMQP_URL` on Django, response, and notifications

Without Redis, Django Channels uses in-memory (single instance only).
Without RabbitMQ, email and AI post ingest stay idle.

---

## 5. After the first deploy

1. Open the Vercel URL. Signup / login should hit the Django API.
2. Upload an image. The returned URL should be on Supabase Storage.
3. Confirm Django admin at `https://your-api.onrender.com/admin/`.
4. If the browser blocks requests, the Vercel origin is missing from `ALLOWED_ORIGINS`.
5. Redeploy Vercel after any `VITE_*` change.

---

## Local development still works

```bash
cp backend-new/.env.example backend-new/.env
cp frontend/.env.example frontend/.env
docker compose up -d
```

Leave `DATABASE_URL` empty to keep SQLite locally. The same codebase talks to Supabase in production when `DATABASE_URL` is set.

---

## Security

- `DEBUG=False` in production
- HTTPS only
- Do not commit `.env` files
- Rotate `SECRET_KEY` and `FERNET_KEY` if they ever leak
- Keep `ALLOW_ALL_ORIGINS=False` once the Vercel domain is known
