/**
 * Camp List design tokens. See DESIGN.md for the reasoning behind every value here.
 *
 * Canonical color space is OKLCH (kept in the comments); the hex values are the sRGB
 * conversions actually used at runtime. Contrast ratios noted below were measured, not
 * estimated, and are the reason several of these values are what they are.
 */

/** Raw palette. Prefer the semantic `theme.color.*` names over reaching in here. */
export const palette = {
  // Signal — oklch(84% .165 92) / oklch(78% .165 90)
  signal: '#f1c623',
  signalLight: '#e0b100',
  onSignal: '#19160b',

  // Loaded state — oklch(62% .105 150) / oklch(52% .105 150)
  loaded: '#549864',
  loadedLight: '#357a47',

  // Destructive — oklch(66% .15 28) / oklch(50% .17 28)
  danger: '#df695c',
  dangerLight: '#af2b25',

  // Warm stone neutrals, dark scheme
  basalt: '#15110c',
  slateStone: '#211c16',
  raisedStone: '#2d2821',
  cairn: '#423c34',
  bone: '#f1eee9',
  ash: '#a9a49c',

  // Warm stone neutrals, light scheme
  paper: '#f4f1ec',
  chalk: '#fdfcf8',
  sunkenPaper: '#ebe7e0',
  graphiteLine: '#cfcac1',
  char: '#241e17',
  slate: '#5d574f',
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
 * Type scale. Hierarchy comes from weight and tracking, never from color.
 * These are default steps: everything scales with Dynamic Type.
 */
export const type = {
  display: { fontSize: 32, fontWeight: '800', lineHeight: 35, letterSpacing: -0.5 },
  headline: { fontSize: 24, fontWeight: '700', lineHeight: 29, letterSpacing: -0.3 },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 22, letterSpacing: 0 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 23, letterSpacing: 0 },
  label: { fontSize: 12, fontWeight: '700', lineHeight: 14, letterSpacing: 0.8 },
  numeric: { fontSize: 15, fontWeight: '600', lineHeight: 18, letterSpacing: 0 },
} as const;

/**
 * Minimum hit targets. 52 for primary packing actions because they're pressed one-handed
 * with cold fingers; 44 is the absolute floor everywhere else.
 */
export const touch = {
  floor: 44,
  primary: 52,
  row: 56,
} as const;

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
     * THE FILL-ONLY RULE: in the light scheme this measures 1.79:1 against bg. It is legal
     * only as a filled shape with `onSignal` on top (9.0:1). Never as text, icon stroke,
     * or hairline. See DESIGN.md.
     */
    signal: dark ? palette.signal : palette.signalLight,
    onSignal: palette.onSignal,

    loaded: dark ? palette.loaded : palette.loadedLight,
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
