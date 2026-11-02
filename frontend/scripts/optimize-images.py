from pathlib import Path
from PIL import Image

public = Path("public")


def fit(im, max_w):
    im = im.convert("RGB")
    w, h = im.size
    if w > max_w:
        h = int(h * max_w / w)
        im = im.resize((max_w, h), Image.Resampling.LANCZOS)
    return im


heroes = [
    "ai-disaster.jpg",
    "emergency-response.jpg",
    "community-respond.jpg",
    "environment.jpg",
]
for name in heroes:
    src = Image.open(public / name)
    fit(src, 1600).save(public / name, "JPEG", quality=76, optimize=True, progressive=True)
    fit(src, 960).save(
        public / f"{Path(name).stem}-sm.jpg",
        "JPEG",
        quality=72,
        optimize=True,
        progressive=True,
    )

logo = Image.open(public / "logo.jpg")
fit(logo, 192).save(public / "logo.jpg", "JPEG", quality=82, optimize=True, progressive=True)

print("--- after ---")
for name in [
    "logo.jpg",
    "ai-disaster.jpg",
    "ai-disaster-sm.jpg",
    "emergency-response.jpg",
    "emergency-response-sm.jpg",
    "community-respond.jpg",
    "community-respond-sm.jpg",
    "environment.jpg",
    "environment-sm.jpg",
]:
    f = public / name
    print(f"{name:40} {f.stat().st_size / 1024:8.1f} KB")
