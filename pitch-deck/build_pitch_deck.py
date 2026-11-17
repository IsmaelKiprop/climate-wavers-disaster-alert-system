#!/usr/bin/env python3
"""Build FlowOps Africa / Climate Wavers YECO pitch deck PDF."""

from pathlib import Path

from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "FlowOps_Africa_Climate_Wavers_YECO_Pitch_Deck.pdf"

# Brand
TEAL = HexColor("#067d83")
TEAL_DARK = HexColor("#055a5f")
TEAL_SOFT = HexColor("#E6F3F4")
INK = HexColor("#1A2B2B")
MUTED = HexColor("#4F6F6F")
LINE = HexColor("#D5E3E4")
ACCENT = HexColor("#2F9E44")

W, H = 13.333 * inch, 7.5 * inch  # 16:9


def draw_bg(c, fill=white):
    c.setFillColor(fill)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def draw_footer(c, page, total=12):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(0.7 * inch, 0.45 * inch, W - 0.7 * inch, 0.45 * inch)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(0.7 * inch, 0.25 * inch, "FlowOps Africa  ·  Climate Wavers  ·  Confidential")
    c.drawRightString(W - 0.7 * inch, 0.25 * inch, f"{page} / {total}")


def draw_header_bar(c):
    c.setFillColor(TEAL)
    c.rect(0, H - 0.18 * inch, W, 0.18 * inch, fill=1, stroke=0)


def logo_path(name):
    p = ASSETS / name
    return str(p) if p.exists() else None


def draw_logo(c, x, y, h=0.55 * inch, white_logo=False, max_w=None):
    path = logo_path("logolargewhite.png" if white_logo else "Logo.png")
    if not path:
        path = logo_path("logo.jpg") or logo_path("logodark.png")
    if not path:
        return
    from PIL import Image

    im = Image.open(path)
    aspect = im.size[0] / float(im.size[1] or 1)
    w = h * aspect
    if max_w and w > max_w:
        w = max_w
        h = w / aspect
    c.drawImage(path, x, y, width=w, height=h, mask="auto")
    return w, h


def draw_logo_plate(c, x, y, h=0.55 * inch, pad=8):
    """Light plate so Climate Wavers mark stays readable on teal."""
    path = logo_path("Logo.png") or logo_path("logo.jpg") or logo_path("logodark.png")
    if not path:
        return
    from PIL import Image

    im = Image.open(path)
    aspect = im.size[0] / float(im.size[1] or 1)
    w = h * aspect
    c.setFillColor(white)
    c.roundRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad, 6, fill=1, stroke=0)
    c.drawImage(path, x, y, width=w, height=h, mask="auto")
    return w, h


def draw_mark(c, x, y, size=0.35 * inch):
    path = logo_path("mark.png") or logo_path("vector.png")
    if path:
        c.drawImage(path, x, y, width=size, height=size * 0.55, mask="auto")


def title_block(c, title, subtitle=None):
    draw_header_bar(c)
    # brand mark top-right on every content slide
    mark = logo_path("Logo.png") or logo_path("logo.jpg")
    if mark:
        from PIL import Image

        im = Image.open(mark)
        aspect = im.size[0] / float(im.size[1] or 1)
        lh = 0.38 * inch
        lw = lh * aspect
        c.drawImage(mark, W - 0.7 * inch - lw, H - 0.95 * inch, width=lw, height=lh, mask="auto")
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(0.7 * inch, H - 0.85 * inch, title)
    if subtitle:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 12)
        c.drawString(0.7 * inch, H - 1.15 * inch, subtitle)
    c.setStrokeColor(TEAL)
    c.setLineWidth(3)
    c.line(0.7 * inch, H - 1.35 * inch, 2.2 * inch, H - 1.35 * inch)


def bullet(c, x, y, text, max_width=11.5 * inch, size=11, leading=16, color=INK):
    c.setFillColor(TEAL)
    c.circle(x + 4, y + 3, 2.2, fill=1, stroke=0)
    c.setFillColor(color)
    c.setFont("Helvetica", size)
    # simple wrap
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if c.stringWidth(test, "Helvetica", size) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    yy = y
    for i, line in enumerate(lines):
        c.drawString(x + 14, yy, line)
        yy -= leading
    return yy - 6


