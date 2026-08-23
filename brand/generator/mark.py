#!/usr/bin/env python3
"""The Camp List mark.

A square window onto a contour field. Three contours cross the whole tile and a
vertical slice is cut through them; the packing-list controls sit in the slice.
Read it as a list and it is three rows with the top one packed. Read it as a map
and it is terrain.

The contour geometry is baked in `window-a.json` (extracted from `terrain.py`
with marching squares, then fitted to cubic Beziers). Only color and a few
control dimensions differ between themes.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
GEO = json.load(open(os.path.join(HERE, "window-a.json")))

# Locked dimensions, in the mark's 0..100 box.
LINE_W = 4.2         # contour stroke
CTRL_STROKE = 2.6    # unpacked control outline
PACKED_BOX = 15.0    # packed control, filled
UNPACKED_BOX = 13.0
RADIUS = 0.24        # corner radius as a fraction of the box's outer size
CAP = "butt"


def _rr(x, y, w, h, r, fill, extra=""):
    return (f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" '
            f'rx="{r:.3f}" ry="{r:.3f}" fill="{fill}" {extra}/>')


def mark(line_color, stone, amber_line=None, packed_fill=None, shape="square"):
    """Mark markup for a 0..100 viewBox.

    line_color   the contours other than the top one
    stone        the control outlines
    amber_line   the top contour; falls back to line_color for themes with no
                 amber line (light tiles, where amber as a stroke is 1.53:1)
    packed_fill  the filled control; stays bright amber in every theme, because
                 a FILL is legal where the same value as a line is not
    """
    amber_line = amber_line or line_color
    packed_fill = packed_fill or amber_line
    slice_x = GEO["slice_x"]
    out = []

    for i, c in enumerate(GEO["contours"]):
        col = amber_line if i == 0 else line_color
        for side in ("left", "right"):
            out.append(f'<path d="{c[side]}" fill="none" stroke="{col}" '
                       f'stroke-width="{LINE_W}" stroke-linecap="{CAP}" '
                       f'stroke-linejoin="round"/>')

    for i, c in enumerate(GEO["contours"]):
        cy = c["y"]
        if i == 0:
            if shape == "round":
                out.append(f'<circle cx="{slice_x}" cy="{cy:.3f}" r="{PACKED_BOX/2}" '
                           f'fill="{packed_fill}"/>')
            else:
                out.append(_rr(slice_x - PACKED_BOX/2, cy - PACKED_BOX/2,
                               PACKED_BOX, PACKED_BOX, PACKED_BOX*RADIUS, packed_fill))
        else:
            # Concentric ring: the drawn path sits half a stroke inside the outer
            # edge, so the inner and outer arcs share a center and the stroke
            # holds a constant thickness around every corner.
            inner = UNPACKED_BOX - CTRL_STROKE
            if shape == "round":
                out.append(f'<circle cx="{slice_x}" cy="{cy:.3f}" r="{inner/2}" '
                           f'fill="none" stroke="{stone}" stroke-width="{CTRL_STROKE}"/>')
            else:
                r = max(0.2, UNPACKED_BOX * RADIUS - CTRL_STROKE / 2)
                out.append(_rr(slice_x - inner/2, cy - inner/2, inner, inner, r, "none",
                               extra=f'stroke="{stone}" stroke-width="{CTRL_STROKE}"'))
    return "".join(out)


# ---- Themes ---------------------------------------------------------------
# Dark keeps the amber top line. Light cannot: Survey Amber measures 1.53:1 on
# Paper, so the light mark uses char contours and spends its amber solely on the
# packed control, which is a fill and therefore legal.

CHARCOAL = "#191b1e"
PAPER = "#f3f5f7"
AMBER = "#ffbb1b"
AMBER_LIGHT = "#ffbd1f"
STONE = "#b6b9bc"
CHAR = "#1c1d1e"
BONE = "#f4f5f6"

THEMES = {
    "dark":       dict(tile=CHARCOAL, line_color=STONE, stone=STONE,
                       amber_line=AMBER, packed_fill=AMBER),
    "light":      dict(tile=PAPER, line_color=CHAR, stone=CHAR,
                       amber_line=None, packed_fill=AMBER_LIGHT),
    "mono_light": dict(tile=None, line_color=BONE, stone=BONE,
                       amber_line=None, packed_fill=BONE),
    "mono_dark":  dict(tile=None, line_color=CHAR, stone=CHAR,
                       amber_line=None, packed_fill=CHAR),
}


def themed(name, shape="square"):
    t = THEMES[name]
    return mark(t["line_color"], t["stone"], t["amber_line"], t["packed_fill"], shape)


def controls_only(gap_scale=1.0, n=None):
    """Just the state controls, for the wordmark lockup.

    Beside type, the contours read as texture rather than terrain and fight the
    word for attention, so the lockup carries only the controls.

    gap_scale tightens the spacing between boxes. At the icon's own spacing the
    stack is mostly air, and once it is scaled down to the type's ascender the
    boxes read as dots; closing the gaps keeps the same overall height while the
    boxes stay solid. Returns the markup with the width and height of its box.
    """
    ys = [c["y"] for c in GEO["contours"]]
    if n:
        ys = ys[:n]
    if gap_scale != 1.0:
        boxes_tmp = [PACKED_BOX] + [UNPACKED_BOX] * (len(ys) - 1)
        out_ys, cursor = [ys[0]], ys[0]
        for i in range(1, len(ys)):
            gap = (ys[i] - ys[i-1]) - (boxes_tmp[i-1] + boxes_tmp[i]) / 2
            cursor += (boxes_tmp[i-1] + boxes_tmp[i]) / 2 + gap * gap_scale
            out_ys.append(cursor)
        ys = out_ys
    boxes = [PACKED_BOX] + [UNPACKED_BOX] * (len(ys) - 1)
    top = ys[0] - boxes[0] / 2
    bottom = ys[-1] + boxes[-1] / 2
    w, h = max(boxes), bottom - top
    cx = w / 2
    return w, h, lambda fill, stone: "".join(
        (_rr(cx - boxes[0]/2, ys[0] - top - boxes[0]/2, boxes[0], boxes[0],
             boxes[0]*RADIUS, fill)) if i == 0 else
        (_rr(cx - (boxes[i]-CTRL_STROKE)/2, ys[i] - top - (boxes[i]-CTRL_STROKE)/2,
             boxes[i]-CTRL_STROKE, boxes[i]-CTRL_STROKE,
             max(0.2, boxes[i]*RADIUS - CTRL_STROKE/2), "none",
             extra=f'stroke="{stone}" stroke-width="{CTRL_STROKE}"'))
        for i in range(len(ys)))
