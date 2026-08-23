#!/usr/bin/env python3
"""A terrain canvas and the machinery to crop pieces of it into a glyph.

The earlier attempts forced one hand-placed curve per row. This instead builds a
larger piece of country, extracts the whole contour family once, then treats
logo design as a cropping problem: which window of the map, how many lines from
it, and which line carries the signal color.
"""
import math

# Canvas is deliberately bigger than the glyph so there are distinct kinds of
# country to crop from: closed rings on a summit, Vs in a drainage, near-parallel
# lines on a flank.
CANVAS = (0, 200, 0, 150)   # x0, x1, y0, y1


def terrain(x, y):
    def g(px, py, amp, sx, sy):
        return amp * math.exp(-(((x - px) ** 2) / (2 * sx ** 2) +
                                ((y - py) ** 2) / (2 * sy ** 2)))
    h = (150 - y) * 0.25                      # regional tilt
    h += g(45, 45, 60, 28, 24)                # summit: closed concentric rings
    h += g(138, 58, 45, 36, 30)               # broad hill, gentle interval
    h -= g(95, 100, 38, 17, 42)               # drainage: bends Vs through the flank
    h += g(172, 122, 26, 22, 20)              # knoll, lower right
    h -= g(30, 120, 20, 24, 18)               # hollow, lower left
    h += 3.0 * math.sin(x / 13.0) + 2.2 * math.sin(y / 11.0 + 1.2)
    h += 1.5 * math.sin((x + y) / 17.0)       # texture, keeps lines off-perfect
    return h


class Field:
    """Samples the terrain once, then extracts any level from the cached grid."""

    def __init__(self, nx=420, ny=320, field=terrain, canvas=CANVAS):
        self.x0, self.x1, self.y0, self.y1 = canvas
        self.nx, self.ny = nx, ny
        self.dx = (self.x1 - self.x0) / nx
        self.dy = (self.y1 - self.y0) / ny
        self.v = [[field(self.x0 + i * self.dx, self.y0 + j * self.dy)
                   for j in range(ny + 1)] for i in range(nx + 1)]
        flat = [val for col in self.v for val in col]
        self.lo, self.hi = min(flat), max(flat)

    def lines(self, level):
        if not hasattr(self, "_cache"):
            self._cache = {}
        ck = round(level, 4)
        if ck in self._cache:
            return self._cache[ck]
        segs = []
        v = self.v

        def interp(pa, va, pb, vb):
            if abs(vb - va) < 1e-9:
                return pa
            t = (level - va) / (vb - va)
            return (pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t)

        for i in range(self.nx):
            xa = self.x0 + i * self.dx
            xb = xa + self.dx
            for j in range(self.ny):
                ya = self.y0 + j * self.dy
                yb = ya + self.dy
                c = [((xa, ya), v[i][j]), ((xb, ya), v[i + 1][j]),
                     ((xb, yb), v[i + 1][j + 1]), ((xa, yb), v[i][j + 1])]
                idx = sum((1 << k) for k, (_, val) in enumerate(c) if val >= level)
                if idx in (0, 15):
                    continue
                e = []
                for k in range(4):
                    (pa, va), (pb, vb) = c[k], c[(k + 1) % 4]
                    if (va >= level) != (vb >= level):
                        e.append(interp(pa, va, pb, vb))
                for k in range(0, len(e) - 1, 2):
                    segs.append((e[k], e[k + 1]))
        out = _join(segs)
        self._cache[ck] = out
        return out


def _join(segs):
    def key(p):
        return (round(p[0], 4), round(p[1], 4))
    ends = {}
    for i, (a, b) in enumerate(segs):
        ends.setdefault(key(a), []).append((i, 0))
        ends.setdefault(key(b), []).append((i, 1))
    used = [False] * len(segs)
    out = []
    for i0 in range(len(segs)):
        if used[i0]:
            continue
        used[i0] = True
        chain = [segs[i0][0], segs[i0][1]]
        for at_end in (True, False):
            while True:
                tip = chain[-1] if at_end else chain[0]
                nxt = None
                for (si, which) in ends.get(key(tip), []):
                    if not used[si]:
                        nxt = (si, segs[si][1 - which])
                        break
                if nxt is None:
                    break
                si, pt = nxt
                used[si] = True
                chain.append(pt) if at_end else chain.insert(0, pt)
        if len(chain) > 4:
            out.append(chain)
    out.sort(key=lambda c: -_length(c))
    return out


def _length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def resample(pts, step=0.9):
    if len(pts) < 2:
        return pts
    out = [pts[0]]
    carry = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = math.dist(a, b)
        if d < 1e-9:
            continue
        t = step - carry
        while t <= d:
            out.append((a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d))
            t += step
        carry = (carry + d) % step
    return out


def smooth(pts, passes=2):
    for _ in range(passes):
        if len(pts) < 3:
            return pts
        new = [pts[0]]
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            new.append((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]))
            new.append((0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))
        new.append(pts[-1])
        pts = new
    return pts


def path(pts, width, color):
    d = "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')
