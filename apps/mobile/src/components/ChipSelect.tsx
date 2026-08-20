import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

interface ChipRowProps<T extends string> {
  options: readonly T[];
  label?: string;
}

function useChipColors() {
  const { colors } = useTheme();
  return colors;
}

function Chip({ label, isSelected, onPress }: { label: string; isSelected: boolean; onPress: () => void }) {
  const colors = useChipColors();
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { borderColor: colors.border, backgroundColor: colors.surface },
        isSelected && { borderColor: colors.accentGold, backgroundColor: colors.surfaceElevated },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          { color: colors.textSecondary },
          isSelected && { color: colors.accentGold, fontWeight: typography.weights.semibold },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface ChipSingleSelectProps<T extends string> extends ChipRowProps<T> {
  selected: T | null;
  onChange: (value: T) => void;
}

// Tek seçim (Pozisyon/Branş/Çalışma tipi/Ödeme modeli/Tecrübe vb.) — TagPicker.tsx'in chip
// render deseninin generic hâli (TagPicker MICRO_COMPETENCY_TAGS'e sabit kodlu, bu değil).
export function ChipSingleSelect<T extends string>({ options, selected, onChange, label }: ChipSingleSelectProps<T>) {
  const colors = useChipColors();
  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((option) => (
          <Chip key={option} label={option} isSelected={selected === option} onPress={() => onChange(option)} />
        ))}
      </ScrollView>
    </View>
  );
}

interface ChipMultiSelectProps<T extends string> extends ChipRowProps<T> {
  selected: T[];
  onChange: (value: T[]) => void;
  max?: number;
}

export function ChipMultiSelect<T extends string>({ options, selected, onChange, label, max }: ChipMultiSelectProps<T>) {
  const colors = useChipColors();

  function toggle(option: T) {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
      return;
    }
    if (max !== undefined && selected.length >= max) {
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((option) => (
          <Chip key={option} label={option} isSelected={selected.includes(option)} onPress={() => toggle(option)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontSize: typography.sizes.sm,
  },
});
