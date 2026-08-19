import { useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { fontFamilies, radii, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";
import { LockIcon } from "./icons";

interface LockedCardProps {
  previewText: string;
  ctaLabel?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Paywall card (spec §7.4) — a one-shot gold glint sweeps across the locked band on
// mount to draw the eye, then stops. Deliberately `withTiming` + `withDelay`, no
// `withRepeat` (spec §6.2: this animation fires once, not a loop).
export function LockedCard({ previewText, ctaLabel = "Devamı için abone ol", onPress, style }: LockedCardProps) {
  const { colors } = useTheme();
  const glint = useSharedValue(-1);

  useEffect(() => {
    glint.value = withDelay(300, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [glint]);

  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value < 1 ? 1 : 0,
    transform: [{ translateX: `${glint.value * 220}%` }],
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={3}>
        {previewText}
      </Text>
      <View style={[styles.lockedBottom, { borderTopColor: colors.border }]}>
        <View style={styles.glintClip} pointerEvents="none">
          <Animated.View style={[styles.glintBand, glintStyle]} />
        </View>
        <LockIcon size={13} color={colors.accentGold} strokeWidth={1.75} />
        <Text
          style={[styles.ctaLabel, { color: colors.accentGold }]}
          onPress={onPress}
          suppressHighlighting={!onPress}
        >
          {ctaLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  preview: {
    ...typographyPresets.body,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  lockedBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  glintClip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  glintBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "40%",
    backgroundColor: "rgba(216, 184, 114, 0.22)",
  },
  ctaLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 12.5,
  },
});
