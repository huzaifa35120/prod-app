import { TextStyle } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */

export const colors = {
  // Base — near-black with a cool cast so accents read as light sources.
  bg: '#07090E',
  bgSoft: '#0B0F17',
  surface: '#111725',
  surfaceHi: '#18202F',
  surfaceMax: '#1F293A',

  border: '#1E2736',
  borderHi: '#2C3849',
  borderGlow: '#3B4A63',

  text: '#F3F6FB',
  textDim: '#9CAABF',
  textFaint: '#61708A',

  // Accent — "you"
  primary: '#7C93FF',
  primaryInk: '#050A18',
  primaryDim: '#1A2145',
  primaryEdge: '#3A4A9E',

  // Opponent
  rival: '#C084FC',
  rivalDim: '#2A1B45',
  rivalEdge: '#7C3AED',

  // Completion
  green: '#34D399',
  greenInk: '#04140D',
  greenDim: '#0C2A22',
  greenEdge: '#177C5C',

  amber: '#FBBF24',
  amberDim: '#2C2007',
  amberEdge: '#8A6410',

  red: '#F87171',
  redDim: '#2C1315',
  redEdge: '#8C2F32',

  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Multi-stop gradients. Spread into <LinearGradient colors={...} />. */
export const gradients = {
  primary: ['#6D8BFF', '#8B5CF6'] as const,
  green: ['#34D399', '#0EA47A'] as const,
  rival: ['#C084FC', '#7C3AED'] as const,
  amber: ['#FBBF24', '#F59E0B'] as const,
  surface: ['#141B2B', '#0E1420'] as const,
  hero: ['#1A2340', '#0B1020', '#07090E'] as const,
  danger: ['#F87171', '#DC2626'] as const,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32, pill: 999 } as const;

/* ------------------------------------------------------------------ */
/*  Type                                                               */
/* ------------------------------------------------------------------ */

/** Font family names, matching the keys loaded in app/_layout.tsx. */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMd: 'SpaceGrotesk_600SemiBold',
  displayLight: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMd: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/**
 * Ready-made text styles. Space Grotesk carries headings and every number
 * (it has proper tabular figures, which the timer needs); Inter carries prose.
 */
export const type = {
  hero: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: colors.text,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.7,
    color: colors.text,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: colors.text,
  },
  h3: {
    fontFamily: fonts.displayMd,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  bodySm: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textDim,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  /** Section headers — small, wide, quiet. */
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textFaint,
  },
  /** Big numerals — stats, tallies. */
  numeral: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  /** The stopwatch face. */
  clock: {
    fontFamily: fonts.displayLight,
    fontSize: 52,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  button: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    letterSpacing: -0.1,
  },
} satisfies Record<string, TextStyle>;

/* ------------------------------------------------------------------ */
/*  Elevation                                                          */
/* ------------------------------------------------------------------ */

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  float: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/** Coloured glow beneath an accent element. */
export function glow(color: string, opacity = 0.4) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  };
}
