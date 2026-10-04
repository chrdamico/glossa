from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(exist_ok=True)

BG = "#26222f"
SS = 4


def render(size, scale=1.0, rounded=True):
    s = size * SS
    u = s / 64
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=14 * u, fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)

    def p(x, y):
        return (32 + (x - 32) * scale) * u, (32 + (y - 32) * scale) * u

    k = scale * u
    cx, cy = p(22, 24)
    d.ellipse([cx - 9 * k, cy - 9 * k, cx + 9 * k, cy + 9 * k], fill="#e2553f")
    d.polygon([p(42, 15), p(52, 32), p(32, 32)], fill="#4d86ec")
    d.rounded_rectangle([*p(14, 42), *p(50, 47)], radius=2.5 * k, fill="#e2b65a")
    return img.resize((size, size), Image.LANCZOS)


def main():
    render(512).save(OUT / "icon-512.png")
    render(192).save(OUT / "icon-192.png")
    render(512, 0.72, rounded=False).save(OUT / "maskable-512.png")
    render(180, 0.85, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
    render(32).save(OUT / "favicon-32.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
