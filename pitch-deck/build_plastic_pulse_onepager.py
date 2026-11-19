#!/usr/bin/env python3
"""Branded one-pager: Climate Wavers Plastic Pulse — onboard CBOs & plastic partners."""

from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.colors import HexColor, white, Color
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
PREP = ASSETS / "_prep_plastic"
PREP.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.pdf"

TEAL = HexColor("#067d83")
TEAL_DARK = HexColor("#055a5f")
TEAL_SOFT = HexColor("#E6F3F4")
INK = HexColor("#1A2B2B")
MUTED = HexColor("#4F6F6F")
LINE = HexColor("#D5E3E4")
NAVY = HexColor("#0B1C1E")
FLOWOPS_BG = HexColor("#050505")
AMBER = HexColor("#B45309")

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
    w, h = im.size
    im = im.crop((0, int(h * 0.10), w, int(h * 0.90)))
    im.save(dest, "JPEG", quality=90)
    return dest


def soft_card(c, x, y, w, h, title, lines, accent=TEAL):
    c.setFillColor(TEAL_SOFT)
    c.roundRect(x, y, w, h, 3, fill=1, stroke=0)
    c.setFillColor(accent)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x + 3 * mm, y + h - 5 * mm, title)
    yy = y + h - 9.5 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica", 7.2)
    for line in lines:
        c.drawString(x + 3 * mm, yy, line)
        yy -= 3.5 * mm


