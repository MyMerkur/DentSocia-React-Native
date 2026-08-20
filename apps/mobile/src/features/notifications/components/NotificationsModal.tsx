import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Bell } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";
import { getNotifications, markNotificationRead, type NotificationItem } from "../../../services/notificationApi";

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "80%" };

export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const { colors } = useTheme();
  const titleStyle = { color: colors.textPrimary };
  const closeTextStyle = { color: colors.accentGold };
  const errorStyle = { color: colors.danger };
  const rowStyle = { borderTopColor: colors.border };
  const unreadDotStyle = { backgroundColor: colors.accentGold };
  const notificationTitleStyle = { color: colors.textPrimary };
  const notificationBodyStyle = { color: colors.textSecondary };
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoading(true);
    setError(null);
    getNotifications()
      .then(setNotifications)
      .catch((err) => setError(getApiErrorMessage(err, "Bildirimler yüklenemedi")))
      .finally(() => setLoading(false));
  }, [visible]);

  async function handlePress(notification: NotificationItem) {
    if (notification.read) {
      return;
    }
    setNotifications((current) => current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
    try {
      await markNotificationRead(notification.id);
    } catch {
      // sessizce yut, bir sonraki açılışta liste yeniden yüklenir
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, titleStyle]}>Bildirimler</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, closeTextStyle]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.skeletonList}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <ScrollView>
              {error ? <Text style={[styles.error, errorStyle]}>{error}</Text> : null}
              {notifications.length === 0 ? <EmptyState icon={Bell} title="Henüz bildirimin yok" /> : null}
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[styles.row, rowStyle]}
                  onPress={() => handlePress(notification)}
                  disabled={notification.read}
                >
                  <View style={styles.rowContent}>
                    <View style={styles.rowHeader}>
                      {!notification.read ? <View style={[styles.unreadDot, unreadDotStyle]} /> : null}
                      <Text style={[styles.notificationTitle, notificationTitleStyle]}>{notification.title}</Text>
                    </View>
                    {notification.body ? (
                      <Text style={[styles.notificationBody, notificationBodyStyle]}>{notification.body}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  closeText: {
    fontSize: typography.sizes.sm,
  },
  skeletonList: {
    gap: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  row: {
    borderTopWidth: 1,
    paddingVertical: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
  },
  notificationTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    flexShrink: 1,
  },
  notificationBody: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
});
