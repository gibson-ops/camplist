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
        """`camplist` set in Source Sans 3 at 700, lowercase, one word."""
        size = 104
        tile = 128
        pad = 26
        baseline = pad + tile * 0.80
        body_x = pad + tile + 30
        text_svg, text_w = WM.wordmark(faces, [("camplist", "700", text_fill)],
                                       size, body_x, baseline, letter_spacing=-0.8)
        t = M.THEMES[theme]
        tile_svg = (f'<svg x="{pad}" y="{baseline - tile*0.80}" width="{tile}" height="{tile}" '
                    f'viewBox="0 0 100 100">'
                    f'<defs><clipPath id="lk"><rect width="100" height="100" rx="22.5"/></clipPath></defs>'
                    f'<g clip-path="url(#lk)"><rect width="100" height="100" fill="{t["tile"]}"/>'
                    f'{M.themed(theme)}</g></svg>')
        return svg(int(body_x + text_w + pad), 200, tile_svg + text_svg, bg=bg)

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
