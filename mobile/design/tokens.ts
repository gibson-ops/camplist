/**
 * Camp List design tokens. See DESIGN.md for the reasoning behind every value here.
 *
 * Canonical color space is OKLCH (kept in the comments); the hex values are the sRGB
 * conversions actually used at runtime. Contrast ratios noted below were measured, not
 * estimated, and are the reason several of these values are what they are.
 */

/**
 * Raw palette. Prefer the semantic `theme.color.*` names over reaching in here.
 *
 * The organizing idea is a WARM SIGNAL ON COOL NEUTRALS. Neutrals sit at oklch hue 247 with
 * chroma 0.003 — effectively achromatic, a hair cool — while the signal is a warm amber at
 * hue 79. Warm-on-cool separates far harder than the warm-on-warm palette this replaced, so
 * the signal reads as the only chromatic thing on screen and needs less area to do its job.
 *
 * Every value below is contrast-verified (see the ratios noted per line). Three light-scheme
 * values are one notch darker than first drafted because they missed AA at their original
 * lightness; the deltas are small and the hue/chroma are untouched.
 */
export const palette = {
  // Signal — warm amber, oklch(84% .17 79). Ink on it: 11.3:1 dark, 11.5:1 light.
  signal: '#ffbb1b',
  signalLight: '#ffbd1f',
  onSignal: '#140e06',

  /**
   * Loaded state. TWO roles, because a fill and a piece of text owe different ratios.
   *
   * These used to be one token and the FILL paid for it: satisfying the 4.5:1 that text needs
   * on paper dragged the light value to oklch(53% .106 145) — darker AND desaturated, which
   * reads brownish rather than green. A fill is a non-text UI component and only owes 3:1
   * (WCAG 1.4.11), so it gets to be an actual green; the text keeps the darker value.
   */
  loaded: '#60b077', // FILL · oklch(69% .115 152) · 7.5:1 on basalt, ink glyph 7.3:1
  loadedLight: '#007137', // FILL · oklch(48% .115 152) · 5.6:1 on paper, bone glyph 5.6:1
  loadedText: '#60b077', // TEXT · 7.5:1 on basalt
  loadedTextLight: '#198044', // TEXT · 4.6:1 on paper

  // Destructive. Light value darkened #d74843 -> for AA as error text under an input.
  danger: '#e75750', // 5.5:1 on basalt
  dangerLight: '#be4a46', // 4.5:1 on paper

  // Cool neutrals, dark scheme — oklch hue 247, chroma 0.003
  basalt: '#0a0b0c',
  slateStone: '#202223',
  raisedStone: '#2c2e2f',
  cairn: '#646668', // 2.8:1 on surface — dividers finally visible outdoors
  bone: '#f4f5f6', // 18.1:1 on basalt
  ash: '#b0b1b3', // 9.2:1 on basalt

  // Cool neutrals, light scheme
  paper: '#f3f5f7',
  chalk: '#fcfeff',
  sunkenPaper: '#e4e6e8',
  graphiteLine: '#b2b4b6',
  char: '#1c1d1e', // 15.5:1 on paper
  slate: '#6f7072', // darkened from #7b7c7d (3.83:1) -> 4.5:1 on paper
} as const;

/** 4px base scale. Vary these for rhythm; uniform padding everywhere is monotony. */
export const space = {
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Squared-off geometry. `pill` exists only for person chips; `sheet` only for bottom sheets. */
export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  sheet: 16,
  pill: 999,
} as const;

/**
 * Font families. Source Sans 3 is loaded at launch (see design/useFonts.ts).
 *
 * Chosen over Inter and a field of 11 others on three counts: it stays highly legible at
 * small sizes (it's a humanist face designed for exactly that), it's clearly not the platform
 * default, and it sets ~12% narrower than Inter, so more of an item name survives before
 * truncating.
 *
 * Barlow Semi Condensed was the density winner at −21% and was REJECTED: condensed industrial
 * grotesques carry a discount-retail association (Harbor Freight, AutoZone) that undercuts
 * "trusted field instrument", and they degrade badly in prose — which matters because trip
 * reflections are paragraphs, not labels.
 *
 * The cost of any custom family is real and accepted: a load step before first paint, and the
 * files ship on web too. Numbers stay on the platform monospace for tabular alignment.
 */
export const font = {
  regular: 'SourceSans3_400Regular',
  medium: 'SourceSans3_500Medium',
  semibold: 'SourceSans3_600SemiBold',
  bold: 'SourceSans3_700Bold',
  extrabold: 'SourceSans3_800ExtraBold',
} as const;

/**
 * Type scale. Hierarchy comes from weight and tracking, never from color.
 * These are default steps: everything scales with Dynamic Type.
 *
 * Item names use `title` at 15/500 — toned down from the original 17/600, which read as
 * shouty once rows got dense.
 *
 * Hand-aligned one step per line, and left that way on purpose: a scale is only reviewable by
 * reading DOWN the columns, checking that each size, weight and line-height moves in step with
 * the one above it. Prettier gives every key its own line, which is correct for ordinary objects
 * and turns this into five paragraphs you can no longer compare.
 */
