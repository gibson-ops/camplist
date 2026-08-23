#!/usr/bin/env python3
"""Compose the comparison sheets from gen.py primitives."""
import os
from gen import (
    MARKS, icon_tile, nested, colors_for, svg_header, text, rr,
    BASALT, PAPER, CHALK, SLATE_STONE, RAISED, CAIRN, BONE, ASH, CHAR,
    SLATE_TXT, AMBER, AMBER_L, INK,
)

OUT = os.path.join(os.path.dirname(__file__), "out")
ORDER = ["blaze", "cairn", "carabiner", "manifest"]


def wordmark(x, baseline, camp_size, fill, weight_camp=800, weight_list=400, ls=-0.5):
    return (
        f'<text x="{x}" y="{baseline}" font-size="{camp_size}" letter-spacing="{ls}" fill="{fill}">'
        f'<tspan font-weight="{weight_camp}">Camp </tspan>'
        f'<tspan font-weight="{weight_list}">List</tspan></text>'
    )


def write(name, svg):
    path = os.path.join(OUT, name + ".svg")
    with open(path, "w") as f:
        f.write(svg + "</svg>")
    return path


# --------------------------------------------------------------------------
# Sheet 1: directions overview
# Each row: dark icon | light icon | lockup wordmark | name + rationale
# --------------------------------------------------------------------------
def sheet_directions():
    W, H = 1500, 1180
    rowh = 250
    top = 140
    s = svg_header(W, H, BASALT)
    s += text(60, 74, "Camp List", 34, BONE, 800, -0.5)
    s += text(60, 110, "Four directions for the mark. Judge them small; the icon is the hard case.", 19, ASH, 400)
    s += f'<line x1="60" y1="128" x2="{W-60}" y2="128" stroke="{RAISED}" stroke-width="1"/>'

    isz = 180
    for i, k in enumerate(ORDER):
        title, rationale, _ = MARKS[k]
        y = top + i * rowh
        # dark icon (the primary artifact)
        s += icon_tile(k, 60, y, isz, BASALT, "dark", hairline="#26282a")
        # lockup: small icon + wordmark
        lx = 60 + isz + 80
        s += icon_tile(k, lx, y + 40, 88, BASALT, "dark", hairline="#26282a")
        s += wordmark(lx + 108, y + 108, 50, BONE)
        # name + rationale
        tx = lx + 108
        s += text(tx, y + 150, title.upper(), 15, AMBER, 700, 1.0)
        s += text(tx, y + 182, rationale, 18, ASH, 400)
        if i < len(ORDER) - 1:
            s += f'<line x1="60" y1="{y+rowh-26}" x2="{W-60}" y2="{y+rowh-26}" stroke="{SLATE_STONE}" stroke-width="1"/>'
    return write("01-directions", s)


