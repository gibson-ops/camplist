#!/usr/bin/env python3
"""Camp List logo exploration generator.

Emits SVG masters for four mark directions, plus home-screen and small-size
test compositions, then (via run_resvg in build.sh) rasterizes to PNG.

All glyphs are authored in a normalized 0..100 box so they can be dropped at
any size via a nested <svg viewBox>. Colors are passed in so the same mark can
be tinted for dark / light / monochrome contexts.
"""
import math

# ---- Palette (from DESIGN.md) --------------------------------------------
BASALT      = "#0a0b0c"   # dark app bg / dark icon tile
SLATE_STONE = "#202223"
RAISED      = "#2c2e2f"
CAIRN       = "#646668"   # hairline
BONE        = "#f4f5f6"
ASH         = "#b0b1b3"
PAPER       = "#f3f5f7"
CHALK       = "#fcfeff"
CHAR        = "#1c1d1e"
SLATE_TXT   = "#6f7072"
AMBER       = "#ffbb1b"
AMBER_L     = "#ffbd1f"
INK         = "#140e06"   # on-amber
STONE_ON_DARK  = "#8a8d90"  # neutral mark parts on a dark tile
STONE_ON_LIGHT = "#3a3c3e"  # neutral mark parts on a light tile


def rr(x, y, w, h, r, fill, extra=""):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" ry="{r}" fill="{fill}" {extra}/>'


def poly(points, fill):
    p = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
    return f'<polygon points="{p}" fill="{fill}"/>'


def hexstone(cx, cy, hw, hh, chamf, fill):
    """A flat, beveled stone (elongated hexagon)."""
    pts = [
        (cx - hw, cy),
        (cx - hw + chamf, cy - hh),
        (cx + hw - chamf, cy - hh),
        (cx + hw, cy),
        (cx + hw - chamf, cy + hh),
        (cx - hw + chamf, cy + hh),
    ]
    return poly(pts, fill)


# ---- The four marks -------------------------------------------------------
# Each returns SVG inner markup for a 0..100 viewBox.
# C = dict(amber=, stone=, ink=)

def mark_blaze(C):
    """A — Offset double blaze: the trail-turn marker. Wayfinding, not scenery."""
    a = C["amber"]
    return (
        rr(24, 40, 25, 45, 6.5, a)      # lower blaze (bottom-left)
        + rr(51, 15, 25, 45, 6.5, a)    # upper blaze (top-right)
    )


def mark_cairn(C):
    """B — Stacked stones: accumulated route knowledge, amber crown = the next trip."""
    a, s = C["amber"], C["stone"]
    return (
        hexstone(50, 70, 28, 9.5, 11, s)   # base
        + hexstone(52.5, 49, 22, 8.5, 9, s)  # middle
        + hexstone(47, 29, 15.5, 8, 7, a)    # amber cap
    )


def mark_carabiner(C):
    """C — Carabiner-C: gear, and the brand letter. A closed loop = nothing lost."""
    a = C["amber"]
    cx, cy, rx, ry = 50, 50, 27, 31
    sw = 15.5
    # opening on the right, centered on 0deg, half-gap 34deg
    g = math.radians(34)
    x1, y1 = cx + rx * math.cos(g), cy + ry * math.sin(g)     # lower-right terminal
    x2, y2 = cx + rx * math.cos(-g), cy + ry * math.sin(-g)   # upper-right terminal
    path = (
        f'<path d="M {x1:.2f} {y1:.2f} '
        f'A {rx} {ry} 0 1 1 {x2:.2f} {y2:.2f}" '
        f'fill="none" stroke="{a}" stroke-width="{sw}" stroke-linecap="round"/>'
    )
    # gate: short spring bar bridging the mouth, offset inward
    gate = rr(63.5, 42.5, 7.5, 15, 3.75, a)
    return path + gate


def mark_manifest(C):
    """D — Field manifest: the item-row distilled. State control + name line, top one packed."""
    a, s = C["amber"], C["stone"]
    line = C.get("line", s)
    rows = [(28, 78), (50, 71), (72, 62)]  # (y-center, line right edge)
    out = []
    for i, (yc, rt) in enumerate(rows):
        y = yc - 8
        if i == 0:
            out.append(rr(18, y, 16, 16, 4, a))                 # packed state (amber fill)
        else:
            out.append(rr(18.5, y + 0.5, 15, 15, 3.5, "none",   # empty state (outline)
                          extra=f'stroke="{s}" stroke-width="3"'))
        out.append(rr(41, yc - 4, rt - 41, 8, 4, line))         # name line
    return "".join(out)


MARKS = {
    "blaze":     ("The Blaze",     "Offset trail-turn marker. Pure wayfinding: the route continues.", mark_blaze),
    "cairn":     ("The Cairn",     "Stacked stones, amber crown. Knowledge that accumulates every trip.", mark_cairn),
    "carabiner": ("The Carabiner", "Gear, and the C of Camp List. A closed loop: nothing left behind.", mark_carabiner),
    "manifest":  ("The Manifest",  "The item row distilled. A sibling to the Lucide set in-app.", mark_manifest),
}


def colors_for(context):
    """context: 'dark' | 'light' | 'mono'"""
    if context == "dark":
        return dict(amber=AMBER, stone="#aeb1b4", line="#6a6d70", ink=INK)
    if context == "light":
        # amber cannot carry the mark on light, so neutral parts go dark;
        # amber stays only where it is a fill accent.
        return dict(amber=AMBER_L, stone=STONE_ON_LIGHT, line="#8c8f92", ink=INK)
    # monochrome: single ink color, everything one tone
    c = context.split(":", 1)[1]
    return dict(amber=c, stone=c, line=c, ink=c)


def nested(glyph_svg, x, y, size):
    return (f'<svg x="{x}" y="{y}" width="{size}" height="{size}" '
            f'viewBox="0 0 100 100">{glyph_svg}</svg>')


def icon_tile(kind, x, y, size, tile_bg, context, radius_frac=0.225,
              hairline=None, shadow=False):
    """A full app-icon tile: rounded bg + centered mark at ~62%."""
    C = colors_for(context)
    glyph = MARKS[kind][2](C)
    r = size * radius_frac
    mark = size * 0.62
    mx = x + (size - mark) / 2
    my = y + (size - mark) / 2
    out = []
    if shadow:
        out.append(f'<rect x="{x}" y="{y+size*0.02}" width="{size}" height="{size}" '
                   f'rx="{r}" ry="{r}" fill="#000000" opacity="0.18"/>')
    out.append(f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{r}" ry="{r}" fill="{tile_bg}"/>')
    if hairline:
        out.append(f'<rect x="{x+0.5}" y="{y+0.5}" width="{size-1}" height="{size-1}" '
                   f'rx="{r}" ry="{r}" fill="none" stroke="{hairline}" stroke-width="1"/>')
    out.append(nested(glyph, mx, my, mark))
    return "".join(out)


def svg_header(w, h, bg):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="{bg}"/>')


def text(x, y, s, size, fill, weight=600, ls=0, anchor="start", opacity=1):
    return (f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" letter-spacing="{ls}" text-anchor="{anchor}" '
            f'opacity="{opacity}">{s}</text>')
