---
name: Camp List
description: Trip-scoped packing lists that get smarter every trip
colors:
  signal: "#f1c623"
  signal-light: "#e0b100"
  on-signal: "#19160b"
  loaded: "#549864"
  loaded-light: "#357a47"
  danger: "#df695c"
  danger-light: "#af2b25"
  dark-bg: "#15110c"
  dark-surface: "#211c16"
  dark-raised: "#2d2821"
  dark-border: "#423c34"
  dark-text: "#f1eee9"
  dark-muted: "#a9a49c"
  light-bg: "#f4f1ec"
  light-surface: "#fdfcf8"
  light-sunken: "#ebe7e0"
  light-border: "#cfcac1"
  light-text: "#241e17"
  light-muted: "#5d574f"
typography:
  display:
    fontFamily: "system-ui"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "system-ui"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  title:
    fontFamily: "system-ui"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0px"
  body:
    fontFamily: "system-ui"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0px"
  label:
    fontFamily: "system-ui"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.8px"
  numeric:
    fontFamily: "ui-monospace"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0px"
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
    height: "52px"
  item-row:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "56px"
  person-chip:
    backgroundColor: "{colors.dark-raised}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
    height: "26px"
  input-field:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    height: "52px"
  section-header:
    backgroundColor: "{colors.dark-bg}"
    textColor: "{colors.dark-muted}"
    typography: "{typography.label}"
    padding: "16px 16px 8px"
---

# Design System: Camp List

## 1. Overview

**Creative North Star: "The Trailhead Sign"**

A routed trailhead sign works in every condition it will ever meet. Full sun, dusk, rain,
snow. It is read at a glance from six feet away by someone carrying something heavy. It has
no decoration, because decoration would be one more thing to fade. Every part of it is
either information or the structure holding information up. That is the standard here.

Camp List is a field instrument, not an app that happens to be about camping. Its density is
moderate: rows are large enough to hit with a cold thumb, but the screen never wastes space
on breathing room that could be showing the next eight items. Type does the hierarchy work
through weight and case, not through color or ornament. Surfaces are flat and separated by
tone, because a shadow is a lighting effect and this interface does not pretend to have
lighting.

The palette deliberately refuses both reflexes of its category. It is **not** the woodsy
forest-green-and-brown of an outdoor brand, and it is **not** the tactical black-and-safety-
orange of a GPS app. It is warm stone and survey yellow: the colors of equipment and
markings, not of scenery. Scenery is what you are going outside to look at. The app should
not compete with it.

**Key Characteristics:**

- Flat surfaces, tonal separation, hairline borders. No shadows except on genuinely floating
  layers.
- One signal color, used sparingly and almost always as a fill.
- Type hierarchy through weight and letter-spacing, never through color.
- Squared-off geometry (2-8px). Pills exist only for person chips.
- Every state readable without color: shape and glyph carry the meaning too.

## 2. Colors: The Survey Palette

Warm stone neutrals tinted toward ochre, with a single high-luminance survey yellow that
appears only where the eye must go first.

### Primary

- **Survey Yellow** (`#f1c623` dark / `#e0b100` light): The one signal. Primary actions, the
  packed state, focus rings, and the current selection. It marks what to do next or what is
  already handled. Nothing else may use it.
- **Ink** (`#19160b`): The near-black that sits on top of Survey Yellow. Warm, never pure
  black, so a yellow button does not vibrate.

### Secondary

- **Trail Green** (`#549864` dark / `#357a47` light): The *loaded* state only, the final step
  after packed. Deliberately calmer than the signal, because reaching it is the resting
  state, not the thing demanding attention.

### Tertiary

- **Ember** (`#df695c` dark / `#af2b25` light): Destructive actions and genuine errors. Never
  used for validation nagging or for overdue timing, which are not failures.

### Neutral

Dark scheme, the default. The scene is a campsite at dusk with a headlamp on, or a phone
checked inside a tent at 5am without waking anyone.

- **Basalt** (`#15110c`): App background.
- **Slate Stone** (`#211c16`): Row and card surfaces.
- **Raised Stone** (`#2d2821`): Chips, pressed states, sheet backgrounds.
- **Cairn** (`#423c34`): Hairline borders and dividers.
- **Bone** (`#f1eee9`): Primary text. 16.3:1 on Basalt.
- **Ash** (`#a9a49c`): Secondary text, labels, metadata. 7.6:1 on Basalt.

Light scheme. The scene is a driveway at 11am in July, loading the car, phone at arm's length
in direct sun.

- **Paper** (`#f4f1ec`): App background.
- **Chalk** (`#fdfcf8`): Row and card surfaces, lifted above Paper.
- **Sunken Paper** (`#ebe7e0`): Inset wells, disabled fills.
- **Graphite Line** (`#cfcac1`): Hairline borders.
- **Char** (`#241e17`): Primary text. 14.7:1 on Paper.
- **Slate** (`#5d574f`): Secondary text. 6.4:1 on Paper.

### Named Rules

