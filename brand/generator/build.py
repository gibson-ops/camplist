#!/usr/bin/env python3
"""Build the Camp List brand masters (SVG) and the app assets (PNG).

The mark is "the saddle": three contour lines cropped from a terrain field, each
beginning at a packing-list state control. The geometry is extracted once here
and baked into static SVG paths, so the shipped artwork carries no dependency on
this generator.

Run:  python build.py   (needs fonttools + uharfbuzz + resvg)
"""
import os
import subprocess

import terrain as topolib
import mark as S
import wordmark as WM

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BRAND = os.path.join(REPO, "brand")
ASSETS = os.path.join(REPO, "mobile", "assets")
SS3 = os.path.join(REPO, "node_modules", "@expo-google-fonts", "source-sans-3")

# ---- Palette (DESIGN.md) --------------------------------------------------
BASALT = "#0a0b0c"
BONE = "#f4f5f6"
CHAR = "#1c1d1e"
PAPER = "#f3f5f7"
AMBER = "#ffbb1b"
AMBER_L = "#ffbd1f"
STONE_DARK = "#aeb1b4"   # contour lines on a dark tile
STONE_LIGHT = "#3a3c3e"  # contour lines on a light tile

# ---- The locked mark ------------------------------------------------------
MARK = dict(X0=60, W=52, box=(24, 92, 12, 88), n=3,
            line_w=3.5, ctrl_size=(16, 15, 14), ctrl_stroke=2.4,
            gap=5.0, cap="butt", right_inset=6.0, align_controls=True,
            amber_line=True)

# An optical cut for small surfaces. Same drawing, heavier: the master's 3.5-unit
# lines fall below a pixel once the mark is under about 40px, so the favicon and
# notification sizes get thicker strokes and larger boxes rather than a blurred
# downscale of the master.
MARK_SMALL = dict(MARK, line_w=6.0, ctrl_size=(20, 19, 18), ctrl_stroke=3.6,
                  gap=4.0, right_inset=3.0)


def build_mark(field, stone, amber, amber_line=True, params=None):
    """Mark markup in a 0..100 box, with the palette swapped for the context."""
    orig_stone, orig_amber = S.STONE, S.AMBER
    S.STONE, S.AMBER = stone, amber
    try:
        return S.saddle_v3(field, **{**(params or MARK), "amber_line": amber_line})
    finally:
        S.STONE, S.AMBER = orig_stone, orig_amber


