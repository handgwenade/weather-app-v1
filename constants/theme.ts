/**
 * RoadSignal design tokens.
 * Keep shared colors and typography primitives here so screens do not drift into
 * hex-code soup.
 */

import { Platform } from "react-native";

export const Palette = {
  ink: "#10142E",
  midnight: "#17124A",
  midnightSoft: "#241D66",

  primary: "#5637FF",
  primaryPressed: "#4728E6",
  primarySoft: "#EEEAFE",
  violet: "#8B5CF6",
  violetSoft: "#EDE7FF",
  cyan: "#48C7F4",
  cyanSoft: "#E5F8FE",
  glowPink: "#F0A7FF",

  background: "#F7F8FF",
  backgroundCool: "#F3F7FD",
  surface: "#FFFFFF",
  surfaceSoft: "#EEF1FF",
  surfaceRaised: "#FBFCFF",
  border: "#DDE3F3",
  borderStrong: "#C7D0E6",

  textPrimary: "#10142E",
  textSecondary: "#65708A",
  textMuted: "#94A3B8",
  textOnDark: "#FFFFFF",

  normal: "#22C77A",
  caution: "#FFD23F",
  elevated: "#FF7A1A",
  high: "#E22D4F",
} as const;

export const Gradients = {
  hero: [Palette.primary, Palette.cyan, Palette.violet] as const,
  storm: [Palette.midnight, Palette.primary, Palette.cyan] as const,
  softGlow: [
    Palette.primarySoft,
    Palette.cyanSoft,
    Palette.violetSoft,
  ] as const,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Shadows = {
  card: {
    shadowColor: Palette.midnight,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  soft: {
    shadowColor: Palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
} as const;

export const Colors = {
  light: {
    text: Palette.textPrimary,
    background: Palette.background,
    tint: Palette.primary,
    icon: Palette.textSecondary,
    tabIconDefault: Palette.textMuted,
    tabIconSelected: Palette.primary,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: Palette.cyan,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: Palette.cyan,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