def card(c, x, y, w, h, title, body_lines):
    c.setFillColor(TEAL_SOFT)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + 14, y + h - 24, title)
    c.setFillColor(INK)
    c.setFont("Helvetica", 10)
    yy = y + h - 44
    for line in body_lines:
        c.drawString(x + 14, yy, line)
        yy -= 14


def slide_cover(c, page, total):
    draw_bg(c, TEAL)
    # left accent panel
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, 0.35 * inch, H, fill=1, stroke=0)

    draw_logo_plate(c, 0.7 * inch, H - 1.35 * inch, h=0.72 * inch, pad=10)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 34)
    c.drawString(0.7 * inch, H - 2.55 * inch, "Climate Wavers")
    c.setFont("Helvetica", 16)
    c.drawString(0.7 * inch, H - 3.0 * inch, "Building Climate-Resilient Communities")

    c.setStrokeColor(HexColor("#7EB8BB"))
    c.setLineWidth(2)
    c.line(0.7 * inch, H - 3.3 * inch, 3.4 * inch, H - 3.3 * inch)

    c.setFont("Helvetica", 13)
    c.drawString(0.7 * inch, H - 3.7 * inch, "A product of FlowOps Africa  ·  Nairobi, Kenya")
    c.setFont("Helvetica", 11)
    c.drawString(0.7 * inch, H - 4.1 * inch, "Youth Ecopreneur Programme (YECO) 2026/27  ·  Pitch Deck")
    c.setFont("Helvetica", 10)
    c.drawString(0.7 * inch, H - 4.45 * inch, "Sector: Climate Technology & Environmental Monitoring")

    # Product visual (OG brand image)
    og = logo_path("og-image.jpg")
    if og:
        c.setFillColor(white)
        c.roundRect(7.15 * inch, 1.55 * inch, 5.4 * inch, 3.15 * inch, 10, fill=1, stroke=0)
        c.drawImage(og, 7.3 * inch, 1.7 * inch, width=5.1 * inch, height=2.85 * inch, preserveAspectRatio=True, anchor="c")

    c.setFont("Helvetica", 10)
    c.drawString(0.7 * inch, 0.9 * inch, "alerts.flowops.africa")
    c.drawString(0.7 * inch, 0.7 * inch, "www.flowops.africa  ·  hello@flowops.africa")
    c.setFont("Helvetica", 9)
    c.drawString(0.7 * inch, 0.45 * inch, f"Confidential  ·  {page}/{total}")


def slide_problem(c, page, total):
    draw_bg(c)
    title_block(c, "The Problem", "Climate disasters hit first. Protection arrives late.")
    y = H - 1.85 * inch
    points = [
        "Floods, droughts and related shocks hit informal settlements, pastoralists and rural counties hardest.",
        "Hazard data often exists online, but communities rarely receive verified, actionable early warning.",
        "Local CBOs, youth groups and responders are ready to help — yet poorly connected to real-time alerts.",
        "Rumour-driven social media fills the gap, amplifying noise instead of trusted protection.",
        "Result: preventable loss of life, livelihoods, and delayed climate response at the frontline.",
    ]
    for p in points:
        y = bullet(c, 0.7 * inch, y, p, max_width=11.6 * inch)
    draw_footer(c, page, total)


def slide_solution(c, page, total):
    draw_bg(c)
    title_block(c, "Our Solution", "Climate Wavers closes the loop from signal → verification → local action")
    card(
        c,
        0.7 * inch,
        1.1 * inch,
        3.7 * inch,
        4.2 * inch,
        "1. Detect",
        [
            "Multi-source hazard signals",
            "including USGS & NASA feeds",
            "",
            "Live map + source-tagged",
            "operational alerts",
        ],
    )
    card(
        c,
        4.7 * inch,
        1.1 * inch,
        3.7 * inch,
        4.2 * inch,
        "2. Verify",
        [
            "Verification-oriented workflows",
            "Community Champions",
            "",
            "Reduce rumour risk before",
            "communities act",
        ],
    )
    card(
        c,
        8.7 * inch,
        1.1 * inch,
        3.7 * inch,
        4.2 * inch,
        "3. Activate",
        [
            "RapidBrief responder orgs",
            "by location & capacity",
            "",
            "Tree / restoration partners",
            "for resilience action",
        ],
    )
    draw_footer(c, page, total)