**The Fill-Only Rule.** Survey Yellow measures **1.79:1** against the light background. It is
therefore *forbidden* as text, as an icon stroke, or as a hairline in the light scheme. It
may only appear as a filled shape with Ink on top (9.0:1). This rule is not a preference; it
is the measured limit of the color.

**The One Voice Rule.** Survey Yellow covers no more than 10% of any screen. A list where
every row is yellow has no signal at all. If two things on screen are competing for it, one
of them is not actually primary.

**The Colorblind Floor.** No state is ever communicated by hue alone. Packed is yellow *and*
a filled check. Loaded is green *and* a box glyph. Unpacked is muted *and* an empty square.
Remove all color and the screen must still be readable.

## 3. Typography

**Display Font:** system-ui (SF Pro on iOS, Roboto on Android)
**Body Font:** system-ui
**Label/Mono Font:** ui-monospace (SF Mono, Roboto Mono)

**Character:** Deliberately the platform's own voice, because Dynamic Type support and
instant rendering outrank novelty on a device used one-handed in bad light. The personality
comes from how it is set, not from what it is: heavy weights, tight tracking on headings,
wide tracking on small caps labels, and a monospace reserved for anything countable.

### Hierarchy

- **Display** (800, 32px, 1.1, -0.5px): Trip names on a trip's own screen. One per screen.
- **Headline** (700, 24px, 1.2, -0.3px): Screen titles and empty-state headlines.
- **Title** (600, 17px, 1.3): Item names and list names. The workhorse.
- **Body** (400, 16px, 1.45): Notes, descriptions, explanatory copy. Cap at 65-75 characters.
- **Label** (700, 12px, 1.2, +0.8px, uppercase): Section headers, state badges, metadata keys.
- **Numeric** (mono, 600, 15px): Quantities, counts, and anything that should align in a
  column or change without shifting its neighbors.

### Named Rules

**The Tabular Rule.** Every number that can change (quantity, "8 of 14 packed") is set in the
monospace numeric style with tabular figures. Counts that reflow their own row when they tick
from 9 to 10 read as sloppy instrumentation.

**The Dynamic Type Rule.** No row has a fixed height that contains user text. Sizes above are
the default step; every one of them scales. A layout that clips at the largest accessibility
size is a broken layout, not an edge case.

## 4. Elevation

This system is **flat**. Depth is communicated by tone, not by shadow: Basalt recedes, Slate
Stone sits on it, Raised Stone sits on that. Borders are always exactly 1px hairlines in
Cairn or Graphite Line. A surface never casts a shadow simply for being a card.

Shadows exist for exactly one purpose: to signal that a layer is genuinely floating above the
app and is temporarily modal in nature. That means the bottom sheet, and nothing else.

### Shadow Vocabulary

- **Sheet Lift** (`0 -8px 32px rgba(0,0,0,0.45)` dark, `0 -8px 32px rgba(36,30,23,0.18)`
  light): Cast upward by a bottom sheet onto the content it covers. The only shadow allowed.

### Named Rules

**The Flat Field Rule.** If a surface cannot be dragged, dismissed, or dropped, it does not
get a shadow. Rows, cards, headers, inputs, and chips are all flat, forever.

**The 2014 Test.** If an element looks like it was designed in 2014, the shadow is too dark
and its blur radius is too small. Delete the shadow rather than tuning it.

## 5. Components

### Buttons

- **Shape:** Barely-softened corners (6px). Never pills, never fully square.
- **Primary:** Survey Yellow fill, Ink text, 700 weight, 16px, 52px tall, 24px horizontal
  padding. Full-width at the bottom of a flow; inline width elsewhere.
- **Secondary:** Surface fill with a 1px Cairn border, primary text color. Same metrics.
- **Ghost:** No fill, no border, muted text. For tertiary escapes like "Use a different
  email".
- **Pressed:** Background steps one tone darker and the element scales to 0.98 over 120ms.
  No opacity fade; opacity reads as "disabled", not "pressed".
- **Disabled:** Sunken fill, muted text, no border. Never a faded primary.
- **Minimum target:** 52px tall, which exceeds the 44pt floor because these are pressed with
  cold hands.

### Chips

- **Person Chip:** The one place pills are allowed (999px), because a person is a soft, human
  thing among hard rows. Raised Stone fill, 26px tall, 4px/10px padding, Label typography.
  Carries a 6px round color dot in that person's assigned accent, followed by their name.
- **State:** When a chip is a filter and is active, it inverts: Survey Yellow fill with Ink
  text. Inactive chips never use the signal color.
- **Overflow:** Three chips maximum in a row, then `+2` in the numeric style.

### Cards / Containers

Camp List does not use cards. Content is organized into full-bleed grouped lists separated by
section headers, which is denser, scans faster, and avoids the nested-card trap entirely.

- **Row grouping:** Consecutive rows share one Slate Stone surface with 1px Cairn dividers
  between them, the outer group squared at 4px.
- **Internal padding:** 12px vertical, 16px horizontal.

### Inputs / Fields

- **Style:** Slate Stone fill, 1px Cairn border, 6px radius, 52px tall, 16px body text.
- **Focus:** Border becomes Survey Yellow at 2px and the field keeps its fill. No glow, no
  outline offset, no color change to the text.
