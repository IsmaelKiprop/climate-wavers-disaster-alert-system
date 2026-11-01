# Climate Wavers — Trustworthy AI Disaster Alert System

**Prototype for safer AI-assisted early warning in climate and disaster response.**

Climate Wavers is a community-oriented disaster alert and response platform that combines machine learning, large language models (LLMs), and operational tooling to detect, contextualize, and communicate climate-related hazards. This repository is the working prototype behind a [BlueDot Rapid Grant](https://bluedot.org/programs/rapid-grants) (Compute & tools) application focused on **AI safety in high-stakes emergency communications**.

> **One-line pitch:** A trustworthy AI-assisted disaster alert prototype that tests AI-generated warnings for factual reliability, unsupported claims, and potentially harmful errors before they are used in real-world emergency response.

| | |
|---|---|
| **Applicant** | Ismael Kiprop ([LinkedIn](https://www.linkedin.com/in/ismael-kiprop-105378406) · [flowops.africa](https://flowops.africa)) |
| **Based in** | Kenya |
| **Grant type** | Compute & tools |
| **Organization** | [Climate Wavers](https://github.com/ClimateWavers) |
| **License** | MIT |

---

## Why this matters for AI safety

LLMs are increasingly used to draft alerts, safety tips, and chatbot replies during disasters. In that setting, **confident but wrong output is not a UX bug — it can cause harm**:

- Fabricated locations, severity, or “all clear” messages
- Unsupported claims presented as verified fact
- Unsafe or culturally inappropriate instructions
- Overconfident language that crowds out human verification

This project treats disaster alerts as a **high-stakes AI evaluation domain**. The goal is not to automate emergency response blindly, but to build a prototype pipeline where:

1. Models and LLMs **propose** detections, messages, and recommendations  
2. Structured checks surface **unsupported claims, hallucinations, and harmful phrasing**  
3. Human verification and confidence metadata remain first-class before broad dissemination  

That reduces catastrophic risk from AI misuse or failure modes in crisis contexts, and contributes to **AI going well** by making reliability, refusal of overclaim, and human oversight default design choices—especially for vulnerable communities in the Global South where early warning infrastructure is often thin.

---

## What the system does today

| Capability | Status | Notes |
|---|---|---|
| Disaster & alert data models (types, status, AI confidence, verification) | ✅ Built | Django models with `ai_confidence_score`, `is_ai_detected`, `verified_by` |
| Community / campaign response workflows | ✅ Built | Campaigns linked to disasters; AI metadata fields |
| LLM-assisted chatbot & alert copy (OpenAI) | ✅ Built | Response microservice (`gpt-4o-mini`) |
| Safety recommendation generation | ✅ Built | Prompted recommendations by disaster type / magnitude |
| Image-based disaster recognition (ResNet / quantized) | ✅ Prototype | `models/recognition_model` |
| Magnitude analysis (storms, floods, earthquakes) | ✅ Prototype | Random forest / scikit-learn pipeline |
| Weather, news, social monitoring hooks | ✅ Partial | OpenWeather, News API, Twitter integrations |
| Notification delivery (email / messaging bus) | ✅ Built | RabbitMQ-backed notification service |
| Web app (reports, chat, alerts UI) | ✅ Built | Vite + React frontend |
| Systematic LLM alert reliability evaluation harness | 🚧 In progress | Core Rapid Grant focus: fact-check / claim / harm filters before send |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Frontend   │────▶│  Django backend  │────▶│ Redis / Channels    │
│  (Vite)     │     │  (API, auth, DB) │     │ RabbitMQ            │
└─────────────┘     └────────┬─────────┘     └──────────┬──────────┘
                             │                          │
              ┌──────────────┼──────────────────────────┤
              ▼              ▼                          ▼
     ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐
     │ Models service │  │ Response system  │  │ Notification svc   │
     │ (CV + analysis)│  │ (LLM alerts/chat)│  │ (email / delivery) │
     └────────────────┘  └──────────────────┘  └────────────────────┘
```

| Service | Path | Port (local) | Live host |
|---|---|---|---|
| Frontend | `frontend/` | `5173` | Vercel |
| Backend | `backend-new/` | `8000` | Render / Railway / Fly (Django) |
| Database + media | env `DATABASE_URL` / `STORAGE_BACKEND` | — | Supabase |
| Backend worker | `backend-new/` | — | Same compute host |
| Models | `models/` | `5000` | Optional compute service |
| Response system | `response_system/` | `3004` | Optional compute service |
| Notification | `notification_service/` | `3000` | Optional compute service |
| Redis | Docker | `6379` | Render Redis / Upstash |
| RabbitMQ | Docker | `5672` / `15672` | CloudAMQP |

Service URLs are env-driven. See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) to put the stack on Vercel + Supabase.

---

## Repository layout

```
climate-wavers-disaster-alert-system/
├── frontend/                 # React (Vite) client
├── backend-new/              # Django REST API + workers
├── models/                   # ML microservice (analysis + recognition)
├── response_system/          # Node LLM / disaster response service
├── notification_service/     # Notification microservice
├── docker-compose.yml        # Full local stack
├── SETUP_AI.md               # AI posting / OpenAI setup notes
├── ENVIRONMENT_CONFIG.md     # API keys & env guidance
├── PRODUCTION_DEPLOYMENT.md  # Production checklist
└── README.md                 # This file
```

---

## Quick start (Docker)

**Prerequisites:** Docker Desktop (or Docker Engine + Compose), and API keys you intend to use (especially `OPENAI_API_KEY` for LLM features).

1. **Clone**

   ```bash
   git clone https://github.com/ClimateWavers/climate-wavers-disaster-alert-system.git
   cd climate-wavers-disaster-alert-system
   ```

2. **Create env files** from the examples in each service:

   ```bash
   cp backend-new/.env.example backend-new/.env
   cp frontend/.env.example frontend/.env
   cp models/.env.example models/.env
   cp response_system/.env.example response_system/.env
   cp notification_service/.env.example notification_service/.env
   ```

   Set at least `SECRET_KEY`, `FERNET_KEY`, and `OPENAI_API_KEY` (for AI features). See [ENVIRONMENT_CONFIG.md](./ENVIRONMENT_CONFIG.md) and [SETUP_AI.md](./SETUP_AI.md).

3. **Start the stack**

   ```bash
   docker compose up -d
   ```

4. **Open the apps**

   | URL | Service |
   |---|---|
   | http://localhost:5173 | Frontend |
   | http://localhost:8000 | Django API |
   | http://localhost:3004 | Response / chatbot API |
   | http://localhost:5000 | Models API |
   | http://localhost:15672 | RabbitMQ management (`admin` / `admin`) |

5. **Stop**

   ```bash
   docker compose down
   ```

---

## Local development (without full Docker)

You can run services individually if you prefer. Typical flow:

1. Start **Redis** and **RabbitMQ** (Docker only for infra is fine).  
2. Backend: `cd backend-new && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver`  
3. Frontend: `cd frontend && npm install && npm run dev`  
4. Response system: `cd response_system && npm install && npm start`  
5. Models: `cd models && pip install -r requirements.txt && python app.py`  

Exact env vars are documented in each service’s `.env.example` and in [ENVIRONMENT_CONFIG.md](./ENVIRONMENT_CONFIG.md).

---

## AI components (detail)

### 1. Response system (LLM)

Located in `response_system/`. Uses OpenAI chat completions to:

- Generate calming, actionable **live disaster alert** copy  
- Produce **safety recommendations** by disaster type and magnitude  
- Power a climate / disaster **chatbot** with conversation context  
- Infer disaster type / location from user reports (including optional images)  
- Estimate seasonality plausibility of a hazard at a location  

These prompts are powerful but currently **under-constrained for safety**. The Rapid Grant workstream adds evaluation and gating before messages leave the system.

### 2. Models microservice

Located in `models/`:

- **Magnitude analysis** — climate + historical disaster data; random forest classifier for storms, floods, earthquakes ([analysis README](./models/analysis_model/README.md))  
- **Disaster recognition** — ResNet-based vision model, quantized for lighter inference ([recognition README](./models/recognition_model/README.md))  

### 3. Backend trust metadata

Disaster and campaign records already store fields such as:

- `is_ai_detected` / `is_ai_generated`  
- `ai_confidence_score`  
- `ai_source`  
- `verified_by`  

These are the hooks for human-in-the-loop review and future automated reliability scores.

---

## Rapid Grant roadmap (Compute & tools)

Funding would accelerate **compute, API credits, and evaluation tooling** so the prototype can move from “LLM generates alert text” to “alert text is stress-tested before use”:

1. **Alert reliability eval harness** — batch-test generated warnings for factual errors, unsupported claims, and harmful instructions against ground-truth scenarios (Kenya / East Africa focused where possible).  
2. **Claim & grounding checks** — cross-check LLM output against structured disaster records, model scores, and open hazard feeds before publish.  
3. **Safety filters & refusal policies** — block or flag overconfident “all clear,” fabricated locations, and medically/operationally unsafe advice.  
4. **Human review UX** — surface confidence, flagged claims, and verifier actions in the operator workflow.  
5. **Public write-up** — open methods and failure cases so others building crisis AI can reuse the evaluation approach.

Without dedicated compute and credits, evaluation runs stay small, slow, and hard to reproduce—limiting how seriously the safety layer can be validated.

---

## Related documentation

| Doc | Purpose |
|---|---|
| [SETUP_AI.md](./SETUP_AI.md) | OpenAI-powered posting & content checks |
| [ENVIRONMENT_CONFIG.md](./ENVIRONMENT_CONFIG.md) | API keys (weather, news, social) |
| [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) | Production env, media, CORS |
| [AUTOMATION_SETUP.md](./AUTOMATION_SETUP.md) | Automation / ops notes |
| [API_KEYS_SETUP.md](./API_KEYS_SETUP.md) | Key setup checklist |

---

## Contributing & contact

Issues and PRs are welcome. For grant-related questions about this workstream, contact **Ismael Kiprop** (`kipropismael27@gmail.com`) or BlueDot at `team@bluedot.org`.

---

## License

[MIT](./LICENSE) © Climate Wavers
