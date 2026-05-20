// Design tokens for the phosphor-modem aesthetic.
// Colors are theme-aware (see ThemeContext for accent variants).
// Anything that is NOT theme-aware lives here as a frozen constant.

export type PhosphorTheme = 'cyan' | 'amber' | 'green' | 'magenta' | 'violet';

// Accent triplets per theme (base + soft @ 0.14 alpha + glow @ 0.35 alpha).
export const THEME_ACCENTS: Record<
  PhosphorTheme,
  { base: string; soft: string; glow: string; label: string }
> = {
  cyan:    { base: '#00e5ff', soft: 'rgba(0, 229, 255, 0.14)',  glow: 'rgba(0, 229, 255, 0.35)',  label: 'Cyan · classic'   },
  amber:   { base: '#ffb347', soft: 'rgba(255, 179, 71, 0.14)', glow: 'rgba(255, 179, 71, 0.35)', label: 'Amber · vintage'  },
  green:   { base: '#7fff95', soft: 'rgba(127, 255, 149, 0.14)',glow: 'rgba(127, 255, 149, 0.35)',label: 'Green · phosphor' },
  magenta: { base: '#ff7ad9', soft: 'rgba(255, 122, 217, 0.14)',glow: 'rgba(255, 122, 217, 0.35)',label: 'Magenta · neon'   },
  violet:  { base: '#b598ff', soft: 'rgba(181, 152, 255, 0.14)',glow: 'rgba(181, 152, 255, 0.35)',label: 'Violet · synth'   },
};

// Static / non-themed palette.
export const palette = {
  warm:           '#ffb347',
  warmSoft:       'rgba(255, 179, 71, 0.14)',
  warmGlow:       'rgba(255, 179, 71, 0.4)',
  success:        '#7fff95',
  successSoft:    'rgba(127, 255, 149, 0.10)',
  successGlow:    'rgba(127, 255, 149, 0.35)',
  danger:         '#ff5d6c',
  dangerSoft:     'rgba(255, 93, 108, 0.08)',
  dangerBorder:   'rgba(255, 93, 108, 0.40)',
  bgDeep:         '#07090e',
  bgCard:         'rgba(255, 255, 255, 0.025)',
  bgCardStrong:   'rgba(255, 255, 255, 0.045)',
  bgInset:        'rgba(0, 0, 0, 0.35)',
  bgInsetStrong:  'rgba(0, 0, 0, 0.50)',
  border:         'rgba(255, 255, 255, 0.08)',
  borderStrong:   'rgba(255, 255, 255, 0.14)',
  text:           '#f0f3f7',
  textMute:       'rgba(255, 255, 255, 0.55)',
  textDim:        'rgba(255, 255, 255, 0.35)',
  fileColorPdf:   '#ff5d6c',
  fileColorImg:   '#ffb347',
  fileColorAud:   '#7fff95',
  fileColorZip:   '#c4a3ff',
} as const;

// Font families. Loaded at app boot via expo-font; system fallbacks listed so
// dev builds without fonts still render reasonable text.
export const fonts = {
  ui:     'SpaceGrotesk_500Medium',
  uiBold: 'SpaceGrotesk_600SemiBold',
  mono:   'JetBrainsMono_500Medium',
  monoBold:'JetBrainsMono_600SemiBold',
  serif:  'InstrumentSerif_400Regular_Italic',
} as const;

// Type scale (compact).
export const type = {
  titleSerif:    { fontFamily: fonts.serif,  fontSize: 38, lineHeight: 38, letterSpacing: -0.6 },
  titleMonoChip: { fontFamily: fonts.monoBold, fontSize: 24, letterSpacing: 0.96 },
  eyebrow:       { fontFamily: fonts.mono,   fontSize: 10, letterSpacing: 2.2 },
  body:          { fontFamily: fonts.ui,     fontSize: 14 },
  bodyStrong:    { fontFamily: fonts.uiBold, fontSize: 14 },
  monoSmall:     { fontFamily: fonts.mono,   fontSize: 11, letterSpacing: 0.6 },
  monoTiny:      { fontFamily: fonts.mono,   fontSize:  9, letterSpacing: 1.6 },
  monoLabel:     { fontFamily: fonts.mono,   fontSize: 10, letterSpacing: 1.8 },
  monoBig:       { fontFamily: fonts.monoBold, fontSize: 42, letterSpacing: -0.8 },
  dialNumber:    { fontFamily: fonts.monoBold, fontSize: 24, letterSpacing: -0.2 },
  buttonLabel:   { fontFamily: fonts.uiBold, fontSize: 15, letterSpacing: 0.15 },
} as const;

// Spacing scale.
export const space = {
  screenPadH:  20,
  screenPadTop: 24,
  screenPadBot: 100,
  cardPad:     16,
  cardPadCompact: 14,
  sectionGap:  20,
  rowGap:      10,
  microGap:     6,
} as const;

// Radii.
export const radius = {
  card:    14,
  button:  12,
  picker:  12,
  chip:    10,
  toggle:    8,
  file:     6,
  pill:   999,
} as const;
