#!/usr/bin/env python3
"""Export Plastic Pulse one-pager as WhatsApp-friendly images + public/docs copies."""

from pathlib import Path
import shutil

import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parent
PDF = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.pdf"
PNG = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.png"
JPG = ROOT / "Climate_Wavers_Plastic_Pulse_Onboarding_One_Pager.jpg"
PUBLIC = ROOT.parent / "frontend" / "public" / "docs"


def main():
    if not PDF.exists():
        raise SystemExit(f"Missing PDF: {PDF}")

    pdf = pdfium.PdfDocument(str(PDF))
    page = pdf[0]
    pil = page.render(scale=2.5).to_pil()
    pil.save(PNG, "PNG", optimize=True)
    pil.convert("RGB").save(JPG, "JPEG", quality=88, optimize=True)

    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PDF, PUBLIC / PDF.name)
    shutil.copy2(JPG, PUBLIC / JPG.name)
    shutil.copy2(PNG, PUBLIC / PNG.name)

    print(f"PNG {PNG} ({PNG.stat().st_size} bytes)")
    print(f"JPG {JPG} ({JPG.stat().st_size} bytes)")
    print(f"Copied into {PUBLIC}")


if __name__ == "__main__":
    main()
