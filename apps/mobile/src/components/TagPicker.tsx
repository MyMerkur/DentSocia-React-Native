import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MICRO_COMPETENCY_TAGS, type MicroCompetencyTag } from "@dentsocia/shared-constants";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

const MAX_TAGS = 8;

interface TagPickerProps {
  selected: MicroCompetencyTag[];
  onChange: (tags: MicroCompetencyTag[]) => void;
}

export function TagPicker({ selected, onChange }: TagPickerProps) {
  const { colors } = useTheme();

  function toggleTag(tag: MicroCompetencyTag) {
    if (selected.includes(tag)) {
      onChange(selected.filter((item) => item !== tag));
      return;
    }
    if (selected.length >= MAX_TAGS) {
      return;
    }
    onChange([...selected, tag]);
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {MICRO_COMPETENCY_TAGS.map((tag) => {
          const isSelected = selected.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.chip,
                { borderColor: colors.border, backgroundColor: colors.surface },
                isSelected && { borderColor: colors.accentGold, backgroundColor: colors.surfaceElevated },
              ]}
              onPress={() => toggleTag(tag)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: colors.textSecondary },
                  isSelected && { color: colors.accentGold, fontWeight: typography.weights.semibold },
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {selected.length}/{MAX_TAGS} etiket seçildi
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  hint: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
});
