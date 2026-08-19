import { StyleSheet, View } from "react-native";
import { spacing } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { InboxView } from "../components/InboxView";

// Persistent "Mesajlar" tab — the general inbox, no close button (nothing to close back to).
// Contextual "message this person" flows keep using InboxModal.
export function InboxScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InboxView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
});
