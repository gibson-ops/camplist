#!/usr/bin/env python3
"""The Camp List mark: three contour lines that begin at packing-list controls.

Clipping the crop at a vertical left edge is what makes this work. Every contour
crosses that edge at its own height, so the start points stack into a checkbox
column on their own, and each line then runs off to the right and arches over
the saddle. The list rows ARE the terrain.
"""
import math
import terrain as topolib

AMBER = "#ffbb1b"
STONE_DEFAULT = "#aeb1b4"


def rr(x, y, w, h, r, fill, extra=""):
    """Rounded rect. Kept local so this module stands alone."""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" '
            f'rx="{r}" ry="{r}" fill="{fill}" {extra}/>')

STONE = "#aeb1b4"


def saddle_runs(F, X0=60, y0s=(77, 89, 101), W=62):
    """One contour per row, each starting where it crosses the left edge."""
    runs = []
    for ry in y0s:
        lv = topolib.terrain(X0, ry)
        best, bestd = None, 1e9
        for ln in F.lines(lv):
            for pt in (ln[0], ln[-1]):
                d = math.hypot(pt[0] - X0, pt[1] - ry)
                if d < bestd:
                    bestd, best = d, ln
        if not best:
            continue
        run = [p for p in best if X0 <= p[0] <= X0 + W]
        if len(run) < 12:
            continue
        if run[0][0] > run[-1][0]:
            run = run[::-1]
        runs.append(run)
    return runs


def usable_band(F, X0, W, lo=58, hi=122, step=2):
    """The y range at the left edge whose contours actually run the full crop."""
    ok = []
    for ry in range(lo, hi, step):
        lv = topolib.terrain(X0, ry)
        best, bestd = None, 1e9
        for ln in F.lines(lv):
            for pt in (ln[0], ln[-1]):
                d = math.hypot(pt[0] - X0, pt[1] - ry)
                if d < bestd:
                    bestd, best = d, ln
        if not best:
            continue
        run = [p for p in best if X0 <= p[0] <= X0 + W]
        if len(run) < 15:
            continue
        xs = [p[0] for p in run]
        if max(xs) - min(xs) < W * 0.75:
            continue
        ok.append(ry)
    return (min(ok), max(ok)) if ok else None


def find_row_level(F, X0, W, y_guess, search=9.0, step=0.5, min_span=0.72):
    """A level near y_guess whose contour truly starts at the left edge.

    Picking a level by elevation alone is not enough: near the bottom of the band
    the matching contour dips out of the crop and re-enters partway along, so its
    "start" is mid-frame and the control ends up detached (or off-canvas). This
    scans outward from the guess and takes the nearest level that both begins at
    the left edge and runs most of the crop's width.
    """
    offsets = [0.0]
    d = step
    while d <= search:
        offsets += [d, -d]
        d += step
    for off in offsets:
        ry = y_guess + off
        runs = saddle_runs(F, X0, (ry,), W)
        if not runs:
            continue
        run = runs[0]
        if abs(run[0][0] - X0) > 1.2:
            continue
        xs = [p[0] for p in run]
        if (max(xs) - min(xs)) < W * min_span:
            continue
        return ry, run
    return None, None


def smooth_pts(pts):
    return topolib.smooth(topolib.resample(pts, 0.6))


def saddle_v3(F, X0=60, W=52, box=(24, 92, 12, 88), n=3,
              line_w=4.0, ctrl_size=(15.0, 14.0, 13.0), ctrl_stroke=2.6,
              amber_line=True, gap=3.0, cap="butt", right_inset=6.0,
              align_controls=True, seed_center=92.0, seed_spacing=13.0, pad=1.5):
    """Butt caps, inset right terminals, lighter control outlines, aligned boxes.

    align_controls centers each box on the height where its line actually
    resumes, not on the contour's start point. The two differ because the line
    climbs while it passes behind the box, which is what made the boxes look
    like they were sitting low against their own rows.
    """
    k = (n - 1) / 2.0
    seed_ys = [seed_center + (i - k) * seed_spacing for i in range(n)]
    seed_runs = saddle_runs(F, X0, tuple(seed_ys), W)
    if len(seed_runs) < n:
        return ""

    wy0 = min(p[1] for r in seed_runs for p in r) - pad
    wy1 = max(p[1] for r in seed_runs for p in r) + pad
    bx0, bx1, by0, by1 = box
    s = min((bx1 - bx0) / float(W), (by1 - by0) / (wy1 - wy0))
    ox = bx0 + ((bx1 - bx0) - W * s) / 2
    oy = by0 + ((by1 - by0) - (wy1 - wy0) * s) / 2
    to_glyph = lambda p: (ox + (p[0] - X0) * s, oy + (p[1] - wy0) * s)

    band = usable_band(F, X0, W)
    if not band:
        return ""
    g_lo = max(oy + (band[0] - wy0) * s + 3, by0 + 4)
    g_hi = min(oy + (band[1] - wy0) * s - 3, by1 - 4)
    rows = [g_lo + (g_hi - g_lo) * i / (n - 1) for i in range(n)]
    runs = []
    for r in rows:
        _, run = find_row_level(F, X0, W, wy0 + (r - oy) / s)
        if run is not None:
            runs.append(run)
    if len(runs) != n:
        return ""

    end_x = min(to_glyph(r[-1])[0] for r in runs) - right_inset
    lines, controls = [], []
    for i, run in enumerate(runs):
        pts = smooth_pts([to_glyph(p) for p in run])
        size = ctrl_size[i] if i < len(ctrl_size) else ctrl_size[-1]
        cx, cy = pts[0]
        resume = cx + size / 2 + gap
        seg = [p for p in pts if resume <= p[0] <= end_x]
        if len(seg) < 4:
            seg = pts
        if align_controls:
            cy = seg[0][1]
            cy = min(max(cy, by0 + size / 2), by1 - size / 2)
        col = AMBER if (amber_line and i == 0) else STONE
        d = "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in seg)
        lines.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{line_w:.2f}" '
                     f'stroke-linecap="{cap}" stroke-linejoin="round"/>')
        if i == 0:
            controls.append(rr(cx - size / 2, cy - size / 2, size, size, size * 0.24, AMBER))
        else:
            inner = size - ctrl_stroke
            controls.append(rr(cx - inner / 2, cy - inner / 2, inner, inner, inner * 0.26,
                               "none", extra=f'stroke="{STONE}" stroke-width="{ctrl_stroke:.2f}"'))
    return "".join(lines + controls)