def main():
    flowops = prep_flowops_logo()
    hero = prep_hero()
    cw_logo = ASSETS / "Logo.png"

    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("Climate Wavers Plastic Pulse — Partner Onboarding One-Pager")
    c.setAuthor("FlowOps Africa")

    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # Brand bar
    c.setFillColor(TEAL)
    c.rect(0, H - 11 * mm, W, 11 * mm, fill=1, stroke=0)
    c.setFillColor(TEAL_DARK)
    c.rect(0, 0, 4 * mm, H, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(10 * mm, H - 7.2 * mm, "CLIMATE WAVERS  ·  PLASTIC PULSE")
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 10 * mm, H - 7.2 * mm, "Partner onboarding  ·  2026")

    # Logo row
    logo_y = H - 36 * mm
    c.setFillColor(FLOWOPS_BG)
    c.roundRect(10 * mm, logo_y, 32 * mm, 20 * mm, 2.5, fill=1, stroke=0)
    c.drawImage(
        str(flowops),
        12 * mm,
        logo_y + 2 * mm,
        width=28 * mm,
        height=16 * mm,
        preserveAspectRatio=True,
        anchor="c",
        mask="auto",
    )
    c.setFillColor(TEAL_SOFT)
    c.roundRect(46 * mm, logo_y + 2 * mm, 40 * mm, 16 * mm, 2.5, fill=1, stroke=0)
    if cw_logo.exists():
        c.drawImage(
            str(cw_logo),
            49 * mm,
            logo_y + 4.5 * mm,
            width=34 * mm,
            height=11 * mm,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )

    c.setFillColor(TEAL)
    c.setFont("Helvetica", 8)
    c.drawString(92 * mm, H - 18 * mm, "Invite for CBOs, youth groups, recyclers & sponsors")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(92 * mm, H - 25.5 * mm, "Turn plastic recovery into verified climate action")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8.5)
    c.drawString(
        92 * mm,
        H - 31.5 * mm,
        "Real-time GPS proof · live kg · certificates · scrap + sponsor revenue on Climate Wavers",
    )

    # Hero strip with overlay copy
    hero_y = H - 72 * mm
    hero_h = 32 * mm
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
    c.setFillColor(Color(0.02, 0.08, 0.09, alpha=0.55))
    c.roundRect(10 * mm, hero_y, W - 20 * mm, hero_h, 3, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(16 * mm, hero_y + 19 * mm, "Plastic Pulse")
    c.setFont("Helvetica", 8.5)
    c.drawString(
        16 * mm,
        hero_y + 12 * mm,
        "From street hotspot → youth collection → CBO verify → recycler intake → sponsor certificate",
    )
    c.setFont("Helvetica", 7.5)
    c.drawString(
        16 * mm,
        hero_y + 6 * mm,
        "Built for African CBOs and youth groups already planting trees with Climate Wavers — same org, second impact loop.",
    )

    # Flow steps
    step_y = hero_y - 34 * mm
    step_h = 28 * mm
    gap = 2.8 * mm
    step_w = (W - 20 * mm - 4 * gap) / 5
    steps = [
        ("1. Spot", ["Pin plastic hotspot", "Photo + GPS", "Flag drain / flood risk"]),
        ("2. Collect", ["Youth / crew claims", "Bag ID + kg + media", "Works offline, then syncs"]),
        ("3. Verify", ["CBO admin reviews", "Approve or reject", "Trust before payment"]),
        ("4. Intake", ["Recycler scans bag", "Locks verified kg", "Chain of custody closed"]),
        ("5. Earn", ["Sponsor pays /kg", "Scrap buy-back", "Points + certificate"]),
    ]
    x = 10 * mm
    for title, lines in steps:
        soft_card(c, x, step_y, step_w, step_h, title, lines)
        x += step_w + gap

    # Three audience columns
    col_top = step_y - 7 * mm
    col_gap = 3.5 * mm
    col_w = (W - 20 * mm - 2 * col_gap) / 3
    cols = [
        (
            "For CBOs & youth groups",
            [
                "Use your existing Tree Admin org — no second signup.",
                "Run live plastic projects with public share links.",
                "Verify field proof and issue impact certificates.",
                "Receive sponsor share via M-Pesa / bank (same payout rails).",
                "Show scrap market rates vs sponsor impact price clearly.",
            ],
        ),
        (
            "For recyclers & aggregators",
            [
                "Join as a listed intake partner with live buy rates.",
                "Confirm bags by ID — only real kg enter the ledger.",
                "Get cleaner, pre-sorted supply from organised crews.",
                "Optional small MRV fee for verified digital proof.",
                "Data ready for EPR reporting conversations later.",
            ],
        ),
        (
            "For sponsors & brands",
            [
                "Sponsor verified kilos — not promises.",
                "Public certificate + GPS / photo trail.",
                "Fund drain cleanups that reduce flood risk.",
                "Earn Wavers Points (10% of sponsored USD).",
                "CSR story you can share on WhatsApp instantly.",
            ],
        ),
    ]
    x = 10 * mm
    for title, bullets in cols:
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x, col_top, title)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.7)
        c.line(x, col_top - 1.8 * mm, x + col_w, col_top - 1.8 * mm)
        yy = col_top - 6.5 * mm
        for b in bullets:
            c.setFillColor(TEAL)
            c.circle(x + 1.2 * mm, yy + 1.3, 1.3, fill=1, stroke=0)
            yy = draw_lines(
                c,
                wrap(c, b, "Helvetica", 7.2, col_w - 5 * mm),
                x + 4 * mm,
                yy,
                "Helvetica",
                7.2,
                8.8,
                INK,
            )
            yy -= 1.8 * mm
        x += col_w + col_gap

    # Money strip
    money_y = 28 * mm
    c.setFillColor(TEAL_SOFT)
    c.roundRect(10 * mm, money_y, W - 20 * mm, 22 * mm, 3, fill=1, stroke=0)
    c.setFillColor(TEAL_DARK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(14 * mm, money_y + 15.5 * mm, "How money moves (real market)")
    money_bits = [
        "Sponsor-a-kilo: impact price (e.g. $0.80–$2/kg) above scrap · ~18% platform fee · rest to CBO",
        "Scrap buy-back: PET ~KES 15–28/kg · HDPE ~KES 20–25/kg (local rates; partners set live prices)",
        "Wavers Points: same wallet as trees — sponsors earn 10%; crews earn 5 pts/kg after recycler intake",
    ]
    yy = money_y + 10.5 * mm
    for bit in money_bits:
        c.setFillColor(INK)
        c.setFont("Helvetica", 7)
        for line in wrap(c, "•  " + bit, "Helvetica", 7, W - 30 * mm):
            c.drawString(14 * mm, yy, line)
            yy -= 3.4 * mm

    # Footer CTA
    c.setFillColor(TEAL)
    c.rect(0, 0, W, 18 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(10 * mm, 10.5 * mm, "Onboard now")
    c.setFont("Helvetica", 8)
    c.drawString(
        10 * mm,
        5.5 * mm,
        "Tree Admins: alerts.flowops.africa/app/admin/plastic   ·   Apply: alerts.flowops.africa/tree-admins/apply",
    )
    c.setFont("Helvetica", 7.5)
    c.drawRightString(W - 10 * mm, 10.5 * mm, "hello@flowops.africa")
    c.drawRightString(W - 10 * mm, 5.5 * mm, "Built by FlowOps Africa · Nairobi")

    # Small amber note top-right of money? skip - keep clean

    c.save()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
