import { Platform, StyleSheet, View, type StyleProp, type ViewStyle, type ViewProps } from "react-native";
import { elevation, radii, spacing, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

export type CardVariant = "flat" | "elevated" | "glass";

interface CardProps extends ViewProps {
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

// "glass" gives the translucent surface + border from the glassmorphism token; it does not
// apply a real backdrop blur — that needs a native blur dependency (e.g. @react-native-community/blur),
// which isn't added yet. Screens that need the full blurred effect should layer that in when built (Faz 5, #62-#66).
export function Card({ variant = "flat", style, children, ...rest }: CardProps) {
  const { colors } = useTheme();
  const variantStyle = getVariantStyle(variant, colors);

  return (
    <View style={[styles.base, variantStyle, style]} {...rest}>
      {children}
    </View>
  );
}

function getVariantStyle(variant: CardVariant, colors: ThemeColors): ViewStyle {
  switch (variant) {
    case "elevated":
      return {
        backgroundColor: colors.surfaceElevated,
        ...Platform.select<ViewStyle>({
          ios: elevation.medium.ios,
          android: elevation.medium.android,
        }),
      };
    case "glass":
      return {
        backgroundColor: colors.surfaceGlass,
        borderWidth: 1,
        borderColor: colors.borderStrong,
      };
    case "flat":
    default:
      return {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
});
