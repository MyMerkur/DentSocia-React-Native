import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { fontFamilies } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";
import { HeartIcon } from "./icons";

interface HeartButtonProps {
  liked: boolean;
  count: number;
  onToggle: () => void;
  size?: number;
}

// Spring pop (spec §6.2): scale 1 → 1.35 → 1 on tap, snappier than the shared spring
// token (damping 6/stiffness 300) so the "like" feels immediate rather than floaty.
export function HeartButton({ liked, count, onToggle, size = 16 }: HeartButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  function handlePress() {
    scale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 6, stiffness: 300 }),
    );
    onToggle();
  }

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = liked ? colors.danger : colors.textTertiary;

  return (
    <Pressable style={styles.row} onPress={handlePress} hitSlop={8}>
      <Animated.View style={iconStyle}>
        <HeartIcon size={size} color={color} filled={liked} strokeWidth={1.75} />
      </Animated.View>
      <Text style={[styles.count, { color: colors.textTertiary }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  count: {
    fontFamily: fontFamilies.medium,
    fontSize: 10.5,
  },
});