def svg(w, h, body, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">{rect}{body}</svg>')


def place(mark, x, y, size):
    return (f'<svg x="{x}" y="{y}" width="{size}" height="{size}" '
            f'viewBox="0 0 100 100">{mark}</svg>')


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(content)
    return path


def render(src, dst, w, h):
    subprocess.run(["resvg", "--skip-system-fonts", "-w", str(w), "-h", str(h), src, dst],
                   check=True, capture_output=True)
    return dst


def main():
    field = topolib.Field()
    dark = build_mark(field, STONE_DARK, AMBER)
    light = build_mark(field, STONE_LIGHT, AMBER_L)
    mono_light = build_mark(field, BONE, BONE, amber_line=False)   # one color, light-on-dark
    mono_dark = build_mark(field, CHAR, CHAR, amber_line=False)    # one color, dark-on-light
    small = build_mark(field, STONE_DARK, AMBER, params=MARK_SMALL)

    os.makedirs(BRAND, exist_ok=True)
    tmp = os.path.join(HERE, ".build")
    os.makedirs(tmp, exist_ok=True)

    # ---- Masters ----------------------------------------------------------
    # App icon: square and opaque. No baked corner radius, because iOS and
    # Android both apply their own mask; a pre-rounded source double-rounds.
    icon = svg(1024, 1024, place(dark, 192, 192, 640), bg=BASALT)
    write(os.path.join(BRAND, "camplist-icon.svg"), icon)

    # A pre-rounded version for web and documents, where nothing masks it.
    rounded = svg(1024, 1024,
                  f'<rect width="1024" height="1024" rx="230" ry="230" fill="{BASALT}"/>'
                  + place(dark, 192, 192, 640))
    write(os.path.join(BRAND, "camplist-icon-rounded.svg"), rounded)

    # Monogram: the mark alone, transparent, for favicons and small surfaces.
    write(os.path.join(BRAND, "camplist-monogram.svg"), svg(100, 100, dark))
    write(os.path.join(BRAND, "camplist-monogram-light.svg"), svg(100, 100, light))
    write(os.path.join(BRAND, "camplist-monogram-mono.svg"), svg(100, 100, mono_light))
    write(os.path.join(BRAND, "camplist-monogram-small.svg"), svg(100, 100, small))

    # ---- Wordmark ---------------------------------------------------------
    faces = {
        "800": WM.Face(os.path.join(SS3, "800ExtraBold", "SourceSans3_800ExtraBold.ttf")),
        "400": WM.Face(os.path.join(SS3, "400Regular", "SourceSans3_400Regular.ttf")),
    }

    def make_wordmark(mark, text_fill, bg=None):
        """Mark at cap height, then 'Camp List' in the product's own typeface."""
        size = 112               # cap height of the type
        mark_size = 132          # the mark sits a little taller than the caps
        pad = 28
        baseline = 150
        mx, my = pad, baseline - mark_size + 18
        body_x = mx + mark_size + 34
        text_svg, text_w = WM.wordmark(
            faces, [("Camp ", "800", text_fill), ("List", "400", text_fill)],
            size, body_x, baseline, letter_spacing=-0.6)
        total_w = int(body_x + text_w + pad)
        total_h = 200
        return svg(total_w, total_h, place(mark, mx, my, mark_size) + text_svg, bg=bg)

    write(os.path.join(BRAND, "camplist-wordmark.svg"), make_wordmark(dark, BONE))
    write(os.path.join(BRAND, "camplist-wordmark-light.svg"), make_wordmark(light, CHAR))

    # ---- App assets -------------------------------------------------------
    # iOS / general app icon
    p = write(os.path.join(tmp, "icon.svg"), icon)
    render(p, os.path.join(ASSETS, "icon.png"), 1024, 1024)

    # Web favicon: the small optical cut, on a rounded Basalt tile since browsers
    # do not mask it. Exported at 64 so a retina tab (16 CSS px, 32 device px)
    # downsamples from close to its native size instead of from a 256 master.
    fav = svg(256, 256,
              f'<rect width="256" height="256" rx="56" ry="56" fill="{BASALT}"/>'
              + place(small, 40, 40, 176))
    p = write(os.path.join(tmp, "favicon.svg"), fav)
    render(p, os.path.join(ASSETS, "favicon.png"), 64, 64)

    # Splash: transparent so it sits on whatever background the splash uses.
    splash = svg(1024, 1024, place(dark, 232, 232, 560))
    p = write(os.path.join(tmp, "splash-icon.svg"), splash)
    render(p, os.path.join(ASSETS, "splash-icon.png"), 1024, 1024)

    # Android adaptive icon. The launcher crops to a 72/108 mask and only the
    # central 66/108 is guaranteed visible, so the foreground art is scaled to
    # sit inside that safe circle rather than filling the canvas.
    safe = int(1024 * 0.60)
    off = (1024 - safe) // 2
    fg = svg(1024, 1024, place(dark, off, off, safe))
    p = write(os.path.join(tmp, "android-icon-foreground.svg"), fg)
    render(p, os.path.join(ASSETS, "android-icon-foreground.png"), 1024, 1024)

    bg = svg(1024, 1024, "", bg=BASALT)
    p = write(os.path.join(tmp, "android-icon-background.svg"), bg)
    render(p, os.path.join(ASSETS, "android-icon-background.png"), 1024, 1024)

    # Monochrome layer: themed icons flatten this to a single color, so the mark
    # is drawn in one tone. It still reads because the states differ in SHAPE
    # (filled box versus outlined box), not only in color.
    mono = svg(1024, 1024, place(mono_light, off, off, safe))
    p = write(os.path.join(tmp, "android-icon-monochrome.svg"), mono)
    render(p, os.path.join(ASSETS, "android-icon-monochrome.png"), 1024, 1024)

    # Wordmark PNGs for docs and the web header
    for name, src_svg in (("camplist-wordmark", make_wordmark(dark, BONE, bg=BASALT)),
                          ("camplist-wordmark-light", make_wordmark(light, CHAR, bg=PAPER))):
        p = write(os.path.join(tmp, name + ".svg"), src_svg)
        import re
        m = re.search(r'width="(\d+)" height="(\d+)"', src_svg)
        w, h = int(m.group(1)), int(m.group(2))
        render(p, os.path.join(BRAND, name + ".png"), w * 2, h * 2)

    print("brand masters ->", BRAND)
    print("app assets    ->", ASSETS)


if __name__ == "__main__":
    main()