# --------------------------------------------------------------------------
# Sibling app tiles (scale context on the home screen). Simple, recognizable.
# --------------------------------------------------------------------------
def sib(name, x, y, sz):
    r = sz * 0.225
    def tile(bg):
        return rr(x, y, sz, sz, r, bg)
    m = sz / 100.0
    def X(v):  # local->abs
        return x + v * m
    def Y(v):
        return y + v * m
    g = []
    if name == "AllTrails":
        g.append(tile("#3f7d34"))
        g.append(f'<path d="M {X(50)} {Y(24)} L {X(74)} {Y(70)} L {X(58)} {Y(70)} L {X(50)} {Y(54)} '
                 f'L {X(42)} {Y(70)} L {X(26)} {Y(70)} Z" fill="#ffffff"/>')
        g.append(f'<circle cx="{X(50)}" cy="{Y(72)}" r="{6*m}" fill="#3f7d34"/>')
    elif name == "Gmail":
        g.append(tile("#ffffff"))
        g.append(f'<path d="M {X(26)} {Y(70)} L {X(26)} {Y(38)} L {X(50)} {Y(56)} L {X(74)} {Y(38)} '
                 f'L {X(74)} {Y(70)} L {X(66)} {Y(70)} L {X(66)} {Y(50)} L {X(50)} {Y(62)} '
                 f'L {X(34)} {Y(50)} L {X(34)} {Y(70)} Z" fill="#e04236"/>')
    elif name == "Maps":
        g.append(tile("#e9eef2"))
        g.append(f'<path d="M {X(20)} {Y(74)} L {X(50)} {Y(24)} L {X(80)} {Y(74)} L {X(50)} {Y(62)} Z" fill="#3d8be0"/>')
        g.append(f'<path d="M {X(50)} {Y(24)} L {X(80)} {Y(74)} L {X(50)} {Y(62)} Z" fill="#2f6fb5"/>')
    elif name == "Weather":
        g.append(tile("#2b6fd6"))
        g.append(f'<circle cx="{X(40)}" cy="{Y(42)}" r="{12*m}" fill="#ffd23b"/>')
        g.append(f'<ellipse cx="{X(56)}" cy="{Y(62)}" rx="{22*m}" ry="{14*m}" fill="#eef2f6"/>')
    elif name == "Messages":
        g.append(tile("#3fbb52"))
        g.append(f'<path d="M {X(28)} {Y(30)} h {44*m} a {10*m} {10*m} 0 0 1 {10*m} {10*m} v {16*m} '
                 f'a {10*m} {10*m} 0 0 1 {-10*m} {10*m} h {-24*m} l {-12*m} {10*m} v {-10*m} '
                 f'a {10*m} {10*m} 0 0 1 {-8*m} {-10*m} v {-16*m} a {10*m} {10*m} 0 0 1 {10*m} {-10*m} Z" fill="#ffffff"/>')
    elif name == "Camera":
        g.append(tile("#20242a"))
        g.append(f'<circle cx="{X(50)}" cy="{Y(50)}" r="{20*m}" fill="none" stroke="#c9ccd0" stroke-width="{5*m}"/>')
        g.append(f'<circle cx="{X(50)}" cy="{Y(50)}" r="{9*m}" fill="#c9ccd0"/>')
    elif name == "Photos":
        cols = ["#f4c020", "#ef5f4c", "#3fbb6a", "#3d8be0", "#a05fd0"]
        g.append(tile("#ffffff"))
        import math
        for j, c in enumerate(cols):
            ang = j * 72 - 90
            import math as _m
            cx2 = X(50) + 15 * m * _m.cos(_m.radians(ang))
            cy2 = Y(50) + 15 * m * _m.sin(_m.radians(ang))
            g.append(f'<circle cx="{cx2}" cy="{cy2}" r="{11*m}" fill="{c}" opacity="0.85"/>')
    elif name == "Notes":
        g.append(tile("#fbf4d8"))
        for j, ly in enumerate((40, 52, 64)):
            g.append(rr(X(28), Y(ly), (44 - j*6) * m, 4 * m, 2 * m, "#c9b98a"))
    return "".join(g)


def home_screen(theme):
    W, H = 1180, 2200
    if theme == "dark":
        wall = "#191b1e"
        label = BONE
        light = False
    else:
        wall = "#dde2e7"
        label = CHAR
        light = True
    s = svg_header(W, H, wall)
    # status bar
    s += text(70, 78, "9:41", 34, label, 700, 0)
    s += text(W - 70, 78, "camplist", 26, label if theme == "dark" else CHAR, 600, 0.5, anchor="end", opacity=0.5)

    cols = 4
    margin = 70
    gap = (W - 2 * margin - cols * 0) / cols  # cell width
    isz = 200
    cellw = (W - 2 * margin) / cols
    labely_off = isz + 42

    def place(kind_or_sib, is_candidate, col, rowy, lbl):
        cx = margin + col * cellw + (cellw - isz) / 2
        if is_candidate:
            g = icon_tile(kind_or_sib, cx, rowy, isz, BASALT, "dark",
                          hairline=("#2a2c2e" if theme == "dark" else None),
                          shadow=light)
        else:
            pre = ""
            if light:
                pre = (f'<rect x="{cx}" y="{rowy+isz*0.02}" width="{isz}" height="{isz}" '
                       f'rx="{isz*0.225}" ry="{isz*0.225}" fill="#000" opacity="0.16"/>')
            g = pre + sib(kind_or_sib, cx, rowy, isz)
        lx = margin + col * cellw + cellw / 2
        weight = 700 if is_candidate else 400
        clr = AMBER if (is_candidate and theme == "dark") else label
        return g + text(lx, rowy + labely_off, lbl, 27, clr, weight, 0, anchor="middle")

    y0 = 170
    rowgap = isz + 96
    # Row 1: candidates
    labels = ["Blaze", "Cairn", "Carabiner", "Manifest"]
    for c, k in enumerate(ORDER):
        s += place(k, True, c, y0, labels[c])
    # Rows 2-3: siblings for scale
    sibs1 = ["AllTrails", "Gmail", "Maps", "Weather"]
    sibs2 = ["Messages", "Photos", "Camera", "Notes"]
    for c, nm in enumerate(sibs1):
        s += place(nm, False, c, y0 + rowgap, nm)
    for c, nm in enumerate(sibs2):
        s += place(nm, False, c, y0 + 2 * rowgap, nm)

    # caption
    s += text(margin, y0 + 3 * rowgap + 20, "Top row: the four candidates at real launcher size, dark-tile icon on a "
              + ("dark" if theme == "dark" else "light") + " home screen.",
              22, ASH if theme == "dark" else SLATE_TXT, 400)
    return write(f"02-home-{theme}", s)


