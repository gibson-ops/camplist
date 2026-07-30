#!/usr/bin/env python3
"""Build the Camp List brand masters (SVG) and app assets (PNG).

Run:  python build.py       (needs fonttools, uharfbuzz and resvg)
"""
import os
import re
import subprocess

import mark as M
import wordmark as WM

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BRAND = os.path.dirname(HERE)
ASSETS = os.path.join(REPO, "mobile", "assets")
SS3 = os.path.join(REPO, "node_modules", "@expo-google-fonts", "source-sans-3")
TMP = os.path.join(HERE, ".build")


def svg(w, h, body, bg=None, radius=None):
    if bg and radius:
        rect = f'<rect width="{w}" height="{h}" rx="{radius}" ry="{radius}" fill="{bg}"/>'
    elif bg:
        rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>'
    else:
        rect = ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">{rect}{body}</svg>')


def place(body, x, y, size):
    """Drop the 0..100 mark into a larger canvas, clipped to its own box."""
    return (f'<svg x="{x}" y="{y}" width="{size}" height="{size}" '
            f'viewBox="0 0 100 100">{body}</svg>')


def place_bleed(body, x, y, size):
    """Same placement, but without clipping at the mark's own box.

    A nested <svg> is a viewport, so it crops anything outside 0..100 and trims
    the contour overshoot back to the artwork edge. A group transform keeps the
    overshoot, which is what lets the lines run past the boundary a launcher
    masks against instead of stopping on it.
    """
    return f'<g transform="translate({x} {y}) scale({size/100.0})">{body}</g>'


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(content)
    return path


def render(src, dst, w, h):
    subprocess.run(["resvg", "--skip-system-fonts", "-w", str(w), "-h", str(h), src, dst],
                   check=True, capture_output=True)
    return dst


def icon_svg(theme, size=1024, radius=None):
    """A full-bleed icon: the mark fills the tile, because the contours bleed off
    every edge. There is no inset — insetting would break the 'window onto a map'
    reading that the bleed creates."""
    t = M.THEMES[theme]
    return svg(size, size, place(M.themed(theme), 0, 0, size),
               bg=t["tile"], radius=radius)


