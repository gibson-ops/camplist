---
name: Camp List
description: Trip-scoped packing lists that get smarter every trip
colors:
  signal: "#ffbb1b"
  signal-light: "#ffbd1f"
  on-signal: "#140e06"
  loaded: "#55b364"
  loaded-light: "#427d45"
  danger: "#e75750"
  danger-light: "#be4a46"
  dark-bg: "#0a0b0c"
  dark-surface: "#202223"
  dark-raised: "#2c2e2f"
  dark-border: "#646668"
  dark-text: "#f4f5f6"
  dark-muted: "#b0b1b3"
  light-bg: "#f3f5f7"
  light-surface: "#fcfeff"
  light-sunken: "#e4e6e8"
  light-border: "#b2b4b6"
  light-text: "#1c1d1e"
  light-muted: "#6f7072"
typography:
  display:
    fontFamily: "Inter_800ExtraBold"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Inter_700Bold"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  title:
    fontFamily: "Inter_500Medium"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0px"
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0px"
  label:
    fontFamily: "Inter_700Bold"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.8px"
  numeric:
    fontFamily: "ui-monospace"
    fontSize: "13px"
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
    padding: "14px 24px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.md}"
    padding: "14px 24px"
    height: "46px"
  item-row:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.xs}"
    padding: "8px 16px"
    height: "44px"
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
    padding: "12px 16px"
    height: "46px"
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

Camp List is a field instrument, not an app that happens to be about camping. It is dense on
purpose: a packing list you cannot see is not doing its job, so the screen never spends space
on breathing room that could be showing the next four items. Rows are 44pt and edge-to-edge,
and content sits 16pt from the screen edge — never 32pt, which is what happens when a group
carries its own margin on top of the row's padding. Type does the hierarchy work
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
- Squared-off geometry (2-8px). Rows are edge-to-edge; nothing floats in a card.
- Every state readable without color: shape and glyph carry the meaning too.

## 2. Colors: The Survey Palette

**A warm signal on cool neutrals.** The neutrals sit at oklch hue 247 with chroma 0.003 —
effectively achromatic, a hair cool — while the signal is a warm amber at hue 79. That
warm-on-cool split separates far harder than a warm-on-warm palette does: the signal becomes
the only chromatic thing on the screen, so it needs less area to carry the same weight. The
neutrals get out of the way; scenery is what you went outside to look at.

Every value here is contrast-verified, not eyeballed. The ratios quoted are measured.

### Primary

- **Survey Amber** (`#ffbb1b` dark / `#ffbd1f` light): The one signal. Primary actions, the
  packed state, focus rings, current selection. It marks what to do next or what is already
  handled. Nothing else may use it.
- **Ink** (`#140e06`): The near-black that sits on Survey Amber (11.3:1 dark, 11.5:1 light).
  Warm and never pure black, so an amber fill does not vibrate.

### Secondary

- **Trail Green** (`#55b364` dark / `#427d45` light): The *loaded* state, the resting step
  after packed. The light value is deliberately deeper than its dark counterpart because it
  is used as badge TEXT as well as a fill, so it must clear 4.5:1 (it measures 4.5) rather
  than the 3:1 a pure fill would need.

### Tertiary

- **Ember** (`#e75750` dark / `#be4a46` light): Destructive actions and genuine errors only.
  Never for validation nagging or overdue timing, which are not failures.

### Neutral

Dark scheme, the default. The scene is a campsite at dusk with a headlamp on, or a phone
checked inside a tent at 5am without waking anyone.

- **Basalt** (`#0a0b0c`): App background.
- **Slate Stone** (`#202223`): Row surfaces.
- **Raised Stone** (`#2c2e2f`): Pressed states, sheet backgrounds.
- **Cairn** (`#646668`): Hairlines. Markedly lighter than a conventional dark-mode divider
  (2.8:1 on surface) because a divider that reads indoors disappears in sunlight.
- **Bone** (`#f4f5f6`): Primary text. 18.1:1 on Basalt.
- **Ash** (`#b0b1b3`): Secondary text, labels, metadata. 9.2:1 on Basalt.

Light scheme. The scene is a driveway at 11am in July, loading the car, phone at arm's length
in direct sun.

- **Paper** (`#f3f5f7`): App background.
- **Chalk** (`#fcfeff`): Row surfaces, lifted above Paper.
- **Sunken Paper** (`#e4e6e8`): Inset wells, disabled fills.
- **Graphite Line** (`#b2b4b6`): Hairlines.
- **Char** (`#1c1d1e`): Primary text. 15.5:1 on Paper.
- **Slate** (`#6f7072`): Secondary text. 4.5:1 on Paper — this is the tightest value in the
  system and must not be lightened.

