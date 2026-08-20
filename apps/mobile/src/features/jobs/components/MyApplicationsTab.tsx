import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FileText } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { getMyApplications, type MyApplicationItem } from "../../../services/jobApi";
import {
  getMyPendingVerifications,
  answerVerification,
  type PostHireVerificationItem,
} from "../../../services/postHireVerificationApi";
import { statusLabel, statusBadgeVariant } from "../statusStyles";
import { InboxModal } from "../../inbox/components/InboxModal";
import { useTheme } from "../../../store/useThemeStore";
import { Card } from "../../../components/Card";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";

export function MyApplicationsTab() {
  const { colors } = useTheme();
  const [applications, setApplications] = useState<MyApplicationItem[]>([]);
  const [verifications, setVerifications] = useState<PostHireVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ employerId: string; jobId: string } | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [items, pending] = await Promise.all([getMyApplications(), getMyPendingVerifications()]);
      setApplications(items);
      setVerifications(pending);
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

  async function handleAnswer(id: string, answer: boolean) {
    setAnsweringId(id);
    try {
      await answerVerification(id, answer);
      setVerifications((current) => current.filter((item) => item.id !== id));
    } catch {
      // sessizce yut — kullanıcı listeyi yenileyerek tekrar deneyebilir
    } finally {
      setAnsweringId(null);
    }
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
        ListHeaderComponent={
          verifications.length > 0 ? (
            <View>
              {verifications.map((verification) => (
                <Card key={verification.id} style={styles.verificationCard}>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    "{verification.jobTitle}" ilanında belirtilen şartlar gerçekleşti mi?
                  </Text>
                  <View style={styles.verificationButtonRow}>
                    <Button
                      label="Evet"
                      onPress={() => handleAnswer(verification.id, true)}
                      loading={answeringId === verification.id}
                      style={styles.verificationButton}
                    />
                    <Button
                      label="Hayır"
                      variant="secondary"
                      onPress={() => handleAnswer(verification.id, false)}
                      loading={answeringId === verification.id}
                      style={styles.verificationButton}
                    />
                  </View>
                </Card>
              ))}
            </View>
          ) : null
        }
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
  verificationCard: {
    margin: spacing.md,
    marginBottom: 0,
    gap: spacing.sm,
  },
  verificationButtonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  verificationButton: {
    flex: 1,
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