def main():
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(BRAND, exist_ok=True)

    # ---- Masters ----------------------------------------------------------
    # Square and opaque, with no baked corner radius: both platforms apply their
    # own mask and a pre-rounded source double-rounds.
    write(os.path.join(BRAND, "camplist-icon.svg"), icon_svg("dark"))
    write(os.path.join(BRAND, "camplist-icon-light.svg"), icon_svg("light"))
    # Pre-rounded, for web and documents where nothing masks it.
    write(os.path.join(BRAND, "camplist-icon-rounded.svg"), icon_svg("dark", radius=230))
    write(os.path.join(BRAND, "camplist-icon-light-rounded.svg"), icon_svg("light", radius=230))

    for name, theme in (("camplist-monogram", "dark"), ("camplist-monogram-light", "light"),
                        ("camplist-monogram-mono", "mono_light")):
        write(os.path.join(BRAND, name + ".svg"), svg(100, 100, M.themed(theme)))

    # ---- Wordmark ---------------------------------------------------------
    faces = {"700": WM.Face(os.path.join(SS3, "700Bold", "SourceSans3_700Bold.ttf"))}

    def lockup(theme, text_fill, bg=None):
        """`camplist` at 700, lowercase, one word, with the controls beside it.

        The contours are dropped here on purpose: next to type they read as
        texture rather than terrain and compete with the word. The controls alone
        still carry the list idea and sit quietly against the lowercase.
        """
        size = 104
        pad = 26
        baseline = pad + 104
        cw, chh, draw = M.controls_only(gap_scale=0.6)
        t = M.THEMES[theme]
        # Height matches the type's real ascender, measured off the outline of `l`,
        # so the stack is never taller than the tallest letter.
        _, ascender = WM.glyph_extent(faces["700"], "l", size)
        k = ascender / chh
        stack_w = cw * k
        # Centred on the word's own vertical extent rather than sat on the
        # baseline. The stack is a symmetrical object with no baseline of its own,
        # and `camplist` is lowercase with a descender, so baseline-aligning it
        # makes it look like it is floating above the word.
        tops = [WM.glyph_extent(faces["700"], c, size)[1] for c in "camplist"]
        bots = [WM.glyph_extent(faces["700"], c, size)[0] for c in "camplist"]
        word_mid = (max(tops) + min(bots)) / 2
        stack_top = baseline - word_mid - ascender / 2
        stack = (f'<g transform="translate({pad} {stack_top}) scale({k})">'
                 f'{draw(t["packed_fill"], t["stone"])}</g>')
        body_x = pad + stack_w + 16
        text_svg, text_w = WM.wordmark(faces, [("camplist", "700", text_fill)],
                                       size, body_x, baseline, letter_spacing=-0.8)
        return svg(int(body_x + text_w + pad), 200, stack + text_svg, bg=bg)

    write(os.path.join(BRAND, "camplist-wordmark.svg"), lockup("dark", M.BONE))
    write(os.path.join(BRAND, "camplist-wordmark-light.svg"), lockup("light", M.CHAR))

    # ---- App assets -------------------------------------------------------
    # iOS 18 takes three appearances. Light and dark are full-bleed and opaque;
    # the tinted layer is grayscale on transparent and the system supplies the
    # background, so it must not carry a tile of its own.
    p = write(os.path.join(TMP, "icon.svg"), icon_svg("dark"))
    render(p, os.path.join(ASSETS, "icon.png"), 1024, 1024)
    p = write(os.path.join(TMP, "icon-light.svg"), icon_svg("light"))
    render(p, os.path.join(ASSETS, "icon-light.png"), 1024, 1024)
    p = write(os.path.join(TMP, "icon-tinted.svg"),
              svg(1024, 1024, place(M.themed("mono_light"), 0, 0, 1024)))
    render(p, os.path.join(ASSETS, "icon-tinted.png"), 1024, 1024)

    # Web favicon, on a rounded tile since browsers do not mask it.
    p = write(os.path.join(TMP, "favicon.svg"), icon_svg("dark", size=256, radius=56))
    render(p, os.path.join(ASSETS, "favicon.png"), 64, 64)

    # Splash: the rounded tile on transparency, so it reads as the app icon
    # rather than a floating crop of contours.
    inset, box, corner = 112, 800, 180
    p = write(os.path.join(TMP, "splash-icon.svg"),
              svg(1024, 1024,
                  f'<defs><clipPath id="sp"><rect x="{inset}" y="{inset}" width="{box}" '
                  f'height="{box}" rx="{corner}" ry="{corner}"/></clipPath></defs>'
                  f'<g clip-path="url(#sp)">'
                  f'<rect x="{inset}" y="{inset}" width="{box}" height="{box}" fill="{M.CHARCOAL}"/>'
                  f'{place(M.themed("dark"), inset, inset, box)}</g>'))
    render(p, os.path.join(ASSETS, "splash-icon.png"), 1024, 1024)

    # Android adaptive icon. The 108dp canvas is masked down to a 72dp window, so
    # sizing the mark to that window makes Android frame the artwork the same way
    # iOS does, edge to edge, rather than floating it inside a safe-zone inset.
    # Placed without clipping, so the contour overshoot carries past the mask edge
    # and the lines bleed instead of stopping on the boundary.
    visible = 1024 * (72.0 / 108.0)
    off = (1024 - visible) / 2
    p = write(os.path.join(TMP, "android-icon-foreground.svg"),
              svg(1024, 1024, place_bleed(M.themed("dark"), off, off, visible)))
    render(p, os.path.join(ASSETS, "android-icon-foreground.png"), 1024, 1024)

    p = write(os.path.join(TMP, "android-icon-background.svg"),
              svg(1024, 1024, "", bg=M.CHARCOAL))
    render(p, os.path.join(ASSETS, "android-icon-background.png"), 1024, 1024)

    # Themed icons flatten this to one colour, so the mark is drawn in a single
    # tone. It survives because packed versus unpacked is a filled box versus an
    # outlined box, never a hue.
    p = write(os.path.join(TMP, "android-icon-monochrome.svg"),
              svg(1024, 1024, place_bleed(M.themed("mono_light"), off, off, visible)))
    render(p, os.path.join(ASSETS, "android-icon-monochrome.png"), 1024, 1024)

    # In-app wordmark art. Generated here so the lockup in the product can never
    # drift from the brand file: same geometry, same measured alignment, with the
    # colours left as parameters for the theme to supply.
    cw, chh, draw = M.controls_only(gap_scale=0.6)
    size = 104
    _, ascender = WM.glyph_extent(faces["700"], "l", size)
    k = ascender / chh
    tops = [WM.glyph_extent(faces["700"], c, size)[1] for c in "camplist"]
    bots = [WM.glyph_extent(faces["700"], c, size)[0] for c in "camplist"]
    word_top, word_bot, word_mid = max(tops), min(bots), (max(tops) + min(bots)) / 2
    stack_w = cw * k
    gap = 16
    body_x = stack_w + gap
    art_baseline = word_top
    text_svg, text_w = WM.wordmark(faces, [("camplist", "700", "__TEXT__")],
                                   size, body_x, art_baseline, letter_spacing=-0.8)
    stack_svg = (f'<g transform="translate(0 {art_baseline - word_mid - ascender/2:.3f}) '
                 f'scale({k:.5f})">{draw("__AMBER__", "__STONE__")}</g>')
    vb_w, vb_h = body_x + text_w, word_top - word_bot
    art = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:.2f} {vb_h:.2f}">'
           f'{stack_svg}{text_svg}</svg>')
    ts = ("// GENERATED by brand/generator/build.py. Do not edit by hand.\n"
          "//\n"
          "// The `camplist` lockup as outlined paths, so it needs no font at runtime and\n"
          "// matches brand/camplist-wordmark.svg exactly. Colours are substituted by the\n"
          "// caller, which is how the same art serves both schemes.\n\n"
          f"export const WORDMARK_ASPECT = {vb_w / vb_h:.4f};\n\n"
          "export function wordmarkSvg(c: { text: string; amber: string; stone: string }): string {\n"
          "  return ART.replace(/__TEXT__/g, c.text)\n"
          "    .replace(/__AMBER__/g, c.amber)\n"
          "    .replace(/__STONE__/g, c.stone);\n"
          "}\n\n"
          "const ART = " + repr(art).replace("'", "`", 2) + ";\n")
    ts = ts.replace(repr(art), "`" + art + "`")
    write(os.path.join(REPO, "mobile", "design", "wordmarkArt.ts"), ts)

    # Wordmark PNGs for docs and the web header
    for name, src in (("camplist-wordmark", lockup("dark", M.BONE, bg=M.CHARCOAL)),
                      ("camplist-wordmark-light", lockup("light", M.CHAR, bg=M.PAPER))):
        p = write(os.path.join(TMP, name + ".svg"), src)
        m = re.search(r'width="(\d+)" height="(\d+)"', src)
        render(p, os.path.join(BRAND, name + ".png"), int(m.group(1))*2, int(m.group(2))*2)

    print("brand masters ->", BRAND)
    print("app assets    ->", ASSETS)


if __name__ == "__main__":
    main()
