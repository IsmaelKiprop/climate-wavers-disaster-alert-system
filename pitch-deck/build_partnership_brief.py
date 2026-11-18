#!/usr/bin/env python3
"""One-page Climate Wavers x OKOA Youth Self Help Group partnership brief."""

from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OKOA = ASSETS / "okoa"
OUT = ROOT / "OKOA_Youth_Climate_Wavers_Partnership_Brief.pdf"
PREP = OKOA / "_prep"
PREP.mkdir(parents=True, exist_ok=True)

TEAL = HexColor("#067d83")
TEAL_DARK = HexColor("#055a5f")
TEAL_SOFT = HexColor("#E6F3F4")
INK = HexColor("#1A2B2B")
MUTED = HexColor("#4F6F6F")
LINE = HexColor("#D5E3E4")
PAPER = HexColor("#F7FAFA")

W, H = 297 * mm, 210 * mm


def crop_fill(src: Path, dest: Path, ratio: float, anchor: float = 0.5, box=None) -> Path:
    im = PILImage.open(src).convert("RGB")
    if box:
        im = im.crop(box)
    w, h = im.size
    current = w / float(h)
    if abs(current - ratio) > 0.01:
        if current > ratio:
            new_w = int(h * ratio)
            left = max(0, (w - new_w) // 2)
            im = im.crop((left, 0, left + new_w, h))
        else:
            new_h = int(w / ratio)
            top = int((h - new_h) * anchor)
            top = max(0, min(top, h - new_h))
            im = im.crop((0, top, w, top + new_h))
    im.thumbnail((1600, 1600))
    im.save(dest, "JPEG", quality=86)
    return dest


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


def photo(c, path, x, y, w, h):
    c.setFillColor(HexColor("#E8EEEE"))
    c.rect(x, y, w, h, fill=1, stroke=0)
    c.drawImage(str(path), x, y, w, h, preserveAspectRatio=False, anchor="c", mask="auto")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.rect(x, y, w, h, fill=0, stroke=1)


def main():
    gap = 3.2 * mm
    photo_h = 42 * mm
    photo_w = (W - 20 * mm - 2 * gap) / 3
    frame_ratio = photo_w / photo_h
    planting = crop_fill(OKOA / "g2.jpg", PREP / "planting.jpg", frame_ratio, 0.42)
    rows = crop_fill(OKOA / "cover.jpg", PREP / "rows.jpg", frame_ratio, 0.38)
    member = crop_fill(OKOA / "g5.jpg", PREP / "member.jpg", frame_ratio, 0.12)

    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("Climate Wavers partnership brief: OKOA Youth Self Help Group")
    c.setAuthor("FlowOps Africa")

    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    c.setFillColor(TEAL)
    c.rect(0, H - 11 * mm, W, 11 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(10 * mm, H - 7.2 * mm, "CLIMATE WAVERS")
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 10 * mm, H - 7.2 * mm, "Partnership brief  ·  18 November 2026")

    # Logos and title
    logo = ASSETS / "Logo.png"
    if logo.exists():
        c.drawImage(str(logo), 10 * mm, H - 24 * mm, width=28 * mm, height=10 * mm, mask="auto", preserveAspectRatio=True, anchor="w")
    okoa_logo = OKOA / "logo.jpg"
    c.drawImage(str(okoa_logo), 42 * mm, H - 26.2 * mm, width=16 * mm, height=16 * mm, mask="auto", preserveAspectRatio=True, anchor="c")

    c.setFillColor(TEAL)
    c.setFont("Helvetica", 8)
    c.drawString(62 * mm, H - 16.5 * mm, "Proposed collaboration")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(62 * mm, H - 22.5 * mm, "OKOA Youth Self Help Group")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8.5)
    c.drawString(
        62 * mm,
        H - 27 * mm,
        "Mangrove restoration, Shimoni-Vanga. Listed in Lungalunga, Kwale County. Mark: OKOA Youth Group, Chiromo.",
    )

    # Photographs
    photo_y = H - 78 * mm
    frames = [
        (planting, "Planting day in the mud"),
        (rows, "Seedling rows at the restoration site"),
        (member, "OKOA member in the nursery plot"),
    ]
    x = 10 * mm
    for path, caption in frames:
        photo(c, path, x, photo_y, photo_w, photo_h)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.5)
        c.drawString(x, photo_y - 3.6 * mm, caption)
        x += photo_w + gap

    # Fact chips
    chip_y = photo_y - 16.5 * mm
    chip_h = 11 * mm
    chip_w = (W - 20 * mm - 3 * gap) / 4
    chips = [
        ("50,000+", "Seedlings in nursery, group report"),
        ("10,000+", "Already planted, group report"),
        ("50,000", "Platform target: Rhizophora and Bruguiera"),
        ("USD 1", "Listed price. 82% to the project"),
    ]
    x = 10 * mm
    for value, label in chips:
        c.setFillColor(TEAL_SOFT)
        c.roundRect(x, chip_y, chip_w, chip_h, 2, fill=1, stroke=0)
        c.setFillColor(TEAL_DARK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 2.4 * mm, chip_y + 6.2 * mm, value)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.5)
        c.drawString(x + 2.4 * mm, chip_y + 2.4 * mm, label)
        x += chip_w + gap

    note = (
        "Nursery and planted figures come from OKOA's own project description. "
        "The Climate Wavers counters for trees planted and funds raised are still zero. "
        "This brief does not treat the group's figures as an independent audit. "
        "The project was verified on the platform on 15 November 2026."
    )
    y = chip_y - 4.2 * mm
    y = draw_lines(c, wrap(c, note, "Helvetica", 7, W - 20 * mm), 10 * mm, y, "Helvetica", 7, 9, MUTED)

    # Two columns
    col_top = y - 4 * mm
    left_x = 10 * mm
    left_w = 118 * mm
    right_x = 134 * mm
    right_w = W - right_x - 10 * mm

    # Platform screenshot
    shot_h = 36 * mm
    shot = crop_fill(
        OKOA / "platform-top.png",
        PREP / "platform.jpg",
        left_w / shot_h,
        box=(96, 96, 968, 432),
    )
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, col_top, "Platform")
    photo(c, shot, left_x, col_top - shot_h - 3 * mm, left_w, shot_h)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(left_x, col_top - shot_h - 6.4 * mm, "Live page: alerts.flowops.africa/p/5")

    facts_y = col_top - shot_h - 11 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left_x, facts_y, "What the listing already says")
    facts = [
        "Active mangrove restoration project for OKOA Youth Self Help Group.",
        "Species targets on the listing: Rhizophora 20,000 and Bruguiera 30,000.",
        "Listed absorption rate: 22 kg CO2 per tree per year. That is a rate on the record, not a measured total.",
        "Listed contact: +254 707 196299. Climate Wavers: hello@flowops.africa.",
    ]
    facts_y -= 4.2 * mm
    for item in facts:
        c.setFillColor(TEAL)
        c.circle(left_x + 1.3 * mm, facts_y + 1.4, 1.3, fill=1, stroke=0)
        facts_y = draw_lines(
            c,
            wrap(c, item, "Helvetica", 7.5, left_w - 5 * mm),
            left_x + 4 * mm,
            facts_y,
            "Helvetica",
            7.5,
            9.2,
            INK,
        )
        facts_y -= 1.4 * mm

    # Proposal
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right_x, col_top, "Proposed pilot: December 2026 to May 2027")
    steps = [
        (
            "1",
            "Shared record",
            "Keep the verified page as the public record. After each planting day, OKOA posts one photo update with the site name and how many seedlings left the nursery.",
        ),
        (
            "2",
            "Gifts",
            "Supporters fund trees at the listed USD 1. 82% is recorded to the project and 18% is the platform fee. Nothing is promised before a payment clears.",
        ),
        (
            "3",
            "Coastal notes",
            "When a USGS or NASA event matters for the Kwale coast, Climate Wavers sends the listed contact a source-tagged WhatsApp or email note. It names the source and what is still unconfirmed. It is not a siren, and it does not say all clear.",
        ),
        (
            "4",
            "One review",
            "Climate Wavers and OKOA review photo evidence for one planting site and publish a short note. Survival rates wait until a sample is counted.",
        ),
    ]
    sy = col_top - 5 * mm
    for num, title, body in steps:
        c.setFillColor(TEAL)
        c.roundRect(right_x, sy - 1.2 * mm, 4.2 * mm, 4.2 * mm, 1, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(right_x + 2.1 * mm, sy, num)
        c.setFillColor(TEAL_DARK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(right_x + 6 * mm, sy, title)
        sy -= 3.6 * mm
        sy = draw_lines(
            c,
            wrap(c, body, "Helvetica", 7.5, right_w - 6 * mm),
            right_x + 6 * mm,
            sy,
            "Helvetica",
            7.5,
            9,
            INK,
        )
        sy -= 2.2 * mm

    c.setFillColor(TEAL_SOFT)
    ask_h = 12 * mm
    c.roundRect(right_x, 12 * mm, right_w, ask_h, 2, fill=1, stroke=0)
    c.setFillColor(TEAL_DARK)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(right_x + 2.2 * mm, 12 * mm + ask_h - 4 * mm, "Before gifts are promoted")
    ask = "OKOA confirms the nursery and planted figures on a simple count sheet, and names two site leads."
    draw_lines(
        c,
        wrap(c, ask, "Helvetica", 7, right_w - 4.4 * mm),
        right_x + 2.2 * mm,
        12 * mm + ask_h - 7.4 * mm,
        "Helvetica",
        7,
        8.4,
        INK,
    )

    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(10 * mm, 8.2 * mm, W - 10 * mm, 8.2 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(10 * mm, 4.4 * mm, "FlowOps Africa, Nairobi  ·  hello@flowops.africa  ·  www.flowops.africa")
    c.drawRightString(W - 10 * mm, 4.4 * mm, "Photographs from the OKOA project gallery")

    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