def slide_product(c, page, total):
    draw_bg(c)
    title_block(c, "Product", "Climate Wavers — climate technology & environmental monitoring")
    y = H - 1.8 * inch
    items = [
        "Live disaster alert platform for climate-vulnerable communities in Kenya",
        "RapidBrief: approve and activate local NGO/CBO responder desks (pilot → paid plans)",
        "Community Champion pathway: training, certification and last-mile verification",
        "Tree Admin / tree-gifting: connect supporters to verified restoration projects",
        "Channels: web app, email & WhatsApp alerts for users and organisations",
        "Built for B2C communities, B2NGO responders, and B2G county / public partners",
    ]
    for t in items:
        y = bullet(c, 0.7 * inch, y, t)
    draw_footer(c, page, total)


def slide_market(c, page, total):
    draw_bg(c)
    title_block(c, "Customers & Reach", "Who we serve and how we grow distribution")
    card(
        c,
        0.7 * inch,
        2.0 * inch,
        3.7 * inch,
        3.3 * inch,
        "B2C",
        ["Individuals & Champions", "nearby alerts, awareness,", "community verification"],
    )
    card(
        c,
        4.7 * inch,
        2.0 * inch,
        3.7 * inch,
        3.3 * inch,
        "B2NGO",
        ["CBOs / NGOs on RapidBrief", "dispatch inbox, seats,", "coverage by disaster type"],
    )
    card(
        c,
        8.7 * inch,
        2.0 * inch,
        3.7 * inch,
        3.3 * inch,
        "B2G",
        ["Counties & institutions", "multi-seat desks,", "wider operational coverage"],
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 11)
    c.drawString(
        0.7 * inch,
        1.35 * inch,
        "Go-to-market: website & socials · application funnels · partner referrals · direct county/NGO outreach",
    )
    draw_footer(c, page, total)


