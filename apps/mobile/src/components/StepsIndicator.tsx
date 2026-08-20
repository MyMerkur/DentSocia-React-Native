import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, spacing } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

interface StepsIndicatorProps {
  steps: string[];
  activeIndex: number;
}

// KYC-style numbered step progress (spec §7.13) — active step in gold, thin
// connector line stretches to fill the space between each label.
export function StepsIndicator({ steps, activeIndex }: StepsIndicatorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {steps.map((label, index) => (
        <Fragment key={label}>
          <Text style={[styles.label, { color: index <= activeIndex ? colors.accentGold : colors.textTertiary }]}>
            {label}
          </Text>
          {index < steps.length - 1 ? <View style={[styles.line, { backgroundColor: colors.borderStrong }]} /> : null}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    flexShrink: 0,
  },
  line: {
    flex: 1,
    height: 2,
    borderRadius: 2,
  },
});
