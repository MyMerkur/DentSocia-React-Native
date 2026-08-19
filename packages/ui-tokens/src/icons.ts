// Icon library decision (Faz 5, #57): `lucide-react-native`, backed by `react-native-svg`,
// stays the general-purpose icon set — SVG-based, consistent stroke style, tree-shakeable.
//
// Usage in screens: import icons directly from "lucide-react-native", e.g.
//   import { Search } from "lucide-react-native";
//   <Search size={iconSizes.md} color={colors.textPrimary} strokeWidth={iconStrokeWidth} />
//
// Design system v2 revision (DentSocia_Tasarim_Sistemi_ClaudeCode.md §8): the handful of
// *recurring structural* icons (lock, document, payment card, heart/like) are custom
// SVGs instead, under apps/mobile/src/components/icons/ — not a full icon-library swap,
// this stays the exception rather than the rule.
export const iconStrokeWidth = 1.75;

export const iconSizes = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;
