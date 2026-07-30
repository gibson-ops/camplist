# Camp List brand

## The mark

A square window onto a contour field. Three contours cross the entire tile and a
vertical slice is cut through them; the packing-list controls sit in the slice.
Read it as a list and it is three rows with the top one packed. Read it as a map
and it is a piece of terrain. The rows **are** the contours.

It answers the brief's central tension. The product is camping-inspired but not
camping-constrained, so the mark had to dodge every category reflex PRODUCT.md
rejects by name (a tent, a mountain range, a pine tree, a compass rose, a
checkmark in a circle, and a checklist welded to any of them) while still saying
"packing" and still reading outdoor-native. Topography does that: it is how
AllTrails and Gaia read as outdoor tools without drawing scenery, and a contour
map is as true of a hotel room as of a campsite.

The contours are not drawn. They are extracted from an elevation field with
marching squares, which is how a real contour map is made, so the things that
make terrain look like terrain arrive on their own: the interval varies with the
slope, the lines meander instead of repeating an arc, and a drainage bends a V
through them. Evenly spaced hand-drawn arcs were the tell in earlier attempts.

Lines **bleed past every edge**. That is what turns an arbitrary crop into a
window onto a map, and it is why the icon has no inset.

## Files

| File                                                           | Use                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `camplist-icon.svg`                                            | Dark app icon. Square, opaque, **no baked corner radius** — both platforms apply their own mask. |
| `camplist-icon-light.svg`                                      | Light app icon (see the amber note below).                                                       |
| `camplist-icon-rounded.svg`, `camplist-icon-light-rounded.svg` | Pre-rounded, for web and documents where nothing masks them.                                     |
| `camplist-monogram.svg`                                        | Mark alone, transparent, dark-context colors.                                                    |
| `camplist-monogram-light.svg`                                  | Mark alone for light backgrounds.                                                                |
| `camplist-monogram-mono.svg`                                   | Single colour, for the Android monochrome layer and stamping.                                    |
| `camplist-wordmark.svg` / `.png`                               | Horizontal lockup, dark contexts.                                                                |
| `camplist-wordmark-light.svg` / `.png`                         | Horizontal lockup, light contexts.                                                               |

Wordmark type is outlined, so the SVGs carry no font dependency.

## Rules

- **Light is a different drawing, not a recolor.** Survey Amber measures
  **1.53:1** on Paper, so it cannot be a contour there. The light mark uses Char
  contours and spends its amber solely on the packed control, which is a FILL and
  therefore legal. This is the Fill-Only Rule in DESIGN.md, and the same fill /
  line split that DESIGN.md already applies to Forest Green.
  Darkening the amber was tested and rejected: it goes brown before it clears
  3:1. Warming or darkening the tile was tested and is worse — amber sits so
  close to those tones that contrast drops to 1.06:1.
- **Amber marks one row, never the whole tile.** An all-amber tile reads well and
  was rejected on purpose: amber stops meaning "packed" once it means "the app".
- **Android is framed like iOS.** The adaptive foreground is sized to the
  launcher's 72/108 mask window rather than inset into the 66/108 safe circle, and
  it is placed unclipped so the contour overshoot runs past the mask edge. A
  nested `<svg>` would crop that overshoot, which is why `build.py` uses a group
  transform for those layers.
- **The monochrome layer must stay shape-legible.** Themed icons flatten it to one
  colour, so packed versus unpacked is a filled box versus an outlined box, never
  a hue. Same principle as the Colorblind Floor.
- **Controls use concentric corners.** The ring's inner and outer arcs share a
  center, so the stroke holds a constant thickness around every corner.
- Type beside the mark is Source Sans 3 at 700, lowercase, one word: `camplist`.

### Measured contrast

| Context              | Contours | Amber     |
| -------------------- | -------- | --------- |
| Dark tile `#191b1e`  | 8.8:1    | 10.2:1    |
| Light tile `#f3f5f7` | 15.4:1   | fill only |

## Regenerating

```bash
cd brand/generator
uv venv .venv && uv pip install --python .venv/bin/python fonttools uharfbuzz
.venv/bin/python build.py        # writes brand/ and mobile/assets/
```

- `terrain.py` is the elevation field; `window-a.json` holds the three chosen
  contours already fitted to cubic Beziers, so a normal build does not re-run
  marching squares.
- `mark.py` holds the locked dimensions and the four themes.
- Fonts are read from the `@expo-google-fonts` dependency; no font binaries are
  vendored.

To move the mark to a different piece of terrain, re-extract `window-a.json`:
the window is `(0,60,60,120)`, rows are chosen at the slice with a minimum
separation of 9 units so two nearly-coincident contours cannot read as one
doubled line, and each contour is split at the slice and extended 6 units past
both tile edges before fitting.
