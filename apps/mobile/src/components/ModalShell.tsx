import type { ReactNode } from "react";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "@react-native-community/blur";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { radii, spacing, spring } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";

export type ModalShellVariant = "sheet" | "center";

interface ModalShellProps {
  visible: boolean;
  onClose: () => void;
  variant?: ModalShellVariant;
  children: ReactNode;
  // Applied to the inner sheet/center surface — mainly for a max/fixed height on
  // taller sheets (thread lists, forms). Most callers don't need this.
  contentStyle?: StyleProp<ViewStyle>;
}

const SHEET_ENTRY_OFFSET = 420;

// Wraps RN's core `Modal` with the shared visual shell (blurred backdrop, spring-in
// sheet/center surface, handle bar). Faz 5 ADR (#59): screens keep driving visibility
// with local `useState` (not a React Navigation modal route) — lower risk for a
// many-screen rollout, no deep-linking/back-gesture needs identified for these flows.
// Open animation only (spec §6.2) — close is instant on `visible={false}`, matching
// the existing per-screen close callbacks (no exit-animation state machine added).
export function ModalShell({ visible, onClose, variant = "sheet", children, contentStyle }: ModalShellProps) {
  const { colors, scheme } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withSpring(1, spring);
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SHEET_ENTRY_OFFSET }],
  }));
  const centerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={scheme === "dark" ? "dark" : "light"}
          blurAmount={8}
          overlayColor={colors.overlay}
          reducedTransparencyFallbackColor={colors.overlay}
        />
        <Pressable style={styles.backdropTouch} onPress={onClose}>
          <Animated.View
            style={[
              variant === "sheet" ? styles.sheetWrap : styles.centerWrap,
              variant === "sheet" ? sheetStyle : centerStyle,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  variant === "sheet" ? styles.sheet : styles.center,
                  { backgroundColor: colors.surfaceElevated },
                  contentStyle,
                ]}
              >
                {variant === "sheet" ? (
                  <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
                ) : null}
                {children}
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  backdropTouch: {
    flex: 1,
  },
  sheetWrap: {
    width: "100%",
    marginTop: "auto",
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
    alignSelf: "center",
    marginBottom: spacing.md + 2,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  center: {
    width: "100%",
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
});
