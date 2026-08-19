import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";

interface SwipeCardProps {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const SWIPE_THRESHOLD = 120;
const EXIT_DISTANCE = 500;

export function SwipeCard({ children, onSwipeLeft, onSwipeRight }: SwipeCardProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  function forceSwipe(direction: "left" | "right") {
    "worklet";
    translateX.value = withTiming(
      direction === "right" ? EXIT_DISTANCE : -EXIT_DISTANCE,
      { duration: 200 },
      () => {
        translateX.value = 0;
        translateY.value = 0;
        runOnJS(direction === "right" ? onSwipeRight : onSwipeLeft)();
      },
    );
  }

  function resetPosition() {
    "worklet";
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      if (translateX.value > SWIPE_THRESHOLD) {
        forceSwipe("right");
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        forceSwipe("left");
      } else {
        resetPosition();
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-12, 0, 12])}deg` },
    ],
  }));

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, cardStyle]}
        >
          {children}
        </Animated.View>
      </GestureDetector>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.rejectButton, { borderColor: colors.danger }]} onPress={() => forceSwipe("left")}>
          <Text style={[styles.rejectButtonText, { color: colors.danger }]}>Geç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.accentGold }]}
          onPress={() => forceSwipe("right")}
        >
          <Text style={[styles.acceptButtonText, { color: colors.background }]}>İlgileniyorum</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: spacing.lg,
  },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  rejectButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  rejectButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  acceptButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
  },
  acceptButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
});
