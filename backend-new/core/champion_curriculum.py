"""
ALX-style Community Champion curriculum.

Each module: lesson content → quiz (must pass) → unlock next.
Certificate issued when all modules are passed.
"""

PASS_SCORE = 70  # percent

CURRICULUM = [
    {
        "id": "ground_rules",
        "title": "Ground rules",
        "duration_min": 8,
        "summary": "What a Community Champion is — and is not — in the Resilience Cycle.",
        "objectives": [
            "Explain the Verify step before Alert",
            "Stay neutral and consent-first",
            "Know when to escalate to responders",
        ],
        "lesson": [
            {
                "heading": "Your role",
                "body": (
                    "Climate Wavers Detects hazards from USGS/NASA feeds. "
                    "You own Verify: confirm what is happening on the ground before alerts go wide. "
                    "Responders act on verified needs. Tree Admins lead Restore. "
                    "You are the human bridge between data and community safety."
                ),
            },
            {
                "heading": "Operating principles",
                "body": (
                    "Core alerts stay free. Nothing is sent wide until verified. "
                    "Collect only data you need, with consent. Stay non-partisan. "
                    "Work on low bandwidth. Report honestly — including false alarms."
                ),
            },
            {
                "heading": "Safety first",
                "body": (
                    "Never put yourself in danger for a confirmation. "
                    "If you cannot reach the scene safely, Escalate to responders "
                    "and use partner/public cameras or phone live cam from a safe distance."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "When should a wide community alert go out?",
                "choices": [
                    "As soon as USGS detects a signal",
                    "After ground verification (or enough evidence)",
                    "Only after trees are planted",
                    "Only if sponsors approve",
                ],
                "answer": 1,
            },
            {
                "id": "q2",
                "prompt": "If the hazard area is unsafe for you to enter, you should:",
                "choices": [
                    "Confirm anyway from home without evidence",
                    "Do nothing",
                    "Escalate and use safe evidence channels",
                    "Post on social media only",
                ],
                "answer": 2,
            },
            {
                "id": "q3",
                "prompt": "Climate Wavers alerts must remain:",
                "choices": [
                    "Party-branded for sponsors",
                    "Paid for every household",
                    "Neutral and free for communities",
                    "Hidden from responders",
                ],
                "answer": 2,
            },
        ],
    },
    {
        "id": "location_proof",
        "title": "Location proof",
        "duration_min": 10,
        "summary": "GPS presence, check-ins, and distance rules for Confirm/Deny.",
        "objectives": [
            "Use GPS check-in to warm your territory",
            "Understand the presence gate for Confirm/Deny",
            "Escalate when too far from the hazard",
        ],
        "lesson": [
            {
                "heading": "Why GPS matters",
                "body": (
                    "Confirm and Deny require proof you are near the hazard or in your territory. "
                    "This stops remote rubber-stamping. Escalation can still work without presence."
                ),
            },
            {
                "heading": "Check-in habit",
                "body": (
                    "Use GPS check-in on the desk regularly. Your radius grows with tier "
                    "(trainee → active → trusted). Accuracy under ~50m strengthens evidence score."
                ),
            },
            {
                "heading": "Distance rule of thumb",
                "body": (
                    "If you are outside your radius plus the disaster affected area, "
                    "the system blocks Confirm/Deny. Move closer safely or Escalate."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "Confirm/Deny generally require:",
                "choices": [
                    "Only a written note",
                    "GPS presence near the hazard/territory",
                    "A sponsor code",
                    "Staff approval each time",
                ],
                "answer": 1,
            },
            {
                "id": "q2",
                "prompt": "If you are too far from the hazard you should:",
                "choices": [
                    "Spoof your GPS",
                    "Escalate or get closer safely",
                    "Ask a friend to click Confirm",
                    "Ignore the queue item",
                ],
                "answer": 1,
            },
            {
                "id": "q3",
                "prompt": "Regular GPS check-ins help:",
                "choices": [
                    "Unlock paid ads",
                    "Keep territory presence warm and improve queue relevance",
                    "Replace all verifications",
                    "Disable SMS alerts",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "live_cam",
        "title": "Phone live cam",
        "duration_min": 8,
        "summary": "When to open a ground-truth Jitsi room for real-time proof.",
        "objectives": [
            "Start a short live cam session safely",
            "Know when photo/voice is enough instead",
            "Invite ops/Trusted peers when needed",
        ],
        "lesson": [
            {
                "heading": "Live cam use cases",
                "body": (
                    "Use phone live cam for fast-moving hazards (flood rise, fire/smoke) "
                    "when you can stream from a safe vantage. Ops or a Trusted champion may join."
                ),
            },
            {
                "heading": "Low bandwidth",
                "body": (
                    "Live cam needs data. On weak networks prefer one compressed photo + GPS + note. "
                    "Never risk battery/data if it blocks getting people to safety."
                ),
            },
            {
                "heading": "Privacy",
                "body": (
                    "Avoid filming faces of victims unnecessarily. Focus on conditions: water line, "
                    "road access, smoke direction. Rooms expire after the decision."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "Live cam is best when:",
                "choices": [
                    "You have no GPS",
                    "Conditions are changing fast and you can stream safely",
                    "You want to skip training",
                    "The hazard is already resolved",
                ],
                "answer": 1,
            },
            {
                "id": "q2",
                "prompt": "On very low data you should prefer:",
                "choices": [
                    "HD live cam only",
                    "Photo/voice + GPS",
                    "No evidence at all",
                    "Downloading satellite movies",
                ],
                "answer": 1,
            },
            {
                "id": "q3",
                "prompt": "During live cam, prioritise filming:",
                "choices": [
                    "Bystander faces close-up",
                    "Hazard conditions and access routes",
                    "Political rallies",
                    "Private homes interiors without need",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "cctv_consent",
        "title": "CCTV consent",
        "duration_min": 10,
        "summary": "Partner cameras vs public OSM webcams — lawful use only.",
        "objectives": [
            "Prefer partner CCTV with consent",
            "Use public OSM feeds as fallback only",
            "Never access private cameras without agreement",
        ],
        "lesson": [
            {
                "heading": "Partner cameras",
                "body": (
                    "Schools, churches, CBOs and responders can register streams with consent. "
                    "Staff approve them. You may view and record moments for verification evidence."
                ),
            },
            {
                "heading": "Public fallback",
                "body": (
                    "If no partner cam is nearby, the desk lists publicly mapped OpenStreetMap webcams. "
                    "Only open URLs already published — never scan private NVRs or guess passwords."
                ),
            },
            {
                "heading": "Retention & audit",
                "body": (
                    "Clips are evidence for Verify, not entertainment. Access is logged. "
                    "Do not reshare raw streams outside Climate Wavers."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "Private CCTV without owner consent is:",
                "choices": [
                    "Fine if nearby",
                    "Allowed for champions always",
                    "Not allowed — only consented partner or public listed feeds",
                    "Required by USGS",
                ],
                "answer": 2,
            },
            {
                "id": "q2",
                "prompt": "Public OSM webcams are used when:",
                "choices": [
                    "Partner cameras are missing nearby",
                    "You dislike GPS",
                    "You want to hack routers",
                    "Training is incomplete",
                ],
                "answer": 0,
            },
            {
                "id": "q3",
                "prompt": "Recorded CCTV moments should be treated as:",
                "choices": [
                    "Social content for jokes",
                    "Verification evidence with limited sharing",
                    "Marketing for politicians",
                    "Open torrent files",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "warn_nearby",
        "title": "Warn nearby ethics",
        "duration_min": 10,
        "summary": "Geofenced phone sirens — consent, templates, no spam.",
        "objectives": [
            "Warn only opted-in nearby phones",
            "Use templates and rate limits",
            "Read acks: Got it / Need help / False alarm",
        ],
        "lesson": [
            {
                "heading": "Proximity siren",
                "body": (
                    "Warn nearby targets people who opted into location-based alerts and "
                    "were recently inside your radius. It beeps the phone via push — not SMS-first."
                ),
            },
            {
                "heading": "Ethics",
                "body": (
                    "Preview the count before sending. Use approved message templates. "
                    "Do not spam. False alarms hurt trust and can lower your standing."
                ),
            },
            {
                "heading": "After the blast",
                "body": (
                    "Watch delivered / opened / need help tallies. "
                    "Need help signals should inform responders. SMS remains a fallback when push fails."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "Warn nearby should target:",
                "choices": [
                    "Every phone number in Kenya",
                    "Opted-in users with recent location in radius",
                    "Only staff accounts",
                    "Random social followers",
                ],
                "answer": 1,
            },
            {
                "id": "q2",
                "prompt": "Before sending a blast you should:",
                "choices": [
                    "Preview how many phones are in range",
                    "Disable GPS forever",
                    "Write a political slogan",
                    "Call every household personally first",
                ],
                "answer": 0,
            },
            {
                "id": "q3",
                "prompt": "Primary channel for Warn nearby is:",
                "choices": [
                    "Postal mail",
                    "App push / phone siren",
                    "Newspaper ads",
                    "TV only",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "blackout_relay",
        "title": "Blackout relay",
        "duration_min": 10,
        "summary": "When power and data die — store-and-forward, SMS, human relay.",
        "objectives": [
            "Know L0–L3 degraded modes",
            "Use offline queue then sync",
            "Activate school/church/chief relay nodes",
        ],
        "lesson": [
            {
                "heading": "Layers",
                "body": (
                    "L0 full app → L1 low data (no live cam) → L2 SMS/voice → "
                    "L3 total blackout: human relay with paper SOP. "
                    "The cloud cannot push alerts with zero signal."
                ),
            },
            {
                "heading": "Your job in a blackout",
                "body": (
                    "Pre-position relay contacts (chief, school, church). "
                    "Warn people you already know on the ground. "
                    "Log relay actions when connectivity returns."
                ),
            },
            {
                "heading": "Kit mindset",
                "body": (
                    "Power bank, paper contact sheet, offline maps for your ward. "
                    "CCTV may keep NVR clips locally and sync later if the site has power."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "In a total blackout the main channel is:",
                "choices": [
                    "Live cam HD",
                    "Human relay (school/church/chief)",
                    "Satellite TV ads",
                    "In-app shop",
                ],
                "answer": 1,
            },
            {
                "id": "q2",
                "prompt": "Offline verify decisions should:",
                "choices": [
                    "Be deleted",
                    "Queue locally and sync when online",
                    "Auto-confirm all disasters",
                    "Only work on desktop",
                ],
                "answer": 1,
            },
            {
                "id": "q3",
                "prompt": "Relay nodes are:",
                "choices": [
                    "Crypto miners",
                    "Named local contacts for offline warning",
                    "Paystack plans",
                    "Jitsi servers only",
                ],
                "answer": 1,
            },
        ],
    },
    {
        "id": "restore_days",
        "title": "Restore days",
        "duration_min": 8,
        "summary": "After the hazard — calendar days, planting, and community recovery.",
        "objectives": [
            "Host or support climate calendar days",
            "Connect Verify → Restore with Tree Admins",
            "Measure trees and people reached honestly",
        ],
        "lesson": [
            {
                "heading": "Recover & Restore",
                "body": (
                    "After Alert and Respond, communities need Recover (relief) and Restore "
                    "(trees, safer land). Champions can host climate days and enrol households "
                    "into ongoing alerts."
                ),
            },
            {
                "heading": "Working with Tree Admins",
                "body": (
                    "Verified planting projects are run by Tree Admins. "
                    "You help mobilise people and keep the story honest: what was planted and where."
                ),
            },
            {
                "heading": "Impact",
                "body": (
                    "Your impact score tracks verifications, people warned, enrollments, "
                    "and community ratings. Certificates recognise completed training — "
                    "ongoing service earns trust."
                ),
            },
        ],
        "quiz": [
            {
                "id": "q1",
                "prompt": "Restore in the Resilience Cycle mainly covers:",
                "choices": [
                    "Detecting USGS signals",
                    "Tree planting and reducing future risk",
                    "Writing party slogans",
                    "Turning off alerts forever",
                ],
                "answer": 1,
            },
            {
                "id": "q2",
                "prompt": "Champions support Restore by:",
                "choices": [
                    "Ignoring Tree Admins",
                    "Hosting/mobilising climate days and enrollments",
                    "Deleting disaster records",
                    "Selling seedlings privately off-platform",
                ],
                "answer": 1,
            },
            {
                "id": "q3",
                "prompt": "Training certificates mean:",
                "choices": [
                    "You finished the ALX-style path and can serve responsibly",
                    "You own the USGS network",
                    "You can skip Verify forever",
                    "You become a government officer automatically",
                ],
                "answer": 0,
            },
        ],
    },
]


def module_by_id(module_id: str):
    for m in CURRICULUM:
        if m["id"] == module_id:
            return m
    return None


def public_module_card(module: dict, *, completed: bool, locked: bool, index: int):
    return {
        "id": module["id"],
        "index": index + 1,
        "title": module["title"],
        "label": module["title"],
        "summary": module["summary"],
        "duration_min": module["duration_min"],
        "objectives": module["objectives"],
        "quiz_count": len(module["quiz"]),
        "completed": completed,
        "locked": locked,
        "pass_score": PASS_SCORE,
    }


def lesson_payload(module: dict):
    """Lesson without answers."""
    return {
        "id": module["id"],
        "title": module["title"],
        "summary": module["summary"],
        "objectives": module["objectives"],
        "duration_min": module["duration_min"],
        "lesson": module["lesson"],
        "quiz": [
            {
                "id": q["id"],
                "prompt": q["prompt"],
                "choices": q["choices"],
            }
            for q in module["quiz"]
        ],
        "pass_score": PASS_SCORE,
    }


def grade_quiz(module: dict, answers: dict) -> dict:
    """
    answers: { question_id: choice_index }
    """
    quiz = module["quiz"]
    total = len(quiz)
    correct = 0
    breakdown = []
    for q in quiz:
        given = answers.get(q["id"])
        try:
            given_i = int(given)
        except (TypeError, ValueError):
            given_i = -1
        ok = given_i == q["answer"]
        if ok:
            correct += 1
        breakdown.append(
            {
                "id": q["id"],
                "correct": ok,
                "expected": q["answer"],
                "given": given_i,
            }
        )
    percent = int(round((correct / total) * 100)) if total else 0
    return {
        "correct": correct,
        "total": total,
        "score": percent,
        "passed": percent >= PASS_SCORE,
        "pass_score": PASS_SCORE,
        "breakdown": breakdown,
    }
