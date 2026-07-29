# Camp List brand

## The mark

Three contour lines cropped from a saddle — the pass between two hills — where each
line begins at a packing-list state control. Read it as a list and it is a list:
three rows, the top one packed. Read it as a map and it is terrain. Neither reading
is bolted onto the other; the rows **are** the contours.

It resolves the brief's central tension. The product is camping-inspired but not
camping-constrained, so the mark had to avoid the category reflexes PRODUCT.md
rejects by name (a tent, a mountain range, a pine tree, a compass rose, a
checkmark in a circle) while still saying "packing" and still feeling outdoor-native.
Topography does that: it is how AllTrails and Gaia read as outdoor tools without
drawing scenery, and a contour map is equally true of a trailhead and a city.

The contours are not drawn by hand. They are extracted with marching squares from a
synthetic elevation field, which is how a real contour map is made, so the
properties that make terrain look like terrain come for free: the interval varies
with the slope, the lines meander rather than repeating one arc, and the drainage
bends a V through them. Hand-drawn arcs at constant spacing were the giveaway in
earlier attempts.

## Files

| File | Use |
|---|---|
| `camplist-icon.svg` | App icon. Square, opaque, **no baked corner radius** — iOS and Android apply their own mask. |
| `camplist-icon-rounded.svg` | Pre-rounded, for web and documents where nothing masks it. |
| `camplist-monogram.svg` | Mark alone, transparent, dark-context colors. |
| `camplist-monogram-light.svg` | Mark alone for light backgrounds: contours darken to Char. |
| `camplist-monogram-mono.svg` | Single color, for the Android monochrome layer and stamping. |
| `camplist-monogram-small.svg` | Optical cut for small surfaces (see below). |
| `camplist-wordmark.svg` / `.png` | Horizontal lockup, dark contexts. |
| `camplist-wordmark-light.svg` / `.png` | Horizontal lockup, light contexts. |

Wordmark type is outlined, so the SVGs carry no font dependency.

## Rules

- **One dark tile for both themes.** The icon is amber on Basalt everywhere. A light
  tile was tested and loses presence: it dissolves into a light home screen and
  glares on a dark one.
- **Amber is a fill, never a stroke on light.** Survey Amber measures 1.53:1 against
  Paper, so on any light surface use `camplist-monogram-light.svg`, where the amber
  survives only as the filled control with everything else in Char.
- **Optical sizing.** The master's contour lines are 3.5 units in a 100-unit box.
  Below roughly 40px that falls under a pixel, so small surfaces use
  `camplist-monogram-small.svg` — the same drawing with heavier strokes and larger
  boxes. Do not simply downscale the master for a favicon.
- **The monochrome layer must stay shape-legible.** Android themed icons flatten it
  to one color, so packed versus unpacked is carried by filled box versus outlined
  box, never by color. This mirrors the Colorblind Floor in DESIGN.md.
- Type beside the mark is Source Sans 3: `Camp` at 800, `List` at 400.

## Regenerating

Geometry lives in `../design-explore/` and is baked into these SVGs; the shipped
artwork does not depend on it. To change the mark:

```bash
cd design-explore
uv venv .venv && uv pip install --python .venv/bin/python fonttools uharfbuzz
.venv/bin/python build_brand.py     # writes brand/ and mobile/assets/
```

`MARK` in `build_brand.py` holds the locked parameters. Two of them are load-bearing
and were tuned against renders rather than chosen:

- `W=52` is the crop width. Past about 56 the arch's descending tail hangs below the
  rows; below about 40 the crop stops before the crest and the arch reads as a ramp.
- `gap=5.0` is the space between a control and where its line resumes. Widening it
  also raises the control, because each box is centered on the height where its own
  line reappears rather than on the contour's start point.
