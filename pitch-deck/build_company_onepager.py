#!/usr/bin/env python3
"""Branded one-page company sheet: FlowOps Africa + Climate Wavers."""

from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.colors import HexColor, white, Color
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
PREP = ASSETS / "_prep_company"
PREP.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "FlowOps_Africa_Climate_Wavers_Company_One_Pager.pdf"

TEAL = HexColor("#067d83")
TEAL_DARK = HexColor("#055a5f")
TEAL_SOFT = HexColor("#E6F3F4")
INK = HexColor("#1A2B2B")
MUTED = HexColor("#4F6F6F")
LINE = HexColor("#D5E3E4")
NAVY = HexColor("#0B1C1E")
FLOWOPS_BG = HexColor("#050505")

W, H = 297 * mm, 210 * mm


def wrap(c, text, font, size, width):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        test = (cur + " " + word).strip()
        if c.stringWidth(test, font, size) <= width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def draw_lines(c, lines, x, y, font, size, leading, color):
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def prep_flowops_logo() -> Path:
    """Keep FlowOps mark readable: square logo on intentional black plate asset."""
    src = ASSETS / "Flowops_Logo.png"
    dest = PREP / "flowops_clean.png"
    im = PILImage.open(src).convert("RGBA")
    im.thumbnail((520, 520))
    im.save(dest)
    return dest


def prep_hero() -> Path:
    src = ASSETS / "og-image.jpg"
    dest = PREP / "hero.jpg"
    im = PILImage.open(src).convert("RGB")
    # slight left crop for title weight in the strip
    w, h = im.size
    im = im.crop((0, int(h * 0.08), w, int(h * 0.92)))
    im.save(dest, "JPEG", quality=90)
    return dest


def card(c, x, y, w, h, title, lines):
    c.setFillColor(TEAL_SOFT)
    c.roundRect(x, y, w, h, 3, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 3.2 * mm, y + h - 5.2 * mm, title)
    yy = y + h - 10 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica", 7.5)
    for line in lines:
        c.drawString(x + 3.2 * mm, yy, line)
        yy -= 3.6 * mm


