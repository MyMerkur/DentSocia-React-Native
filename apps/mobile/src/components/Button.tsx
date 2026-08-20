import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { duration, fontFamilies, radii, spacing, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

export type ButtonVariant = "primary" | "gold" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZE_STYLES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; radius: number }> = {
  sm: { paddingVertical: 9, paddingHorizontal: spacing.md, fontSize: 13, radius: radii.sm },
  md: { paddingVertical: 13, paddingHorizontal: spacing.lg, fontSize: 14, radius: radii.md },
  lg: { paddingVertical: 16, paddingHorizontal: spacing.xl, fontSize: 15, radius: radii.md + 2 },
};

interface VariantColors {
  background: string;
  backgroundPressed: string;
  backgroundDisabled: string;
  text: string;
  border?: string;
}

function getVariantColors(variant: ButtonVariant, colors: ThemeColors): VariantColors {
  switch (variant) {
    case "primary":
      return {
        background: colors.accentBlue,
        backgroundPressed: colors.accentBluePressed,
        backgroundDisabled: colors.accentBlueDisabled,
        text: "#FFFFFF",
      };
    case "gold":
      return {
        background: colors.accentGold,
        backgroundPressed: colors.accentGoldPressed,
        backgroundDisabled: colors.accentGoldDisabled,
        text: colors.textOnAccent,
      };
    case "secondary":
      return {
        background: "transparent",
        backgroundPressed: colors.surfaceElevated,
        backgroundDisabled: "transparent",
        text: colors.textPrimary,
        border: colors.borderSubtle,
      };
    case "ghost":
      return {
        background: "transparent",
        backgroundPressed: "rgba(61, 139, 255, 0.08)",
        backgroundDisabled: "transparent",
        text: colors.accentBlue,
      };
    case "danger":
      return {
        background: "transparent",
        backgroundPressed: "rgba(255, 92, 92, 0.08)",
        backgroundDisabled: "transparent",
        text: colors.danger,
        border: "rgba(255, 92, 92, 0.35)",
      };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const sizeStyle = SIZE_STYLES[size];
  const variantColors = getVariantColors(variant, colors);
  const isDisabled = disabled || loading;
  const pressedValue = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressedValue.value * 0.04 }],
    backgroundColor: isDisabled
      ? variantColors.backgroundDisabled
      : pressedValue.value
        ? variantColors.backgroundPressed
        : variantColors.background,
  }));
  const borderStyle: ViewStyle = {
    borderWidth: variantColors.border ? 1.5 : 0,
    borderColor: variantColors.border,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        pressedValue.value = withTiming(1, { duration: duration.fast });
      }}
      onPressOut={() => {
        pressedValue.value = withTiming(0, { duration: duration.fast });
      }}
    >
      <Animated.View
        style={[
          styles.base,
          {
            paddingVertical: sizeStyle.paddingVertical,
            paddingHorizontal: sizeStyle.paddingHorizontal,
            borderRadius: sizeStyle.radius,
          },
          borderStyle,
          animatedStyle,
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variantColors.text} />
        ) : (
          <Text
            style={[
              styles.label,
              { fontSize: sizeStyle.fontSize, color: variantColors.text },
              isDisabled && styles.labelDisabled,
            ]}
          >
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  label: {
    fontFamily: fontFamilies.extrabold,
  },
  labelDisabled: {
    opacity: 0.5,
  },
});
