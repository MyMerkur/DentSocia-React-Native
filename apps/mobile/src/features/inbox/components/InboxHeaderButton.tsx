import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { iconSizes, iconStrokeWidth, radii } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { getUnreadThreadCount } from "../../../services/inboxApi";
import { InboxModal } from "./InboxModal";

// Ana Sayfa header-right, next to NotificationsHeaderButton — replaces the old
// persistent "Mesajlar" tab so the tab bar drops to 5 items and the raised
// "Paylaş" button can sit dead-center (Faz 5 follow-up).
export function InboxHeaderButton() {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadThreadCount()
      .then(setUnreadCount)
      .catch(() => undefined);
  }, [visible]);

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setVisible(true)} accessibilityLabel="Mesajlar">
        <MessageCircle size={iconSizes.md} color={colors.textPrimary} strokeWidth={iconStrokeWidth} />
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <InboxModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: 4,
    padding: 6,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
});
