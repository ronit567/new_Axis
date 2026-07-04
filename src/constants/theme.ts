export const COLORS = {
  primary: '#5C2D91',
  primaryDark: '#4A2070',
  primaryDeep: '#391A57',
  primaryTint: '#F3EEFF',
  primarySoft: '#EEE8F8',
  primaryBorder: '#DDD0F5',
  white: '#FFFFFF',
  background: '#F8F8F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5FA',
  inputBorder: '#E0E0E0',
  inputBorderFocused: '#5C2D91',
  inputBackground: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B6B7B',
  textMuted: '#9E9EAE',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#F5A623',
  divider: '#F0F0F0',
  stepActive: '#5C2D91',
  stepInactive: '#D9D9D9',
  westernGreen: '#4CAF50',
  overlay: 'rgba(20, 12, 36, 0.55)',
} as const;

export const SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  borderRadius: 12,
  borderRadiusSm: 8,
  borderRadiusLg: 20,
  borderRadiusXl: 28,
  inputHeight: 52,
  buttonHeight: 52,
} as const;

// expo-linear-gradient `colors` prop, brand purple deepening toward the bottom/end.
export const GRADIENTS = {
  primary: [COLORS.primary, COLORS.primaryDark] as [string, string],
  primaryDeep: [COLORS.primaryDark, COLORS.primaryDeep] as [string, string],
  primaryRadiant: ['#6E3AAE', COLORS.primary, COLORS.primaryDark] as [string, string, string],
} as const;

// DM Sans, loaded in App.tsx via @expo-google-fonts/dm-sans. Reserved for
// hero moments (wordmark, screen titles, prices, section headings) — body
// copy stays on the system font.
export const FONTS = {
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  extraBold: 'DMSans_800ExtraBold',
} as const;

// Layered shadow presets so elevation reads consistently across cards, sheets, and floating controls.
export const SHADOWS = {
  card: {
    shadowColor: '#150A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#150A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 4,
  },
  floating: {
    shadowColor: '#150A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  brand: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;
