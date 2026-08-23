#!/usr/bin/env python3
"""Re-extract the mark's contours into window-a.json.

A normal build does not need this: `window-a.json` is committed and `build.py`
reads it directly. Run this only to move the mark onto different terrain, or
after changing `terrain.py`.

Marching squares over ~110 levels takes a minute or two, which is the reason the
result is baked rather than derived at build time.
"""
import json

import curves
import terrain

WINDOW = (0, 60, 60, 120)   # square, so mapping it onto a square tile cannot distort
SLICE_X, SLICE_W = 26.0, 26.0
MIN_SEP = 9.0               # two nearly-coincident contours would read as one doubled line
ROWS = (26.0, 50.0, 74.0)
OVERSHOOT = 6.0             # bleed art runs under the tile edge rather than up to it
LEVELS = 110
FIT_TOL = 0.05


def _h_at(pts, x):
    for i in range(1, len(pts)):
        if pts[i][0] >= x:
            x0, y0 = pts[i-1]; x1, y1 = pts[i]
            return y1 if abs(x1-x0) < 1e-9 else y0 + (y1-y0)*(x-x0)/(x1-x0)
    return None


def _h_ext(pts, x):
    """Height at x, extrapolated past either end along the terminal segment."""
    first, last = pts[0], pts[-1]
    if x <= first[0]:
        x0, y0 = first; x1, y1 = pts[1]
        return y0 + (y1-y0)*(x-x0)/(x1-x0)
    if x >= last[0]:
        x1, y1 = last; x0, y0 = pts[-2]
        return y1 + (y1-y0)*(x-x1)/(x1-x0)
    return _h_at(pts, x)


def _clip(pts, a, b):
    return [(a, _h_ext(pts, a))] + [tuple(p) for p in pts if a < p[0] < b] + [(b, _h_ext(pts, b))]


def full_crossers(field, levels):
    """Contours that cross the window edge to edge, in tile coordinates."""
    wx0, wx1, wy0, wy1 = WINDOW
    span = wx1 - wx0
    scale = 100.0 / span
    out = []
    for lv in levels:
        for line in field.lines(lv):
            run = [p for p in line if wx0 <= p[0] <= wx1 and wy0 <= p[1] <= wy1]
            if len(run) < 30:
                continue
            xs = [p[0] for p in run]
            if (max(xs) - min(xs)) < span * 0.995:
                continue
            if run[0][0] > run[-1][0]:
                run = run[::-1]
            # a contour that doubles back cannot be sliced by x, so keep the
            # monotonic part only
            mono = [run[0]]
            for p in run[1:]:
                if p[0] > mono[-1][0] + 1e-9:
                    mono.append(p)
            if (mono[-1][0] - mono[0][0]) < span * 0.995:
                continue
            pts = terrain.smooth(terrain.resample(mono, 0.7))
            out.append([((x - wx0) * scale, (y - wy0) * scale) for x, y in pts])
    return out


def main():
    field = terrain.Field()
    lo, hi = field.lo, field.hi
    levels = [lo + (hi - lo) * i / LEVELS for i in range(1, LEVELS)]
    lines = full_crossers(field, levels)
    print(f"full-crossing contours: {len(lines)}")

    # one contour per row, top to bottom, never within MIN_SEP of the row above
    chosen, floor = [], -1e9
    for target in ROWS:
        best, best_d, best_h = None, 1e9, None
        for line in lines:
            h = _h_at(line, SLICE_X)
            if h is None or h < floor + MIN_SEP:
                continue
            if abs(h - target) < best_d:
                best_d, best, best_h = abs(h - target), line, h
        if best is None:
            raise SystemExit(f"no contour available for row {target}")
        chosen.append((best, best_h))
        floor = best_h
        print(f"  row {target}: contour at y={best_h:.2f}")

    left_edge = SLICE_X - SLICE_W / 2
    right_edge = SLICE_X + SLICE_W / 2
    contours = []
    for line, cy in chosen:
        left = curves.fit(_clip(line, -OVERSHOOT, left_edge), tol=FIT_TOL)
        right = curves.fit(_clip(line, right_edge, 100 + OVERSHOOT), tol=FIT_TOL)
        contours.append({"y": round(cy, 3),
                         "left": curves.to_path_d(left),
                         "right": curves.to_path_d(right),
                         "segs": [len(left), len(right)]})
        print(f"  fitted to {len(left)} + {len(right)} cubics")

    json.dump({"window": list(WINDOW), "slice_x": SLICE_X, "slice_w": SLICE_W,
               "min_sep": MIN_SEP, "rows": list(ROWS), "overshoot": OVERSHOOT,
               "note": ("Window A of the terrain field. Each contour is split at the "
                        "slice and extended past the tile edges, then fitted to cubic Beziers."),
               "contours": contours},
              open("window-a.json", "w"), indent=1)
    print("wrote window-a.json")


if __name__ == "__main__":
    main()
