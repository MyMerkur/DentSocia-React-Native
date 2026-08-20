import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radii, spacing, withAlpha, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

export type BadgeVariant = "neutral" | "blue" | "gold" | "success" | "warning" | "danger";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

function getVariantColors(variant: BadgeVariant, colors: ThemeColors): { background: string; text: string } {
  switch (variant) {
    case "blue":
      return { background: colors.iceBg, text: colors.accentBlue };
    case "gold":
      return { background: colors.goldBg, text: colors.accentGold };
    case "success":
      return { background: withAlpha(colors.success, 0.14), text: colors.success };
    case "warning":
      return { background: withAlpha(colors.warning, 0.14), text: colors.warning };
    case "danger":
      return { background: withAlpha(colors.danger, 0.14), text: colors.danger };
    case "neutral":
    default:
      return { background: colors.surfaceElevated, text: colors.textSecondary };
  }
}

export function Badge({ label, variant = "neutral" }: BadgeProps) {
  const { colors } = useTheme();
  const variantColors = getVariantColors(variant, colors);
  return (
    <View style={[styles.badge, { backgroundColor: variantColors.background }]}>
      <Text style={[styles.label, { color: variantColors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 4,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
});