// prettier-ignore
export const type = {
  display:  { fontSize: 28, fontWeight: '800', lineHeight: 31, letterSpacing: -0.4, fontFamily: font.extrabold },
  headline: { fontSize: 22, fontWeight: '700', lineHeight: 27, letterSpacing: -0.2, fontFamily: font.bold },
  title:    { fontSize: 15, fontWeight: '500', lineHeight: 20, letterSpacing: 0,    fontFamily: font.medium },
  body:     { fontSize: 15, fontWeight: '400', lineHeight: 21, letterSpacing: 0,    fontFamily: font.regular },
  label:    { fontSize: 12, fontWeight: '700', lineHeight: 14, letterSpacing: 0.8,  fontFamily: font.bold },
  /**
   * Secondary fragments that are PROSE rather than keys: a trip's summary beside its name, the
   * consequence line under a checkbox.
   *
   * Label was doing this job with `textTransform: 'none', letterSpacing: 0` layered on at each
   * call site, which left every one of them at 700 weight — so the secondary text was bolder
   * than the primary text it sat next to and won the row.
   */
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16, letterSpacing: 0, fontFamily: font.regular },
  numeric: { fontSize: 13, fontWeight: '600', lineHeight: 16, letterSpacing: 0 },
} as const;

/**
 * Minimum hit targets. 52 for primary packing actions because they're pressed one-handed
 * with cold fingers; 44 is the absolute floor everywhere else.
 */
export const touch = {
  /** WCAG/HIG minimum. Rows sit AT this: visual height and tap target are decoupled via hitSlop. */
  floor: 44,
  /** Buttons stay generous — they're hit in a hurry, unlike rows which are aimed at. */
  primary: 46,
  row: 44,
  /** Nested rows inside an expanded kit; still ≥44 target via hitSlop on the control. */
  nestedRow: 38,
} as const;

/**
 * Iconography. Glyphs come from Lucide (`lucide-react-native`), never hand-drawn paths — see
 * DESIGN.md for why the packed state briefly shipped as a padlock.
 *
 * Lucide's default stroke of 2 is expressed in the icon's own 24-unit space, so it shrinks
 * with the icon: at the ~15px used inside a filled control it renders near 1.25px and
 * disappears in sunlight. 2.2 compensates without reading as bold.
 */
export const icon = { stroke: 2.2 } as const;

/** Ease-out-quint. No bounce, no elastic (see DESIGN.md: gamified is an anti-reference). */
export const motion = {
  easing: [0.22, 1, 0.36, 1] as const,
  state: 120,
  enter: 180,
  sheet: 240,
} as const;

export type ColorScheme = 'dark' | 'light';

/** Semantic color roles, resolved per scheme. Components only ever read these. */
function colorsFor(scheme: ColorScheme) {
  const dark = scheme === 'dark';
  return {
    bg: dark ? palette.basalt : palette.paper,
    surface: dark ? palette.slateStone : palette.chalk,
    raised: dark ? palette.raisedStone : palette.sunkenPaper,
    sunken: dark ? palette.basalt : palette.sunkenPaper,
    border: dark ? palette.cairn : palette.graphiteLine,
    text: dark ? palette.bone : palette.char,
    textMuted: dark ? palette.ash : palette.slate,

    /**
     * THE FILL-ONLY RULE: in the light scheme this measures 1.53:1 against bg. It is legal
     * only as a filled shape with `onSignal` on top (9.0:1). Never as text, icon stroke,
     * or hairline. See DESIGN.md.
     */
    signal: dark ? palette.signal : palette.signalLight,
    onSignal: palette.onSignal,

    /** The loaded FILL. */
    loaded: dark ? palette.loaded : palette.loadedLight,
    /**
     * The glyph that sits ON the loaded fill. OPPOSITE POLARITY between schemes, for the same
     * reason as onDanger.
     *
     * A dark glyph wants a light fill; the fill wants to be dark to clear 3:1 against paper.
     * Those pull against each other, and holding both with one dark glyph caps the check at
     * roughly 5:1 while the fill scrapes 3.1:1. Going light on a deep green satisfies both at
     * ~5.6:1 instead, and makes loaded read differently at a glance from packed's dark-on-amber.
     */
    onLoaded: dark ? palette.onSignal : palette.bone,
    /**
     * The loaded state written as TEXT (the kit's "checked" badge). Deliberately not the same
     * value as the fill: text owes 4.5:1 against bg, a fill owes 3:1, and making one value
     * satisfy both is what turned the light fill brownish. See the palette note.
     */
    loadedText: dark ? palette.loadedText : palette.loadedTextLight,

    danger: dark ? palette.danger : palette.dangerLight,
    /**
     * Text that sits ON a danger fill. The two schemes need OPPOSITE polarity: the dark
     * scheme's red is light (#df695c, takes dark text) while the light scheme's is deep
     * (#af2b25, needs light text). Using onSignal for both put near-black on dark red.
     */
    onDanger: dark ? palette.onSignal : palette.bone,

    scrim: dark ? 'rgba(21,17,12,0.6)' : 'rgba(36,30,23,0.4)',
    sheetShadow: dark ? 'rgba(0,0,0,0.45)' : 'rgba(36,30,23,0.18)',
  } as const;
}

export function buildTheme(scheme: ColorScheme) {
  return { scheme, color: colorsFor(scheme), space, radius, type, touch, motion } as const;
}

export type Theme = ReturnType<typeof buildTheme>;
