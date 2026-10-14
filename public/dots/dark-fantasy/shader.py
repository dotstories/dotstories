"""Dark fantasy shader: still(image, text) -> shaded title card."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

FONTS = Path(__file__).parent / "fonts"
PRESETS = {  # lantern, fog, darkness, grain
    "Cinematic Dusk": (80, 65, 60, True),
    "Midnight Murk": (92, 88, 78, True),
    "Twilight Clear": (60, 30, 40, False),
    "Violet Ghoststorm": (100, 96, 85, True),
}
DEFAULT = "Twilight Clear"
TEXT_SCALE = 1.5  # app text is web-sized; 1.5x keeps it readable on a YouTube thumbnail


# ---------- helpers ----------
def grid(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return x, y


def stops(t, colors):
    """CSS gradient: t (0..1+) -> RGBA float array, linear between (pos, (r,g,b,a))."""
    pos = [c[0] for c in colors]
    return np.stack([np.interp(t, pos, [c[1][i] for c in colors]) for i in range(4)], -1)


def over(base, layer):  # normal blend, straight alpha, float RGBA
    a = layer[..., 3:4]
    out_a = a + base[..., 3:4] * (1 - a)
    rgb = (layer[..., :3] * a + base[..., :3] * base[..., 3:4] * (1 - a)) / np.maximum(out_a, 1e-6)
    return np.concatenate([rgb, out_a], -1)


def img_filter(x, b, c):  # CSS brightness() then contrast()
    return np.clip((x * b - 0.5) * c + 0.5, 0, 1)


def settings(preset):
    lantern, fog, dark, grain = PRESETS[preset]
    b = 0.75 + lantern / 100 * 0.35 - dark / 100 * 0.25
    c = 1.05 + dark / 100 * 0.2
    return lantern, fog, dark, grain, b, c


# ---------- layers under the particles (lantern glow + ground mist) ----------
def under(w, h, lantern, fog):
    x, y = grid(w, h)
    V = lambda r, g, b, a: (r / 255, g / 255, b / 255, a)
    cx, cy = .40 * w, .75 * h  # ellipse at 40% 75%, farthest-corner
    rx, ry = max(cx, w - cx) * math.sqrt(2), max(cy, h - cy) * math.sqrt(2)
    e = stops(np.hypot((x - cx) / rx, (y - cy) / ry),
              [(0, V(168, 85, 247, .28)), (.35, V(147, 51, 234, .12)), (.7, V(147, 51, 234, 0))])
    cx, cy = .65 * w, .55 * h  # circle at 65% 55%
    c = stops(np.hypot(x - cx, y - cy) / math.hypot(max(cx, w - cx), max(cy, h - cy)),
              [(0, V(192, 132, 252, .22)), (.3, V(126, 34, 206, .08)), (.6, V(126, 34, 206, 0))])
    glow = over(e, c)
    glow[..., 3] *= lantern / 100
    m = stops(1 - y / h, [(0, V(30, 41, 59, .65)), (.35, V(15, 23, 42, .3)), (.7, V(15, 23, 42, 0))])
    m[..., 3] *= fog / 100
    return over(glow, m)


# ---------- particle canvas (screen blend) ----------
def canvas(w, h, lantern, fog, seed):
    rng, s = random.Random(seed), h / 700  # app viewport is ~700px tall
    out = np.zeros((h, w, 4), np.float32)
    for _ in range(int(45 * (fog / 50 + 0.5))):
        roll, px, py = rng.random(), rng.random() * w, rng.random() * h
        if roll < .35:
            size, amax = 2 + rng.random() * 5, .3 + rng.random() * .45
        elif roll < .45:
            size, amax = 1.5 + rng.random() * 3.5, .25 + rng.random() * .35
        else:
            size, amax = 20 + rng.random() * 60, .08 + rng.random() * .12
        a = amax * (0.6 + 0.4 * math.sin(rng.random() * 2 * math.pi))
        if roll < .35:
            k, r = lantern / 60, size * 3.5 * s
            cols = [(0, (232, 121, 249, a * k)), (.3, (168, 85, 247, a * .6 * k)), (1, (147, 51, 234, 0))]
        elif roll < .45:
            r = size * 2.5 * s
            cols = [(0, (253, 224, 71, a * .9)), (.4, (234, 179, 8, a * .4)), (1, (180, 83, 9, 0))]
        else:
            f, r = a * fog / 70, size * s
            cols = [(0, (180, 195, 220, f * .3)), (.5, (100, 116, 139, f * .15)), (1, (15, 23, 42, 0))]
        x0, x1, y0, y1 = [int(max(0, min(lim, v))) for v, lim in
                          ((px - r, w), (px + r + 1, w), (py - r, h), (py + r + 1, h))]
        if x1 <= x0 or y1 <= y0:
            continue
        x, y = grid(x1 - x0, y1 - y0)
        d = np.hypot(x + x0 - px, y + y0 - py) / r
        spot = stops(np.minimum(d, 1), [(p, (c[0] / 255, c[1] / 255, c[2] / 255, c[3])) for p, c in cols])
        spot[d > 1, 3] = 0
        out[y0:y1, x0:x1] = over(out[y0:y1, x0:x1], spot)
    return out


def screen(base_rgb, layer):
    a = layer[..., 3:4]
    return base_rgb * (1 - a) + (1 - (1 - base_rgb) * (1 - layer[..., :3])) * a


# ---------- layers over everything (vignette, bars, text) ----------
def edge_shadow(w, h):
    """box-shadow: inset 0 0 120px rgba(0,0,0,.85), inset 0 0 60px rgba(0,0,0,.6)."""
    x, y = grid(w, h)
    s = h / 700
    keep = np.ones((h, w), np.float32)
    for blur, a in ((120, .85), (60, .6)):
        sig = blur * s / 2
        for d in (x, w - 1 - x, y, h - 1 - y):
            keep *= 1 - a * 0.5 * (1 - np.tanh(d / sig * 0.8))  # blurred edge, like erfc
    return 1 - keep


def font(name, px, weight):
    try:
        f = ImageFont.truetype(str(FONTS / name), max(8, int(px)))
        f.set_variation_by_axes([weight])
        return f
    except OSError:
        return ImageFont.load_default(max(8, int(px)))  # fonts missing


def spaced(d, xy, text, f, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + track


def wrap(d, text, f, width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if line and d.textlength(test, font=f) > width:
            lines.append(line)
            line = word
        else:
            line = test
    return lines + [line]


def top(w, h, title, region, subtitle, quote, grain):
    u = h / 700 * TEXT_SCALE  # 1 app px
    x, y = grid(w, h)
    top_h, bot_h = (108 if subtitle else 88) * u, (40 + 23 * 2) * u
    bars = np.maximum(stops(y / top_h, [(0, (0, 0, 0, .8)), (.5, (0, 0, 0, .4)), (1, (0, 0, 0, 0))])[..., 3],
                      stops((h - y) / bot_h, [(0, (0, 0, 0, .9)), (.5, (0, 0, 0, .5)), (1, (0, 0, 0, 0))])[..., 3]
                      if quote else 0)
    a = 1 - (1 - edge_shadow(w, h)) * (1 - bars)
    layer = np.zeros((h, w, 4), np.float32)
    layer[..., 3] = a
    if grain:  # feTurbulence noise at 4%
        g = np.random.default_rng(1).random((h, w)).astype(np.float32)
        layer = over(layer, np.stack([g, g, g, np.full_like(g, .04)], -1))
    txt = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(txt)
    p, ty = 20 * u, 20 * u
    if region:
        r = 3 * u
        dot = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(dot).ellipse((p, ty + 8 * u - r, p + 2 * r, ty + 8 * u + r), fill=(192, 132, 252, 255))
        txt = Image.alpha_composite(txt, dot.filter(ImageFilter.GaussianBlur(4 * u)))
        d = ImageDraw.Draw(txt)
        d.ellipse((p, ty + 8 * u - r, p + 2 * r, ty + 8 * u + r), fill=(192, 132, 252, 255))
        spaced(d, (p + 2 * r + 8 * u, ty + 1 * u), region.upper(), font("Cinzel.ttf", 12 * u, 400),
               (192, 132, 252, 255), 1.2 * u)
        ty += 16 * u
    spaced(d, (p, ty), title, font("Cinzel.ttf", 24 * u, 700), (241, 245, 249, 255), 0.6 * u)
    ty += 34 * u
    if subtitle:
        d.text((p, ty), subtitle, font=font("CormorantItalic.ttf", 15 * u, 500), fill=(203, 213, 225, 230))
    if quote:
        f = font("CormorantItalic.ttf", 15 * u, 500)
        lines = wrap(d, f"“{quote}”", f, 576 * u)
        for i, line in enumerate(lines):
            d.text((p, h - 20 * u - (len(lines) - i) * 23 * u), line, font=f, fill=(203, 213, 225, 255))
    shadow = np.zeros((h, w, 4), np.float32)
    shadow[..., 3] = np.asarray(txt.getchannel("A").filter(ImageFilter.GaussianBlur(3 * u)), np.float32) / 255 * .5
    return over(over(layer, shadow), np.asarray(txt, np.float32) / 255)


# ---------- outputs ----------
def words(t):
    return [t.get(k, "") for k in ("title", "region", "subtitle", "quote")]


def still(hero, t, preset=DEFAULT, size=(1920, 1080), seed=7):
    """Shaded title card. t = dict with title, region, subtitle, quote."""
    lantern, fog, dark, grain, b, c = settings(preset)
    w, h = size
    base = np.asarray(Image.open(hero).convert("RGB").resize((w, h), Image.LANCZOS), np.float32) / 255
    base = np.concatenate([img_filter(base, b, c), np.ones((h, w, 1), np.float32)], -1)
    base = over(base, under(w, h, lantern, fog))
    base[..., :3] = screen(base[..., :3], canvas(w, h, lantern, fog, seed))
    out = over(base, top(w, h, *words(t), grain))[..., :3]
    return Image.fromarray((out * 255).astype(np.uint8))
