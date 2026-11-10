"""Draw the home-screen icons: a smiling star over a tiny piano."""

from pathlib import Path
import math

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"


def star_points(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    points = []
    for i in range(10):
        radius = outer if i % 2 == 0 else inner
        angle = -math.pi / 2 + i * math.pi / 5
        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def gradient(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    top = (255, 214, 120)
    bottom = (255, 107, 74)
    for y in range(size):
        t = y / max(1, size - 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        draw.line([(0, y), (size, y)], fill=color)
    return image


def draw_icon(size: int, inset: float) -> Image.Image:
    image = gradient(size)
    draw = ImageDraw.Draw(image)
    pad = size * inset
    inner = size - pad * 2

    key_top = pad + inner * 0.72
    key_bottom = pad + inner * 0.94
    key_left = pad + inner * 0.16
    key_right = pad + inner * 0.84
    key_w = (key_right - key_left) / 5
    for i in range(5):
        x0 = key_left + i * key_w + (1.5 if i else 0)
        x1 = key_left + (i + 1) * key_w - (1.5 if i < 4 else 0)
        draw.rounded_rectangle([x0, key_top, x1, key_bottom], radius=size * 0.018, fill=(255, 252, 247))
    black_w = key_w * 0.58
    black_h = (key_bottom - key_top) * 0.56
    for boundary in (1, 2, 4):
        x = key_left + boundary * key_w - black_w / 2
        draw.rounded_rectangle(
            [x, key_top, x + black_w, key_top + black_h],
            radius=size * 0.015,
            fill=(48, 42, 74),
        )

    cx = pad + inner * 0.5
    cy = pad + inner * 0.40
    outer = inner * 0.30
    draw.polygon(star_points(cx, cy, outer, outer * 0.46), fill=(255, 216, 74), outline=(240, 160, 32))
    eye_y = cy - outer * 0.02
    eye_dx = outer * 0.22
    eye_r = max(2, outer * 0.09)
    for sign in (-1, 1):
        ex = cx + sign * eye_dx
        draw.ellipse([ex - eye_r, eye_y - eye_r, ex + eye_r, eye_y + eye_r], fill=(74, 52, 40))
        draw.ellipse(
            [ex - eye_r * 0.15, eye_y - eye_r * 0.55, ex + eye_r * 0.35, eye_y - eye_r * 0.05],
            fill=(255, 255, 255),
        )
    draw.arc(
        [cx - outer * 0.26, cy + outer * 0.02, cx + outer * 0.26, cy + outer * 0.46],
        start=20,
        end=160,
        fill=(74, 52, 40),
        width=max(2, int(size * 0.022)),
    )
    blush_r = outer * 0.09
    for sign in (-1, 1):
        bx = cx + sign * outer * 0.38
        by = cy + outer * 0.12
        draw.ellipse([bx - blush_r, by - blush_r, bx + blush_r, by + blush_r], fill=(255, 138, 168, 220))
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(512, 0).save(OUT / "icon-512.png", optimize=True)
    draw_icon(192, 0).resize((192, 192), Image.Resampling.LANCZOS).save(OUT / "icon-192.png", optimize=True)
    draw_icon(512, 0.12).save(OUT / "icon-512-maskable.png", optimize=True)
    draw_icon(180, 0).resize((180, 180), Image.Resampling.LANCZOS).save(OUT / "apple-touch-icon.png", optimize=True)
    draw_icon(32, 0).resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "favicon-32.png", optimize=True)


if __name__ == "__main__":
    main()
