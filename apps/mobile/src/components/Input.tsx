import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { fontFamilies, radii, spacing } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, editable = true, onFocus, onBlur, style, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <TextInput
        {...rest}
        editable={editable}
        placeholderTextColor={colors.textTertiary}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.box,
          { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary },
          focused && { borderColor: colors.accentBlue },
          hasError && { borderColor: colors.danger },
          !editable && { color: colors.textTertiary, backgroundColor: colors.surfaceElevated },
          style,
        ]}
      />
      {error ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs + 2,
  },
  label: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12.5,
  },
  box: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
  },
});
