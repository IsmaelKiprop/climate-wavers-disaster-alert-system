#!/usr/bin/env python3
"""Export Plastic Pulse one-pager as WhatsApp-friendly images + public/docs copies."""

from pathlib import Path
import shutil

import pypdfium2 as pdfium
from PIL import Image

ROOT = Path(__file__).resolve().parent
PDF = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.pdf"
PNG = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.png"
JPG = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.jpg"
OG = ROOT / "plastic-pulse-og.jpg"
PUBLIC = ROOT.parent / "frontend" / "public" / "docs"


def make_og(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGB")
    target_w, target_h = 1200, 630
    ratio = target_w / target_h
    w, h = im.size
    cur = w / float(h)
    if cur > ratio:
        new_w = int(h * ratio)
        left = (w - new_w) // 2
        im = im.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / ratio)
        top = max(0, (h - new_h) // 5)
        im = im.crop((0, top, w, top + new_h))
    im = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
    im.save(dest, "JPEG", quality=90, optimize=True)


def main():
    if not PDF.exists():
        raise SystemExit(f"Missing PDF: {PDF}")

    pdf = pdfium.PdfDocument(str(PDF))
    page = pdf[0]
    pil = page.render(scale=2.5).to_pil()
    pil.save(PNG, "PNG", optimize=True)
    pil.convert("RGB").save(JPG, "JPEG", quality=88, optimize=True)
    make_og(JPG, OG)

    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PDF, PUBLIC / PDF.name)
    shutil.copy2(JPG, PUBLIC / JPG.name)
    shutil.copy2(PNG, PUBLIC / PNG.name)
    shutil.copy2(OG, PUBLIC / OG.name)

    print(f"PNG {PNG} ({PNG.stat().st_size} bytes)")
    print(f"JPG {JPG} ({JPG.stat().st_size} bytes)")
    print(f"OG  {OG} ({OG.stat().st_size} bytes)")
    print(f"Copied into {PUBLIC}")


if __name__ == "__main__":
    main()
