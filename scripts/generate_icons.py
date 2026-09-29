"""Genera los iconos PWA de J.A.R.V.I.S. (punto líquido sobre azul marino).
Uso: python3 scripts/generate_icons.py   (requiere Pillow)"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def make(size, maskable=False, radius_ratio=0.0):
    S = size * 4  # supersampling
    img = Image.new("RGBA", (S, S))
    top, bottom = (0x0A, 0x19, 0x2F), (0x00, 0x11, 0x22)
    d = ImageDraw.Draw(img)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bottom, y / S) + (255,))
    # glow
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    r_dot = S * (0.20 if maskable else 0.26)
    cx = cy = S / 2
    g.ellipse([cx - r_dot * 1.9, cy - r_dot * 1.9, cx + r_dot * 1.9, cy + r_dot * 1.9], fill=(100, 255, 218, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.06))
    img = Image.alpha_composite(img, glow)
    # dot with radial gradient
    dot = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dot)
    steps = 120
    hx, hy = cx - r_dot * 0.3, cy - r_dot * 0.35
    for i in range(steps, 0, -1):
        t = i / steps
        rr = r_dot * t
        col = lerp((0x9D, 0xF5, 0xE3), (0x1B, 0x8F, 0x86), t ** 1.4)
        ox = cx + (hx - cx) * (1 - t)
        oy = cy + (hy - cy) * (1 - t)
        dd.ellipse([ox - rr, oy - rr, ox + rr, oy + rr], fill=col + (255,))
    img = Image.alpha_composite(img, dot)
    if radius_ratio:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=int(S * radius_ratio), fill=255)
        img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)

make(192).save(os.path.join(OUT, "icon-192.png"))
make(512).save(os.path.join(OUT, "icon-512.png"))
make(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
make(180).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
make(32).save(os.path.join(OUT, "favicon-32.png"))
print("icons ok")
