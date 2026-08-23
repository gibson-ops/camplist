#!/usr/bin/env python3
"""Fit smooth cubic Béziers to a sampled polyline (Schneider's algorithm).

The contours come out of marching squares as hundreds of points. Drawn straight,
they carry the sampler's noise: the curvature flips sign hundreds of times along
what should be a single arch. Individually those wobbles are sub-pixel, but
collectively they are what makes a line look traced instead of drawn.

Fitting a handful of cubics enforces what a drawn curve has: continuous
curvature, few segments, and control points that mean something.
"""
import math


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _mul(a, s):
    return (a[0] * s, a[1] * s)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def _norm(a):
    d = math.hypot(*a)
    return (a[0] / d, a[1] / d) if d > 1e-12 else (0.0, 0.0)


def _bezier(ctrl, t):
    mt = 1 - t
    return (mt**3 * ctrl[0][0] + 3 * mt**2 * t * ctrl[1][0]
            + 3 * mt * t**2 * ctrl[2][0] + t**3 * ctrl[3][0],
            mt**3 * ctrl[0][1] + 3 * mt**2 * t * ctrl[1][1]
            + 3 * mt * t**2 * ctrl[2][1] + t**3 * ctrl[3][1])


def _chord_params(pts):
    """Chord-length parameterization, normalized to 0..1."""
    u = [0.0]
    for i in range(1, len(pts)):
        u.append(u[-1] + math.dist(pts[i], pts[i - 1]))
    total = u[-1] or 1.0
    return [v / total for v in u]


def _fit_one(pts, u, t1, t2):
    """Least-squares cubic through pts[0]/pts[-1] with the given end tangents."""
    n = len(pts)
    a = [[_mul(t1, 3 * (1 - ui) ** 2 * ui), _mul(t2, 3 * (1 - ui) * ui ** 2)]
         for ui in u]
    c00 = c01 = c11 = x0 = x1 = 0.0
    for i in range(n):
        c00 += _dot(a[i][0], a[i][0])
        c01 += _dot(a[i][0], a[i][1])
        c11 += _dot(a[i][1], a[i][1])
        base = _bezier([pts[0], pts[0], pts[-1], pts[-1]], u[i])
        tmp = _sub(pts[i], base)
        x0 += _dot(a[i][0], tmp)
        x1 += _dot(a[i][1], tmp)
    det = c00 * c11 - c01 * c01
    if abs(det) < 1e-12:
        d = math.dist(pts[0], pts[-1]) / 3.0
        alpha1 = alpha2 = d
    else:
        alpha1 = (x0 * c11 - c01 * x1) / det
        alpha2 = (c00 * x1 - x0 * c01) / det
    seg = math.dist(pts[0], pts[-1])
    if alpha1 < 1e-6 or alpha2 < 1e-6:
        alpha1 = alpha2 = seg / 3.0
    return [pts[0], _add(pts[0], _mul(t1, alpha1)),
            _add(pts[-1], _mul(t2, alpha2)), pts[-1]]


def _max_error(pts, u, ctrl):
    worst, at = 0.0, len(pts) // 2
    for i in range(1, len(pts) - 1):
        d = math.dist(_bezier(ctrl, u[i]), pts[i])
        if d > worst:
            worst, at = d, i
    return worst, at


def fit(pts, tol=0.09, depth=0):
    """Return a list of cubic segments approximating pts within `tol` units."""
    if len(pts) < 3:
        d = math.dist(pts[0], pts[-1]) / 3.0 if len(pts) == 2 else 0.0
        t = _norm(_sub(pts[-1], pts[0])) if len(pts) == 2 else (0.0, 0.0)
        return [[pts[0], _add(pts[0], _mul(t, d)), _sub(pts[-1], _mul(t, d)), pts[-1]]]

    t1 = _norm(_sub(pts[1], pts[0]))
    t2 = _norm(_sub(pts[-2], pts[-1]))
    u = _chord_params(pts)
    ctrl = _fit_one(pts, u, t1, t2)
    err, at = _max_error(pts, u, ctrl)
    if err <= tol or depth > 12:
        return [ctrl]
    # split where it deviates most, with a shared tangent so the join stays smooth
    left, right = pts[:at + 1], pts[at:]
    if len(left) < 3 or len(right) < 3:
        return [ctrl]
    return fit(left, tol, depth + 1) + fit(right, tol, depth + 1)


def to_path_d(segments):
    """SVG path data for a run of cubics that share endpoints."""
    d = f"M {segments[0][0][0]:.2f} {segments[0][0][1]:.2f}"
    for s in segments:
        d += (f" C {s[1][0]:.2f} {s[1][1]:.2f} {s[2][0]:.2f} {s[2][1]:.2f} "
              f"{s[3][0]:.2f} {s[3][1]:.2f}")
    return d


def curvature_flips(pts):
    """Diagnostic: how many times the curvature changes sign along a polyline."""
    ks = []
    for j in range(1, len(pts) - 1):
        ax, ay = pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]
        bx, by = pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]
        ks.append(ax * by - ay * bx)
    return sum(1 for j in range(1, len(ks)) if ks[j - 1] * ks[j] < 0)