def main():
    flowops = prep_flowops_logo()
    hero = prep_hero()
    cw_logo = ASSETS / "Logo.png"
    mark = ASSETS / "mark.png"

    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("FlowOps Africa · Climate Wavers — Company One-Pager")
    c.setAuthor("FlowOps Africa")

    # Paper
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # Top brand bar
    c.setFillColor(TEAL)
    c.rect(0, H - 12 * mm, W, 12 * mm, fill=1, stroke=0)
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, 4.2 * mm, H, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(10 * mm, H - 7.6 * mm, "FLOWOPS AFRICA")
    c.setFont("Helvetica", 8)
    c.drawCentredString(W / 2, H - 7.6 * mm, "Climate technology · Nairobi, Kenya")
    c.drawRightString(W - 10 * mm, H - 7.6 * mm, "Company one-pager  ·  2026")

    # Logo row
    logo_y = H - 42 * mm
    # FlowOps plate
    plate_w, plate_h = 38 * mm, 28 * mm
    c.setFillColor(FLOWOPS_BG)
    c.roundRect(10 * mm, logo_y, plate_w, plate_h, 3, fill=1, stroke=0)
    c.drawImage(
        str(flowops),
        10 * mm + 3 * mm,
        logo_y + 2.5 * mm,
        width=plate_w - 6 * mm,
        height=plate_h - 5 * mm,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )

    # Climate Wavers wordmark on light plate
    cw_plate_x = 52 * mm
    c.setFillColor(TEAL_SOFT)
    c.roundRect(cw_plate_x, logo_y + 4 * mm, 48 * mm, 20 * mm, 3, fill=1, stroke=0)
    if cw_logo.exists():
        c.drawImage(
            str(cw_logo),
            cw_plate_x + 4 * mm,
            logo_y + 7.5 * mm,
            width=40 * mm,
            height=13 * mm,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )

    # Title block
    title_x = 106 * mm
    c.setFillColor(TEAL)
    c.setFont("Helvetica", 8)
    c.drawString(title_x, H - 20 * mm, "The company and the product")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(title_x, H - 27.5 * mm, "FlowOps Africa")
    c.setFillColor(TEAL_DARK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(title_x, H - 33.5 * mm, "Climate Wavers")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8.5)
    tag = "Disaster alerts. Community response. Climate action."
    c.drawString(title_x, H - 39 * mm, tag)

    # Hero visual
    hero_y = H - 88 * mm
    hero_h = 42 * mm
    c.setFillColor(NAVY)
    c.roundRect(10 * mm, hero_y, W - 20 * mm, hero_h, 3, fill=1, stroke=0)
    c.drawImage(
        str(hero),
        10 * mm,
        hero_y,
        width=W - 20 * mm,
        height=hero_h,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )
    # Soft left wash so brand line stays readable if needed
    c.setFillColor(Color(0.02, 0.08, 0.09, alpha=0.35))
    c.rect(10 * mm, hero_y, 55 * mm, hero_h, fill=1, stroke=0)

    # Three loop cards
    loop_y = hero_y - 36 * mm
    loop_h = 30 * mm
    gap = 3.2 * mm
    loop_w = (W - 20 * mm - 2 * gap) / 3
    cards = [
        (
            "1. Detect",
            [
                "Live USGS and NASA feeds",
                "Source-tagged hazard map",
                "Community reports beside",
                "official signals",
            ],
        ),
        (
            "2. Verify",
            [
                "Human review before send",
                "Community Champions",
                "Confidence and source labels",
                "Rumour risk reduced first",
            ],
        ),
        (
            "3. Activate",
            [
                "RapidBrief responder desks",
                "WhatsApp and email alerts",
                "Tree Admin restoration partners",
                "Last-mile local action",
            ],
        ),
    ]
    x = 10 * mm
    for title, lines in cards:
        card(c, x, loop_y, loop_w, loop_h, title, lines)
        x += loop_w + gap

    # Bottom two columns
    col_top = loop_y - 7 * mm
    left_x = 10 * mm
    left_w = 145 * mm
    right_x = 162 * mm
    right_w = W - right_x - 10 * mm

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(left_x, col_top, "What we build")
    products = [
        ("Climate Wavers", "Live disaster alert platform for climate-vulnerable communities."),
        ("RapidBrief", "Approved NGO and CBO desks receive location-aware dispatch."),
        ("Community Champions", "Training and certification for last-mile verification."),
        ("Tree Admin", "Verified nurseries and CBOs; supporters fund trees at 18% platform fee."),
    ]
    yy = col_top - 5 * mm
    for name, body in products:
        c.setFillColor(TEAL)
        c.circle(left_x + 1.4 * mm, yy + 1.5, 1.5, fill=1, stroke=0)
        c.setFillColor(TEAL_DARK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(left_x + 4.5 * mm, yy, name)
        name_w = c.stringWidth(name, "Helvetica-Bold", 8)
        c.setFillColor(INK)
        c.setFont("Helvetica", 7.5)
        c.drawString(left_x + 5.5 * mm + name_w, yy, "  " + body)
        yy -= 5.2 * mm

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(left_x, yy - 1 * mm, "Who we serve")
    yy -= 6 * mm
    audiences = [
        "B2C: individuals and Champions who need nearby, verified alerts.",
        "B2NGO: CBOs and NGOs on RapidBrief desks after approval.",
        "B2G: counties and institutions needing multi-seat coverage.",
    ]
    for item in audiences:
        c.setFillColor(TEAL)
        c.circle(left_x + 1.4 * mm, yy + 1.5, 1.5, fill=1, stroke=0)
        yy = draw_lines(
            c,
            wrap(c, item, "Helvetica", 7.5, left_w - 5 * mm),
            left_x + 4.5 * mm,
            yy,
            "Helvetica",
            7.5,
            9,
            INK,
        )
        yy -= 1.8 * mm

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(left_x, yy - 1 * mm, "How it pays")
    yy -= 5.5 * mm
    model = [
        "Communities stay free. RapidBrief: free pilot, then paid desks.",
        "Tree marketplace: 18% platform fee, 82% to verified partners.",
        "FlowOps Partner: custom WhatsApp, AI setup, training, and support.",
    ]
    for item in model:
        c.setFillColor(TEAL)
        c.circle(left_x + 1.4 * mm, yy + 1.5, 1.5, fill=1, stroke=0)
        yy = draw_lines(
            c,
            wrap(c, item, "Helvetica", 7.5, left_w - 5 * mm),
            left_x + 4.5 * mm,
            yy,
            "Helvetica",
            7.5,
            9,
            INK,
        )
        yy -= 1.6 * mm

    # Right rail: team + contact
    rail_bottom = 14 * mm
    rail_top = col_top + 2 * mm
    c.setFillColor(TEAL_SOFT)
    c.roundRect(right_x, rail_bottom, right_w, rail_top - rail_bottom, 3, fill=1, stroke=0)

    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x + 3.5 * mm, col_top - 4 * mm, "Leadership")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(right_x + 3.5 * mm, col_top - 9.5 * mm, "Ismael Kiprop")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.2)
    c.drawString(right_x + 3.5 * mm, col_top - 13.2 * mm, "Founder & CEO")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(right_x + 3.5 * mm, col_top - 19.5 * mm, "Njeri Leonida")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.2)
    c.drawString(right_x + 3.5 * mm, col_top - 23.2 * mm, "Project Coordinator")

    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(right_x + 3.5 * mm, col_top - 27 * mm, right_x + right_w - 3.5 * mm, col_top - 27 * mm)

    c.setFillColor(TEAL)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x + 3.5 * mm, col_top - 32.5 * mm, "Live products")
    c.setFillColor(INK)
    c.setFont("Helvetica", 7.5)
    links = [
        "alerts.flowops.africa",
        "www.flowops.africa",
        "Disaster-alert verification research",
    ]
    ly = col_top - 38 * mm
    for item in links:
        c.drawString(right_x + 3.5 * mm, ly, item)
        ly -= 4.2 * mm

    # CTA plate
    c.setFillColor(TEAL)
    c.roundRect(right_x + 3 * mm, 18 * mm, right_w - 6 * mm, 18 * mm, 3, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x + 5.5 * mm, 30.5 * mm, "Talk to us")
    c.setFont("Helvetica", 7.5)
    c.drawString(right_x + 5.5 * mm, 25.5 * mm, "hello@flowops.africa")
    c.drawString(right_x + 5.5 * mm, 21.2 * mm, "Nairobi, Kenya")

    # Footer
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(10 * mm, 9.5 * mm, W - 10 * mm, 9.5 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(
        10 * mm,
        5.2 * mm,
        "FlowOps Africa  ·  Climate Wavers  ·  Verify first. Send second.",
    )
    c.drawRightString(
        W - 10 * mm,
        5.2 * mm,
        "linkedin.com/company/climate-wavers-by-flowops-africa",
    )

    if mark.exists():
        c.drawImage(
            str(mark),
            W - 22 * mm,
            H - 40 * mm,
            width=10 * mm,
            height=5.5 * mm,
            mask="auto",
            preserveAspectRatio=True,
        )

    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