### Named Rules

**The Fill-Only Rule.** Survey Amber measures **1.53:1** against the light background. It is
therefore *forbidden* as text, as an icon stroke, or as a hairline in the light scheme. It may
appear only as a filled shape with Ink on top. This is not a preference; it is the measured
limit of the color, and it is the price of a signal bright enough to work in the dark scheme.

**The One Voice Rule.** Survey Amber covers no more than 10% of any screen. A list where every
row is amber has no signal at all. If two things compete for it, one of them is not primary.

**The Colorblind Floor.** No state is ever communicated by hue alone. Packed is amber *and* a
filled check. Loaded is green *and* a box glyph. Unpacked is muted *and* an empty square.
Remove all color and the screen must still be readable.

**The Opposite Polarity Rule.** Text on a colored fill does not use one fixed color. Ink sits
on amber in both schemes, but on Ember the dark scheme takes Ink (5.4:1) while the light scheme
takes Bone (4.5:1) — the two reds have opposite lightness. Always check the fill, not the scheme.

## 3. Typography

**Display / Body / Label Font:** Inter (loaded at launch; system face as failure fallback)
**Numeric Font:** ui-monospace (SF Mono, Roboto Mono)

**Character:** Inter is chosen for a specific reason, not for novelty. At the same nominal
weight it sets slightly heavier and wider than SF Pro, which lets item names hold their
presence at 15/500 where the system face went limp. That buys density: the row can shrink
without the content feeling thin. The cost is real and accepted — a font load before first
paint, and the file ships on web too.

Item names are 15/500, deliberately toned down from an earlier 17/600 that read as shouty
once rows got dense. Numbers stay on the platform monospace for tabular alignment.

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

**The Decoupling Rule.** Visual height and touch target are separate numbers. A 44pt row can
carry a 24pt control that still presents a 44pt target via `hitSlop`. Density is therefore
never an excuse to shrink a target, and a large target is never an excuse for a fat row.

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

The single most important surface in the product. A 44pt row that must stay readable in sun
and hittable with gloves, while showing as much of the list as possible.

- **Left:** a 24pt state control with a 44pt touch target (see The Decoupling Rule).
- **Center:** item name (Title) and, sharing the same baseline, a muted note. One line.
- **Right:** an `EACH` tag when relevant, then quantity in Numeric when greater than 1.
- **No per-person marker.** Lists are owned by a person, so on Jared's list every item is
  Jared's and an avatar is noise. The only ambiguity is on the SHARED list, and there the
  useful fact is not *who* but *how many*: `EACH` (everyone brings their own) versus nothing
  (one covers the family). One tag beats a row of faces.
- **Unpacked:** full-opacity text, empty square.
- **Packed:** Survey Yellow fill, Ink check. Text stays full opacity — packed is "handled",
  not "gone".
- **Loaded:** Trail Green fill, Ink box glyph, name drops to muted. The ONLY state that dims
  text, because loaded items are genuinely finished.

### Kit Row (the camp kitchen box)

A kit is just an item that contains other items. It packs and loads like anything else AND
holds contents that need checking, so it carries both a state control and a verification
badge.

- **Collapsed:** chevron, state control, name, item count, and a badge — `N to check` in
  Survey Yellow when consumables are unverified, or a `checked` outline in Trail Green.
- **Expanded:** contents render as nested rows, indented, 38pt, with a 20pt control.
- **Only consumables gate it.** The parent cannot be marked packed while an unverified
  consumable remains, and its control dims to show why. Non-consumables (the skillet, the
  utensils) live in the box permanently and are shown for reference, never as a chore.
- The blocked control is dimmed AND non-interactive; the badge carries the explanation, so
  the state is never communicated by dimming alone.

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

- **Do** keep groups EDGE TO EDGE. The row's own 16pt padding is the only horizontal inset.
  A group that also carries `marginHorizontal` doubles it to 32pt and turns the group into a
  card, which this system does not use.
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
- **Don't** put a per-person avatar, chip, or initial on an item row. The list already says
  whose it is.
- **Don't** make the user tick off a non-consumable inside a kit. The skillet never left.
- **Don't** use `border-left` or `border-right` above 1px as a colored accent stripe.
- **Don't** use gradient text, glassmorphism, or nested cards under any circumstance.
- **Don't** use em dashes in interface copy.
- **Don't** dim text for any state except *loaded*. Dimming is meaningful, not decorative.
