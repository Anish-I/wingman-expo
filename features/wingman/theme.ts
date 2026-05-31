import type { TextStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

const shared = {
  sky50: '#EFF7FF',
  sky100: '#DCEDFF',
  sky200: '#B9DAFF',
  sky300: '#8FC1FF',
  sky400: '#5FA4FB',
  sky500: '#3B82F6',
  sky600: '#2563EB',
  sky700: '#1D4ED8',
  sky800: '#1E40AF',
  sky900: '#1E3A8A',
  sun100: '#FFF4C7',
  sun200: '#FFE58A',
  sun300: '#FFD54A',
  sun400: '#F5BC1E',
  sun500: '#D99B00',
  coral100: '#FFE2D6',
  coral300: '#FF9D7F',
  coral500: '#F26A46',
  mint100: '#D6F5E3',
  mint300: '#78DBA3',
  mint500: '#3BB273',
  lav100: '#E7E1FF',
  lav300: '#B6A6FA',
  lav500: '#8B7CF6',
  success: '#3BB273',
  error: '#E24C4B',
  warning: '#F5BC1E',
  info: '#3B82F6',
} as const;

export const wingmanColors = {
  light: {
    ...shared,
    bg: '#FBF5E9',
    bgAlt: '#F6EEDC',
    card: '#FFFFFF',
    cardAlt: '#FDF8EC',
    section: '#F0E7D1',
    elevated: '#FFFFFF',
    border: '#E8DBBF',
    borderStrong: '#C9B68B',
    ink: '#1B2240',
    inkSoft: '#2D3555',
    fgPrimary: '#1B2240',
    fgSecondary: '#4A5070',
    fgMuted: '#7C8299',
    fgDisabled: '#B8BACB',
    fgInverse: '#FBF5E9',
  },
  dark: {
    ...shared,
    bg: '#10162C',
    bgAlt: '#141B36',
    card: '#1B2240',
    cardAlt: '#1F2749',
    section: '#232B52',
    elevated: '#262F5A',
    border: '#2E3868',
    borderStrong: '#414D80',
    ink: '#F5EBD1',
    inkSoft: '#D4C9A8',
    fgPrimary: '#F5EBD1',
    fgSecondary: '#D4C9A8',
    fgMuted: '#8892BC',
    fgDisabled: '#4B557D',
    fgInverse: '#10162C',
  },
} as const;

export type WingmanColors = (typeof wingmanColors)[ResolvedTheme];

export const wingmanFonts = {
  display: 'Fraunces',
  text: 'Inter',
  altDisplay: 'Sora',
} as const;

export const wingmanLayout = {
  radiusXs: 6,
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 28,
  screenPadding: 22,
  tabBarHeight: 100,
} as const;

export const wingmanTypography = {
  screenTitle: {
    fontFamily: wingmanFonts.display,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 35,
    letterSpacing: 0,
  } satisfies TextStyle,
  onboardingTitle: {
    fontFamily: wingmanFonts.display,
    fontSize: 38,
    fontWeight: '700',
    lineHeight: 41,
    letterSpacing: 0,
  } satisfies TextStyle,
  onboardingBody: {
    fontFamily: wingmanFonts.text,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    letterSpacing: 0,
  } satisfies TextStyle,
  body: {
    fontFamily: wingmanFonts.text,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0,
  } satisfies TextStyle,
  label: {
    fontFamily: wingmanFonts.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  } satisfies TextStyle,
} as const;

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const value = Number.parseInt(safeHex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function stickerShadow(theme: ResolvedTheme) {
  return theme === 'dark'
    ? '0 3px 0 rgba(0, 0, 0, 0.35)'
    : '0 3px 0 rgba(27, 34, 64, 0.10)';
}

export function stickerShadowLarge(theme: ResolvedTheme) {
  return theme === 'dark'
    ? '0 5px 0 rgba(0, 0, 0, 0.40)'
    : '0 5px 0 rgba(27, 34, 64, 0.12)';
}

export function skyShadow() {
  return '0 4px 0 rgba(29, 78, 216, 0.20), 0 10px 24px rgba(59, 130, 246, 0.34)';
}

export function sunShadow() {
  return '0 3px 0 rgba(217, 155, 0, 0.20), 0 8px 18px rgba(245, 188, 30, 0.35)';
}

export function coralShadow() {
  return '0 3px 0 rgba(242, 106, 70, 0.22), 0 8px 18px rgba(242, 106, 70, 0.30)';
}