- **Error:** Border becomes Ember at 2px, with the message directly beneath in Ember at Label
  size. Never a red fill.
- **Placeholder:** Muted text. Never italic.
- **Labels:** Above the field in Label style, uppercase, muted. Omitted entirely when the
  field's purpose is obvious from context, which is most of the time.

### Navigation

- **Style:** Bottom tab bar on Basalt with a 1px Cairn top border. Icons at 24px with Label-
  style text beneath.
- **Active:** Icon and text both step to primary text color, and a 2px Survey Yellow bar sits
  flush at the top edge of the tab. Do not tint the whole icon yellow.
- **Inactive:** Ash, no bar.

### Item Row (signature component)

The single most important surface in the product. A 56px-minimum row that must be readable in
sun and hittable with gloves.

- **Left:** A 28px state control (see Checkbox) with a 44px touch target.
- **Center:** Item name in Title style. Beneath it, when present, a metadata line: person
  chips, then note, in Label/Body muted.
- **Right:** Quantity in Numeric style when greater than 1, right-aligned so the column is
  scannable.
- **Unpacked:** Full-opacity text, empty square control.
- **Packed:** Survey Yellow filled square with an Ink check. Text stays full opacity. Packed
  is not "done and gone", it is "handled".
- **Loaded:** Trail Green filled square with an Ink box glyph, and the item name drops to
  muted. This is the only state that dims text, because loaded items are genuinely finished.
- **Press:** Whole row is the target for opening detail; the control is a separate target for
  advancing state.

### Checkbox

- **Shape:** 28px square, 4px radius. Not a circle: circles read as radio buttons and as
  "select one".
- **Unpacked:** 2px Cairn border, no fill.
- **Packed:** Survey Yellow fill, Ink check glyph, no border.
- **Loaded:** Trail Green fill, Ink box glyph, no border.
- **Transition:** 120ms ease-out-quint on fill and glyph scale, from 0.8 to 1. Nothing else
  moves. Under reduced motion the change is instant.

### Bottom Sheet

- **Shape:** 16px top corners only. This is the single exception to the 8px maximum, because
  a sheet is a physically different object from the flat field below it.
- **Surface:** Raised Stone, with Sheet Lift shadow and a 36x4px Cairn grab handle centered
  8px from the top.
- **Scrim:** Basalt at 60% opacity. Tapping it dismisses.
- **Motion:** 240ms ease-out-quint slide from the bottom edge; dismissal is 180ms.
- **Use for:** Adding an item, editing an item, and capturing a reflection. Not for
  confirmations, which are inline.

### Empty State

- **Structure:** Headline (24px, 700), one line of Body muted beneath it, then a single
  primary button. Nothing else.
- **Illustration:** None. No mascots, no scenic vignettes, no oversized icons. At most a
  24px muted glyph above the headline.
- **Copy:** States the situation and the next action in plain language. "No trips yet." /
  "Start one, or build it from a past trip." Never "Looks like it's empty in here!"

## 6. Do's and Don'ts

### Do:

- **Do** verify every text color against its actual background before shipping it. AA (4.5:1)
  is the floor, and primary content should clear 7:1, because AA assumes indoor light.
- **Do** use Survey Yellow as a fill with Ink on top. In the light scheme this is the *only*
  legal use of it.
- **Do** give every state a shape or glyph difference in addition to its color difference.
- **Do** keep interactive targets at 52px for primary packing actions and never below 44pt
  anywhere.
- **Do** set every changeable number in the tabular numeric style.
- **Do** let rows grow with Dynamic Type instead of clipping or truncating user text.
- **Do** treat offline as normal: a pending write renders as settled, with no banner, badge,
  or spinner.
- **Do** use full-bleed grouped lists with section headers instead of cards.

### Don't:

- **Don't** build a **generic SaaS dashboard**: no card grids, no hero-metric blocks, no
  gradient accents, no purple-on-white. If it could appear in a YC deck, delete it.
- **Don't** build a **cutesy or gamified checklist**: no confetti, streaks, badges, mascots,
  bouncy or elastic easing, and no celebration of routine actions. Finishing a packing list
  is not an achievement.
- **Don't** build a **cluttered outdoor-retail app**: no promo banners, no product
  photography, no heavy chrome, no competing entry points.
- **Don't** build a **sterile enterprise form UI**: no dense gray tables, no sub-44pt targets,
  no endless label-above-input stacks.
- **Don't** reach for the category reflexes: no forest green and brown, no wood or canvas
  textures, no mountain-range glyphs, and equally no tactical black with safety orange.
- **Don't** use Survey Yellow as text, as an icon stroke, or as a hairline on light
  backgrounds. It measures 1.79:1 there.
- **Don't** put a shadow on anything that is not a bottom sheet.
- **Don't** use `border-left` or `border-right` above 1px as a colored accent stripe.
- **Don't** use gradient text, glassmorphism, or nested cards under any circumstance.
- **Don't** use em dashes in interface copy.
- **Don't** dim text for any state except *loaded*. Dimming is meaningful, not decorative.
