import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FileText } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { getMyApplications, type MyApplicationItem } from "../../../services/jobApi";
import { statusLabel, statusBadgeVariant } from "../statusStyles";
import { InboxModal } from "../../inbox/components/InboxModal";
import { useTheme } from "../../../store/useThemeStore";
import { Card } from "../../../components/Card";
import { Badge } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";

export function MyApplicationsTab() {
  const { colors } = useTheme();
  const [applications, setApplications] = useState<MyApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ employerId: string; jobId: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await getMyApplications();
      setApplications(items);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Başvurular yüklenemedi"));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.skeletonList}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentGold} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : (
              <EmptyState icon={FileText} title="Henüz başvurun yok" description="Beğendiğin bir ilana başvurduğunda burada göreceksin." />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.job.title}</Text>
            {item.message ? (
              <Text style={[styles.message, { color: colors.textSecondary }]}>{item.message}</Text>
            ) : null}
            <Badge label={statusLabel(item.status)} variant={statusBadgeVariant(item.status)} />
            <TouchableOpacity
              onPress={() => setMessageTarget({ employerId: item.job.employerId, jobId: item.job.id })}
            >
              <Text style={[styles.messageLink, { color: colors.accentGold }]}>İşverene Mesaj Gönder</Text>
            </TouchableOpacity>
          </Card>
        )}
      />

      <InboxModal
        visible={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        startTarget={
          messageTarget
            ? { userId: messageTarget.employerId, context: { type: "job", id: messageTarget.jobId } }
            : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  skeletonList: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.md,
  },
  card: {
    margin: spacing.md,
    marginBottom: 0,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  message: {
    fontSize: typography.sizes.sm,
  },
  messageLink: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});