# --------------------------------------------------------------------------
# Sheet 3: the brutal small-size test
# --------------------------------------------------------------------------
def sheet_small():
    W, H = 1500, 1080
    s = svg_header(W, H, BASALT)
    s += text(60, 70, "Small is where these die", 30, BONE, 800, -0.3)
    s += text(60, 104, "Each mark at 120 / 60 / 40px, dark and light. Favicon glyph at 32 / 16px.", 18, ASH, 400)

    sizes = [120, 60, 40]
    colx = [340, 620, 900, 1180]
    # header row
    for i, k in enumerate(ORDER):
        s += text(colx[i], 150, MARKS[k][0], 15, AMBER, 700, 0.8, anchor="middle")

    def row(label, y, tile_bg, ctx, panel=None, shadow=False, lblcolor=ASH):
        s_local = text(70, y + 66, label, 15, lblcolor, 700, 0.8)
        for i, k in enumerate(ORDER):
            xc = colx[i]
            xx = 70
            # place three sizes left-aligned within the column band, centered group
            group_w = sum(sizes) + 2 * 30
            gx = xc - group_w / 2
            cur = gx
            band = ""
            for sz in sizes:
                if panel:
                    band += rr(cur, y + (120 - sz) / 2, sz, sz, sz * 0.225, panel)
                band += icon_tile(k, cur, y + (120 - sz) / 2, sz, tile_bg, ctx,
                                  hairline=("#26282a" if ctx == "dark" and not panel else None),
                                  shadow=shadow)
                cur += sz + 30
            s_local_add = band
            s_local += s_local_add
        return s_local

    s += row("ON DARK", 190, BASALT, "dark")
    # real light band so the dark-tile icon is judged against light
    s += rr(40, 336, W - 80, 148, 14, PAPER)
    s += row("ON LIGHT", 350, BASALT, "dark", shadow=True, lblcolor=SLATE_TXT)

    # favicon glyph strip (mark only, no tile) at 32 and 16
    fy = 560
    s += text(70, fy + 40, "GLYPH", 15, ASH, 700, 0.8)
    s += text(70, fy + 66, "32 / 16", 12, SLATE_TXT, 600, 0.5)
    for i, k in enumerate(ORDER):
        xc = colx[i]
        C = colors_for("dark")
        glyph = MARKS[k][2](C)
        # 32 on a basalt chip, 16 on a basalt chip
        s += rr(xc - 70, fy, 64, 64, 12, SLATE_STONE)
        s += nested(glyph, xc - 70 + 6, fy + 6, 52)
        s += rr(xc + 20, fy + 16, 32, 32, 6, SLATE_STONE)
        s += nested(glyph, xc + 20 + 3, fy + 16 + 3, 26)

    # wordmark lockups small (header size)
    hy = 700
    s += f'<line x1="60" y1="{hy}" x2="{W-60}" y2="{hy}" stroke="{SLATE_STONE}" stroke-width="1"/>'
    s += text(70, hy + 40, "IN AN APP HEADER", 15, ASH, 700, 0.8)
    y = hy + 62
    for i, k in enumerate(ORDER):
        by = y + i * 66
        s += rr(60, by, W - 120, 58, 8, "#101214")
        s += icon_tile(k, 74, by + 9, 40, BASALT, "dark", hairline="#26282a")
        s += (f'<text x="128" y="{by+38}" font-size="26" letter-spacing="-0.4" fill="{BONE}">'
              f'<tspan font-weight="800">Camp </tspan><tspan font-weight="400">List</tspan></text>')
        s += text(W - 80, by + 37, MARKS[k][0], 14, ASH, 600, 0.6, anchor="end")
    return write("03-small", s)


if __name__ == "__main__":
    print(sheet_directions())
    print(home_screen("dark"))
    print(home_screen("light"))
    print(sheet_small())
