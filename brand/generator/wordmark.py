#!/usr/bin/env python3
"""Text to outlined SVG paths via uharfbuzz shaping plus fontTools outlines.

Shaping with HarfBuzz (rather than summing advance widths) keeps the real kerning
and any ligatures, and outlining means the finished SVG carries no font
dependency.
"""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen


class Face:
    def __init__(self, path):
        self.path = path
        with open(path, "rb") as fh:
            self.data = fh.read()
        self.hb_face = hb.Face(self.data)
        self.hb_font = hb.Font(self.hb_face)
        self.tt = TTFont(path)
        self.upem = self.tt["head"].unitsPerEm
        self.glyphset = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()

    def shape(self, text, size, features=None):
        """Return (paths, advance) with glyph outlines already placed, in px."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf, features or {})
        scale = size / self.upem
        out = []
        x = 0.0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            name = self.order[info.codepoint]
            pen = SVGPathPen(self.glyphset)
            self.glyphset[name].draw(pen)
            d = pen.getCommands()
            if d:
                tx = (x + pos.x_offset * scale)
                ty = (-pos.y_offset * scale)
                # y flips because font space is y-up and SVG is y-down
                out.append((d, tx, ty, scale))
            x += pos.x_advance * scale
        return out, x


def text_paths(face, text, size, x, baseline, fill, letter_spacing=0.0):
    """Outlined text as a single <g> of transformed paths."""
    glyphs, adv = face.shape(text, size)
    parts = []
    cursor_extra = 0.0
    for i, (d, tx, ty, scale) in enumerate(glyphs):
        gx = x + tx + cursor_extra
        gy = baseline + ty
        parts.append(
            f'<path d="{d}" transform="translate({gx:.3f} {gy:.3f}) '
            f'scale({scale:.6f} {-scale:.6f})" fill="{fill}"/>'
        )
        cursor_extra += letter_spacing
    width = adv + letter_spacing * max(0, len(glyphs) - 1)
    return "".join(parts), width


def wordmark(faces, parts, size, x, baseline, letter_spacing=0.0):
    """Render a run of (text, weight_key, fill) pieces, returning (svg, width)."""
    svg = ""
    cursor = x
    for text, weight, fill in parts:
        p, w = text_paths(faces[weight], text, size, cursor, baseline, fill,
                          letter_spacing)
        svg += p
        cursor += w + letter_spacing
    return svg, cursor - x
