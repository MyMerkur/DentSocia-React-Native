import { Check, X } from "lucide-react-native";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fontFamilies, spacing, typographyPresets, withAlpha, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

export type ResultCardTone = "success" | "danger";

interface ResultCardProps {
  tone?: ResultCardTone;
  title: string;
  description: string;
  style?: StyleProp<ViewStyle>;
}

function toneColor(tone: ResultCardTone, colors: ThemeColors): string {
  return tone === "success" ? colors.success : colors.danger;
}

// Confirmation/result state (spec §7.14) — used for KYC verification results and
// similar one-shot outcome messages. Not a modal, an inline card.
export function ResultCard({ tone = "success", title, description, style }: ResultCardProps) {
  const { colors } = useTheme();
  const accent = toneColor(tone, colors);
  const Icon = tone === "success" ? Check : X;

  return (
    <View style={[styles.card, { backgroundColor: withAlpha(accent, 0.1), borderColor: withAlpha(accent, 0.4) }, style]}>
      <Icon size={16} color={accent} strokeWidth={2.25} />
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        <Text style={[styles.title, { color: accent }]}>{title}</Text> — {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.sm + 1,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.sm + 3,
  },
  title: {
    fontFamily: fontFamilies.bold,
  },
  description: {
    ...typographyPresets.bodySmall,
    flex: 1,
    lineHeight: 19,
  },
});
