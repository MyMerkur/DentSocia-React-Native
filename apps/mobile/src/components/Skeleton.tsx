import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { radii, withAlpha } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}

// Shimmer band sweeping left-to-right, not an opacity pulse — spec §6.2 (1.3s,
// linear, infinite). The band is a translating lighter-tone panel rather than a
// true CSS gradient (no gradient dependency in this package), which reads the same
// at the widths these skeletons actually render at.
export function Skeleton({ width = "100%", height = 14, radius = radii.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const translate = useSharedValue(-1);

  useEffect(() => {
    translate.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
  }, [translate]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${translate.value * 150}%` }],
  }));

  return (
    <View style={[styles.base, { width, height, borderRadius: radius, backgroundColor: colors.surfaceElevated }, style]}>
      <Animated.View style={[styles.band, { backgroundColor: withAlpha(colors.textPrimary, 0.06) }, bandStyle]} />
    </View>
  );
}

interface SkeletonRowProps {
  avatarSize?: number;
}

export function SkeletonRow({ avatarSize = 44 }: SkeletonRowProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <Skeleton width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
      <View style={styles.lines}>
        <Skeleton width="70%" height={11} />
        <Skeleton width="45%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  band: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "60%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: radii.md + 2,
    padding: 16,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
});
