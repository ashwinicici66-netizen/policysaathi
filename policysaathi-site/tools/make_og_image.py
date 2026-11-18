#!/usr/bin/env python3
"""
tools/make_og_image.py — builds assets/og-image.png (1200x630) with zero dependencies.
It writes the PNG by hand (zlib + CRC) and renders the text from a built-in 5x7
bitmap font, so no Pillow / canvas / font files are needed.

Usage: python3 tools/make_og_image.py
"""
import os, zlib, struct

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "og-image.png")

NAVY_DARK = (11, 43, 69)      # #0b2b45
NAVY = (22, 81, 124)          # #16517c
AMBER = (245, 158, 11)        # #f59e0b
AMBER_LT = (255, 205, 120)
WHITE = (255, 255, 255)
MUTED = (169, 186, 203)

FONT = {
 "A": ".###. #...# #...# ##### #...# #...# #...#",
 "B": "####. #...# #...# ####. #...# #...# ####.",
 "C": ".#### #.... #.... #.... #.... #.... .####",
 "D": "####. #...# #...# #...# #...# #...# ####.",
 "E": "##### #.... #.... ####. #.... #.... #####",
 "F": "##### #.... #.... ####. #.... #.... #....",
 "G": ".#### #.... #.... #..## #...# #...# .####",
 "H": "#...# #...# #...# ##### #...# #...# #...#",
 "I": "##### ..#.. ..#.. ..#.. ..#.. ..#.. #####",
 "L": "#.... #.... #.... #.... #.... #.... #####",
 "M": "#...# ##.## #.#.# #...# #...# #...# #...#",
 "N": "#...# ##..# #.#.# #..## #...# #...# #...#",
 "O": ".###. #...# #...# #...# #...# #...# .###.",
 "P": "####. #...# #...# ####. #.... #.... #....",
 "R": "####. #...# #...# ####. #.#.. #..#. #...#",
 "S": ".#### #.... #.... .###. ....# ....# ####.",
 "T": "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
 "U": "#...# #...# #...# #...# #...# #...# .###.",
 "V": "#...# #...# #...# #...# #...# .#.#. ..#..",
 "Y": "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
 "0": ".###. #...# #..## #.#.# ##..# #...# .###.",
 "2": ".###. #...# ....# ...#. ..#.. .#... #####",
 "4": "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
 " ": "..... ..... ..... ..... ..... ..... .....",
 "\u2022": "..... ..#.. .###. ##### .###. ..#.. .....",
 ".": "..... ..... ..... ..... ..... .##.. .##..",
}
GLYPH = {k: v.split() for k, v in FONT.items()}


def px(buf, x, y, rgb, a=1.0):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        if a >= 1:
            buf[i:i + 3] = bytes(rgb)
        else:
            for c in range(3):
                buf[i + c] = int(buf[i + c] * (1 - a) + rgb[c] * a)


def rect(buf, x0, y0, x1, y1, rgb, a=1.0):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            px(buf, x, y, rgb, a)


def rounded_rect(buf, x0, y0, x1, y1, r, rgb):
    rect(buf, x0 + r, y0, x1 - r, y1, rgb)
    rect(buf, x0, y0 + r, x1, y1 - r, rgb)
    for cy, cx in ((y0 + r, x0 + r), (y0 + r, x1 - r), (y1 - r, x0 + r), (y1 - r, x1 - r)):
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    px(buf, x, y, rgb)


def text(buf, s, x, y, scale, rgb, spacing=1):
    cx = x
    for ch in s.upper():
        g = GLYPH.get(ch, GLYPH[" "])
        for ry, row in enumerate(g):
            for rx, cell in enumerate(row):
                if cell == "#":
                    rect(buf, cx + rx * scale, y + ry * scale,
                         cx + rx * scale + scale, y + ry * scale + scale, rgb)
        cx += (5 + spacing) * scale
    return cx


def text_width(s, scale, spacing=1):
    return len(s) * (5 + spacing) * scale - spacing * scale


def main():
    buf = bytearray(W * H * 3)

    # background: diagonal navy gradient + soft amber glow (top-right)
    gx, gy, gr = 1080, 60, 620
    for y in range(H):
        for x in range(W):
            t = (x * 0.55 + y * 0.75) / (W * 0.55 + H * 0.75)
            r = int(NAVY_DARK[0] + (NAVY[0] - NAVY_DARK[0]) * t)
            g = int(NAVY_DARK[1] + (NAVY[1] - NAVY_DARK[1]) * t)
            b = int(NAVY_DARK[2] + (NAVY[2] - NAVY_DARK[2]) * t)
            d = ((x - gx) ** 2 + (y - gy) ** 2) ** 0.5
            glow = max(0.0, 1 - d / gr) ** 2 * 0.34
            r = int(r + (245 - r) * glow)
            g = int(g + (158 - g) * glow)
            b = int(b + (11 - b) * glow)
            i = (y * W + x) * 3
            buf[i:i + 3] = bytes((r, g, b))

    # faint grid lines for texture
    for x in range(60, W, 60):
        for y in range(H):
            px(buf, x, y, WHITE, 0.018)
    for y in range(60, H, 60):
        for x in range(W):
            px(buf, x, y, WHITE, 0.018)

    # badge with "PS"
    bx, by, bs = 80, 80, 96
    rounded_rect(buf, bx, by, bx + bs, by + bs, 24, AMBER)
    text(buf, "PS", bx + 15, by + 27, 6, NAVY_DARK)

    # wordmark + strapline, aligned with the badge
    text(buf, "POLICYSAATHI", bx + bs + 28, by + 16, 7, WHITE, spacing=1)
    text(buf, "INSURANCE IN PLAIN LANGUAGE", bx + bs + 28, by + 16 + 7 * 7 + 14, 4, MUTED, spacing=1)

    # headline (two lines, second in amber)
    hx, hy, hs = 80, 272, 11
    line_h = hs * 7
    text(buf, "SURRENDER VALUE", hx, hy, hs, WHITE, spacing=1)
    text(buf, "CALCULATOR", hx, hy + line_h + 22, hs, AMBER_LT, spacing=1)

    # accent rule + tagline
    ry = hy + 2 * line_h + 48
    rect(buf, hx, ry, hx + 190, ry + 6, AMBER)
    text(buf, "FREE \u2022 NO SIGNUP \u2022 IRDAI 2024 MINIMUM RULES", hx, ry + 32, 4, MUTED, spacing=1)

    # corner mark
    u = "POLICYSAATHI.IN"
    text(buf, u, W - text_width(u, 4) - 80, H - 64, 4, WHITE, spacing=1)

    write_png(OUT, buf)
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


def write_png(path, buf):
    raw = bytearray()
    stride = W * 3
    for y in range(H):
        raw.append(0)
        raw += buf[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    main()
