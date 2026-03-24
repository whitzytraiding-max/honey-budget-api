#!/usr/bin/env python3

from pathlib import Path
from subprocess import run, DEVNULL
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
TMP_DIR = Path("/tmp")

CREAM = (255, 247, 239, 255)
PEACH = (255, 232, 220, 255)
HONEY = (255, 205, 77, 255)
CORAL = (255, 141, 98, 255)
PLUM = (95, 53, 68, 255)


def rasterize_svg(source: Path, target: Path) -> None:
    run(
      ["sips", "-s", "format", "png", str(source), "--out", str(target)],
      check=True,
      stdout=DEVNULL,
    )


def resize_png(source: Path, target: Path, size: int) -> None:
    image = Image.open(source).convert("RGBA")
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    resized.save(target)


def make_gradient_square(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), CREAM)
    draw = ImageDraw.Draw(image)

    for y in range(size):
        blend = y / max(1, size - 1)
        r = int(CREAM[0] * (1 - blend) + PEACH[0] * blend)
        g = int(CREAM[1] * (1 - blend) + PEACH[1] * blend)
        b = int(CREAM[2] * (1 - blend) + PEACH[2] * blend)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.ellipse(
      (-size * 0.12, -size * 0.08, size * 0.42, size * 0.36),
      fill=(255, 215, 110, 70),
    )
    overlay_draw.ellipse(
      (size * 0.58, size * 0.02, size * 1.08, size * 0.48),
      fill=(255, 170, 145, 55),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=size * 0.035))
    image.alpha_composite(overlay)
    return image


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size=size, index=1 if bold else 0)
            except Exception:
                continue
    return ImageFont.load_default()


def build_splash_asset(size: tuple[int, int], mark_png: Path, target: Path) -> None:
    width, height = size
    canvas = make_gradient_square(max(width, height)).resize((width, height), Image.Resampling.LANCZOS)

    mark = Image.open(mark_png).convert("RGBA")
    mark_size = int(min(width, height) * 0.36)
    mark = mark.resize((mark_size, mark_size), Image.Resampling.LANCZOS)

    shadow = Image.new("RGBA", mark.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((10, 18, mark.size[0] - 10, mark.size[1] - 4), fill=(122, 59, 48, 60))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(8, mark_size // 24)))

    mark_x = (width - mark_size) // 2
    mark_y = int(height * 0.22)
    canvas.alpha_composite(shadow, (mark_x, mark_y + int(mark_size * 0.7)))
    canvas.alpha_composite(mark, (mark_x, mark_y))

    draw = ImageDraw.Draw(canvas)
    title_font = load_font(max(48, width // 16), bold=True)
    subtitle_font = load_font(max(26, width // 34), bold=False)

    title = "Honey Budget"
    subtitle = "For Couples"
    title_box = draw.textbbox((0, 0), title, font=title_font)
    subtitle_box = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    title_x = (width - (title_box[2] - title_box[0])) // 2
    subtitle_x = (width - (subtitle_box[2] - subtitle_box[0])) // 2
    title_y = int(mark_y + mark_size + height * 0.05)
    subtitle_y = title_y + (title_box[3] - title_box[1]) + max(18, height // 60)

    draw.text((title_x, title_y), title, font=title_font, fill=PLUM)
    draw.text((subtitle_x, subtitle_y), subtitle, font=subtitle_font, fill=(115, 76, 90, 255))

    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target)


def build_export_icons(mark_png: Path, app_icon_png: Path) -> None:
    export_dir = ROOT / "branding" / "icon-exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    export_specs = [
        ("app-store-ios-1024.png", app_icon_png, 1024),
        ("google-play-512.png", app_icon_png, 512),
        ("pwa-512.png", app_icon_png, 512),
        ("pwa-192.png", app_icon_png, 192),
        ("favicon-64.png", mark_png, 64),
        ("brand-mark-1024.png", mark_png, 1024),
        ("brand-mark-512.png", mark_png, 512),
    ]

    for filename, source, size in export_specs:
      resize_png(source, export_dir / filename, size)

    readme = export_dir / "README.md"
    readme.write_text(
        "\n".join(
            [
                "# Honey Budget Icon Exports",
                "",
                "- `app-store-ios-1024.png`: iOS App Store marketing icon",
                "- `google-play-512.png`: Google Play icon",
                "- `pwa-512.png`: PWA icon",
                "- `pwa-192.png`: small PWA icon",
                "- `favicon-64.png`: favicon / quick web icon",
                "- `brand-mark-1024.png`: icon-only source export",
                "- `brand-mark-512.png`: icon-only source export",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    brand_mark_svg = FRONTEND / "public" / "icons" / "brand-mark.svg"
    app_icon_svg = FRONTEND / "public" / "icons" / "app-icon.svg"
    brand_mark_png = TMP_DIR / "honey-brand-mark.png"
    app_icon_png = TMP_DIR / "honey-app-icon.png"

    rasterize_svg(brand_mark_svg, brand_mark_png)
    rasterize_svg(app_icon_svg, app_icon_png)

    build_splash_asset(
        (2732, 2732),
        brand_mark_png,
        FRONTEND / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset" / "splash-2732x2732.png",
    )
    build_splash_asset(
        (2732, 2732),
        brand_mark_png,
        FRONTEND / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset" / "splash-2732x2732-1.png",
    )
    build_splash_asset(
        (2732, 2732),
        brand_mark_png,
        FRONTEND / "ios" / "App" / "App" / "Assets.xcassets" / "Splash.imageset" / "splash-2732x2732-2.png",
    )

    android_specs = [
        ("drawable", (480, 320)),
        ("drawable-port-mdpi", (200, 320)),
        ("drawable-port-hdpi", (320, 480)),
        ("drawable-port-xhdpi", (480, 720)),
        ("drawable-port-xxhdpi", (720, 1280)),
        ("drawable-port-xxxhdpi", (1280, 1920)),
        ("drawable-land-mdpi", (320, 200)),
        ("drawable-land-hdpi", (480, 320)),
        ("drawable-land-xhdpi", (720, 480)),
        ("drawable-land-xxhdpi", (1280, 720)),
        ("drawable-land-xxxhdpi", (1920, 1280)),
    ]

    for directory, size in android_specs:
        build_splash_asset(
            size,
            brand_mark_png,
            FRONTEND / "android" / "app" / "src" / "main" / "res" / directory / "splash.png",
        )

    build_export_icons(brand_mark_png, app_icon_png)


if __name__ == "__main__":
    main()