def slide_model(c, page, total):
    draw_bg(c)
    title_block(c, "Business Model", "Freemium climate-tech — communities free, organisations pay")
    rows = [
        ("Community", "Free", "Email + WhatsApp alerts, live map, community reports"),
        ("RapidBrief Pilot", "Free 90 days", "Verified humanitarian orgs after approval"),
        ("RapidBrief NGO", "KES 5,000 / mo", "Small–mid NGO desks, up to 8 seats"),
        ("RapidBrief Org", "KES 15,000 / mo", "Counties / national NGOs, up to 25 seats"),
        ("FlowOps Partner", "Custom", "WhatsApp/AI setup, training, priority support"),
        ("Tree marketplace", "18% fee", "Supporters fund trees; 82% to project partners"),
    ]
    y = H - 1.75 * inch
    c.setFillColor(TEAL_SOFT)
    c.roundRect(0.7 * inch, 1.0 * inch, 11.9 * inch, 4.5 * inch, 8, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(0.95 * inch, y, "Offer")
    c.drawString(3.4 * inch, y, "Price")
    c.drawString(5.6 * inch, y, "Notes")
    y -= 0.28 * inch
    c.setStrokeColor(LINE)
    c.line(0.95 * inch, y + 10, 12.2 * inch, y + 10)
    c.setFont("Helvetica", 10)
    for offer, price, notes in rows:
        c.setFillColor(INK)
        c.drawString(0.95 * inch, y, offer)
        c.setFillColor(TEAL_DARK)
        c.drawString(3.4 * inch, y, price)
        c.setFillColor(MUTED)
        c.drawString(5.6 * inch, y, notes)
        y -= 0.38 * inch
    draw_footer(c, page, total)


def slide_traction(c, page, total):
    draw_bg(c)
    title_block(c, "Traction & Milestones", "What we have shipped so far")
    y = H - 1.8 * inch
    items = [
        "FlowOps Africa registered as a sole proprietorship (Nairobi, Kenya)",
        "Climate Wavers live: alerts.flowops.africa  ·  company site: flowops.africa",
        "Product live with multi-source hazard feeds (USGS / NASA) and verification workflows",
        "RapidBrief responder onboarding + Community Champion pathway built",
        "Tree / restoration partner pipeline integrated into the platform",
        "Submitted to MoveNow Social Innovation Challenge — Climate Wavers: Building Climate-Resilient Communities",
        "Next: formal county/NGO pilots and paid RapidBrief conversions",
    ]
    for t in items:
        y = bullet(c, 0.7 * inch, y, t)
    draw_footer(c, page, total)


def slide_impact(c, page, total):
    draw_bg(c)
    title_block(c, "Environmental Impact", "Sustainability + land restoration pathways")
    card(
        c,
        0.7 * inch,
        1.2 * inch,
        5.7 * inch,
        4.1 * inch,
        "Climate resilience",
        [
            "Verified early warning reduces avoidable",
            "damage to lives, livelihoods and natural",
            "resources communities depend on.",
            "",
            "Indicators: users reached, Champions",
            "trained, responders activated, counties",
            "covered.",
        ],
    )
    card(
        c,
        6.8 * inch,
        1.2 * inch,
        5.7 * inch,
        4.1 * inch,
        "Land restoration",
        [
            "Tree Admin connects supporters to",
            "verified nurseries, schools, CBOs and",
            "local restoration projects.",
            "",
            "Indicators: partners verified, trees",
            "supported/funded, partner-reported",
            "planting outcomes as pilots scale.",
        ],
    )
    draw_footer(c, page, total)


def slide_advantage(c, page, total):
    draw_bg(c)
    title_block(c, "Why We Win", "Different from weather apps, rumours, and closed emergency systems")
    y = H - 1.85 * inch
    items = [
        "Full loop: monitoring + verification + local activation — not dashboards alone",
        "Source-tagged alerts (USGS/NASA) with Champion verification against rumour risk",
        "Youth-built and community-accessible for CBOs/NGOs — not only national agencies",
        "Combines early warning, responder coordination, and restoration support in one product",
        "Designed for African last-mile realities: WhatsApp, local orgs, county coverage",
    ]
    for t in items:
        y = bullet(c, 0.7 * inch, y, t)
    draw_footer(c, page, total)


def slide_team(c, page, total):
    draw_bg(c)
    title_block(c, "Team", "Youth-led climate-tech + community coordination")
    card(
        c,
        0.7 * inch,
        1.3 * inch,
        5.7 * inch,
        4.0 * inch,
        "Ismael Kiprop — Founder & CEO",
        [
            "Leads product strategy and development",
            "of Climate Wavers at FlowOps Africa.",
            "",
            "Climate technology, AI-assisted hazard",
            "verification, early warning systems,",
            "youth-led green innovation — Nairobi.",
        ],
    )
    card(
        c,
        6.8 * inch,
        1.3 * inch,
        5.7 * inch,
        4.0 * inch,
        "Njeri Leonida — Project Coordinator",
        [
            "Age 25  ·  Kenya",
            "",
            "Coordinates delivery, community",
            "engagement and partner workflows.",
            "",
            "Background: National Youth Service (NYS)",
            "— youth mobilisation & field coordination.",
        ],
    )
    draw_footer(c, page, total)


def slide_growth(c, page, total):
    draw_bg(c)
    title_block(c, "2–3 Year Growth Plan", "From working product → regional climate infrastructure")
    card(
        c,
        0.7 * inch,
        1.2 * inch,
        3.7 * inch,
        4.1 * inch,
        "Year 1 — Kenya depth",
        [
            "More Champions & RapidBrief orgs",
            "Last-mile alert quality",
            "County partnership pilots",
            "Restore partner pipeline growth",
        ],
    )
    card(
        c,
        4.7 * inch,
        1.2 * inch,
        3.7 * inch,
        4.1 * inch,
        "Year 2 — Revenue",
        [
            "B2NGO / B2G subscriptions",
            "Multilingual alerts",
            "YECO mentorship → model fit",
            "Investor readiness",
        ],
    )
    card(
        c,
        8.7 * inch,
        1.2 * inch,
        3.7 * inch,
        4.1 * inch,
        "Year 3 — Scale",
        [
            "East Africa replication",
            "Trusted response infrastructure",
            "Catalytic climate finance",
            "Measured impact reporting",
        ],
    )
    draw_footer(c, page, total)


def slide_ask(c, page, total):
    draw_bg(c)
    title_block(c, "The Ask", "YECO 2026/27 — accelerate a youth-led climate enterprise")
    c.setFillColor(TEAL)
    c.roundRect(0.7 * inch, 3.6 * inch, 5.5 * inch, 1.8 * inch, 10, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica", 12)
    c.drawString(1.0 * inch, 5.0 * inch, "Investment ask")
    c.setFont("Helvetica-Bold", 36)
    c.drawString(1.0 * inch, 4.2 * inch, "$50,000")
    c.setFont("Helvetica", 11)
    c.drawString(1.0 * inch, 3.85 * inch, "Equity-free preferred · 12-month scale")

    c.setFillColor(TEAL_SOFT)
    c.roundRect(6.5 * inch, 1.2 * inch, 5.9 * inch, 4.2 * inch, 10, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(6.85 * inch, 5.0 * inch, "Use of funds")
    c.setFillColor(INK)
    c.setFont("Helvetica", 11)
    uses = [
        "Product reliability & alert quality",
        "Champion & responder rollout",
        "County / NGO pilot expansion",
        "Impact measurement systems",
        "Go-to-market & partnerships",
    ]
    yy = 4.6 * inch
    for u in uses:
        c.setFillColor(TEAL)
        c.circle(7.0 * inch, yy + 3, 2.2, fill=1, stroke=0)
        c.setFillColor(INK)
        c.drawString(7.25 * inch, yy, u)
        yy -= 0.38 * inch

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 10)
    c.drawString(0.7 * inch, 1.5 * inch, "Also seeking: YECO mentorship, networks, legal/IP readiness, and Awards visibility.")
    draw_footer(c, page, total)


def slide_close(c, page, total):
    draw_bg(c, TEAL)
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, 0.35 * inch, H, fill=1, stroke=0)
    draw_logo_plate(c, 0.7 * inch, H - 1.4 * inch, h=0.68 * inch, pad=10)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(0.7 * inch, H - 2.65 * inch, "Let’s build climate protection")
    c.drawString(0.7 * inch, H - 3.15 * inch, "that reaches the last mile.")

    c.setFont("Helvetica", 13)
    c.drawString(0.7 * inch, H - 3.7 * inch, "Ismael Kiprop  ·  Founder & CEO, FlowOps Africa")
    c.drawString(0.7 * inch, H - 4.05 * inch, "Njeri Leonida  ·  Project Coordinator")

    c.setFont("Helvetica", 12)
    c.drawString(0.7 * inch, 1.8 * inch, "hello@flowops.africa")
    c.drawString(0.7 * inch, 1.5 * inch, "www.flowops.africa  ·  alerts.flowops.africa")
    c.drawString(0.7 * inch, 1.2 * inch, "linkedin.com/company/climate-wavers-by-flowops-africa")
    c.setFont("Helvetica", 9)
    c.drawString(0.7 * inch, 0.5 * inch, f"YECO 2026/27 Pitch Deck  ·  {page}/{total}")


def main():
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    slides = [
        slide_cover,
        slide_problem,
        slide_solution,
        slide_product,
        slide_market,
        slide_model,
        slide_traction,
        slide_impact,
        slide_advantage,
        slide_team,
        slide_growth,
        slide_ask,
        slide_close,
    ]
    total = len(slides)
    for i, fn in enumerate(slides, start=1):
        fn(c, i, total)
        c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
