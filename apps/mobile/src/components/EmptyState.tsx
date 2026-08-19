import type { ComponentType } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radii, spacing } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";
import { Button } from "./Button";

// lucide-react-native doesn't export its `LucideProps` type publicly, so this
// mirrors the subset of it every icon actually needs here.
interface IconComponentProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

interface EmptyStateProps {
  icon: ComponentType<IconComponentProps>;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCtaPress }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
        <Icon size={26} color={colors.textTertiary} strokeWidth={1.6} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <Button label={ctaLabel} onPress={onCtaPress} size="sm" style={styles.cta} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.xxl + 8,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md + 2,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  description: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: spacing.md + 2,
  },
  cta: {
    marginTop: spacing.xs,
  },
});
