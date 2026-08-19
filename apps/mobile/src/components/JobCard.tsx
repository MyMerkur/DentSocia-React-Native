import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fontFamilies, radii, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

interface JobCardProps {
  tag: string;
  timestamp: string;
  clinicName: string;
  subtitle: string;
  ctaLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Job/announcement card (spec §7.5) — `ice` category pill + Fraunces clinic name.
export function JobCard({ tag, timestamp, clinicName, subtitle, ctaLabel = "Detayları Gör →", onPress, style }: JobCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      <View style={styles.topRow}>
        <View style={[styles.tag, { backgroundColor: colors.accentBlue }]}>
          <Text style={[styles.tagText, { color: colors.background }]}>{tag}</Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{timestamp}</Text>
      </View>
      <Text style={[styles.clinic, { color: colors.textPrimary }]}>{clinicName}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      <Text style={[styles.cta, { color: colors.accentGold }]}>{ctaLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  tag: {
    borderRadius: radii.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing.xs + 3,
  },
  tagText: {
    fontFamily: fontFamilies.bold,
    fontSize: 8.5,
    textTransform: "uppercase",
  },
  timestamp: {
    ...typographyPresets.meta,
  },
  clinic: {
    ...typographyPresets.h2,
    marginBottom: 2,
  },
  subtitle: {
    ...typographyPresets.bodySmall,
    marginBottom: spacing.sm,
  },
  cta: {
    fontFamily: fontFamilies.bold,
    fontSize: 10.5,
  },
});
