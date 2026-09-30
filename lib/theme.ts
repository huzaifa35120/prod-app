import { TextStyle } from 'react-native';

/* ==================================================================
 *  Athletic / editorial.
 *
 *  Rules this system holds to, because breaking them is what made the
 *  last version look generic:
 *    - No gradients. Flat fills only.
 *    - No glows. Depth comes from contrast and hairlines, not shadow.
 *    - One accent (lime) for YOU, one for your RIVAL (orange). Nothing
 *      else gets colour, so colour always means something.
 *    - Surfaces are near-black neutrals, not blue-tinted.
 *    - Structure comes from hairline rules and spacing, not from
 *      wrapping everything in a card.
 * ================================================================== */

export const colors = {
  // Neutral near-blacks — no blue cast.
  bg: '#0A0A0B',
  surface: '#121213',
  surfaceHi: '#19191B',
  surfaceMax: '#232326',

  /** Hairline rules. The main structural device. */
  line: '#232326',
  lineBright: '#33333833',

  text: '#F7F7F5',
  textDim: '#9A9A96',
  textFaint: '#63635F',

  /** You. The only bright colour in the app. */
  accent: '#CCFF00',
  accentInk: '#0A0A0B',
  accentDim: '#1E2400',

  /** Your rival. */
  rival: '#FF4D00',
  rivalInk: '#0A0A0B',
  rivalDim: '#2A1000',

  /** A finished day. Same lime — completion and "you" are the same idea. */
  done: '#CCFF00',
  doneDim: '#1E2400',

  /** Partial progress. */
  partial: '#8A8A86',

  danger: '#FF3B30',
  dangerDim: '#2A0E0C',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Tight radii. Big pills read as "friendly SaaS"; this app is not that. */
export const radius = { xs: 2, sm: 4, md: 6, lg: 10, xl: 14, pill: 999 } as const;

export const fonts = {
  /** Archivo — heavy, slightly condensed. Headlines and every number. */
  display: 'Archivo_800ExtraBold',
  displayBold: 'Archivo_700Bold',
  displayMd: 'Archivo_600SemiBold',
  /** IBM Plex Sans — technical, a bit mechanical. Prose and labels. */
  body: 'IBMPlexSans_400Regular',
  bodyMd: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  bodyBold: 'IBMPlexSans_700Bold',
} as const;

export const type = {
  /** Screen titles. Uppercase, very tight. */
  hero: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: -1.2,
    textTransform: 'uppercase',
    color: colors.text,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 27,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color: colors.text,
  },
  h2: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.35,
    color: colors.text,
  },
  h3: {
    fontFamily: fonts.displayMd,
    fontSize: 15,
    lineHeight: 19,
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
    fontFamily: fonts.bodyMd,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },

  /** Section markers: small, wide, quiet. Paired with a hairline rule. */
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textFaint,
  },

  /** Numbers carry the app. Always tabular so columns line up. */
  statLg: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  statMd: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  statSm: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  /** The stopwatch face. */
  clock: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  button: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

/** Screen gutter, used everywhere so edges align across screens. */
export const GUTTER = spacing.lg + 2;
