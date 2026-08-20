import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Briefcase } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { getMyJobs, updateJobStatus, extendJob, type JobItem } from "../../../services/jobApi";
import { CreateJobModal } from "./CreateJobModal";
import { ApplicantsModal } from "./ApplicantsModal";
import { CandidateSwipeModal } from "../../matching/components/CandidateSwipeModal";
import { useTheme } from "../../../store/useThemeStore";
import { Card } from "../../../components/Card";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";

const EXPIRY_WARNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function daysUntil(dateIso: string): number {
  return Math.max(0, Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function MyPostingsTab() {
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [applicantsTarget, setApplicantsTarget] = useState<JobItem | null>(null);
  const [candidatesTarget, setCandidatesTarget] = useState<JobItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const items = await getMyJobs();
      setJobs(items);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "İlanların yüklenemedi"));
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

  async function handleToggleStatus(job: JobItem) {
    setTogglingId(job.id);
    try {
      const nextStatus = job.status === "open" ? "closed" : "open";
      const updated = await updateJobStatus(job.id, nextStatus);
      setJobs((current) => current.map((item) => (item.id === job.id ? updated : item)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Güncellenemedi"));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleExtend(job: JobItem) {
    setTogglingId(job.id);
    try {
      const updated = await extendJob(job.id);
      setJobs((current) => current.map((item) => (item.id === job.id ? updated : item)));
    } catch (err) {
      setError(getApiErrorMessage(err, "İlan uzatılamadı"));
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.skeletonList}>
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  return (
    <>
      <Button label="+ Yeni İlan" onPress={() => setCreateVisible(true)} style={styles.createButton} />

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentGold} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : (
              <EmptyState icon={Briefcase} title="Henüz ilan yayınlamadın" description="Yukarıdaki butonla ilk ilanını oluştur." />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setApplicantsTarget(item)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                <Badge label={item.status === "open" ? "Açık" : "Kapalı"} variant={item.status === "open" ? "success" : "neutral"} />
              </View>
              {item.location ? (
                <Text style={[styles.location, { color: colors.textSecondary }]}>{item.location}</Text>
              ) : null}
              {item.status === "open" && item.expiresAt && new Date(item.expiresAt).getTime() - Date.now() <= EXPIRY_WARNING_WINDOW_MS ? (
                <Text style={[styles.expiryWarning, { color: colors.warning }]}>
                  {daysUntil(item.expiresAt)} gün içinde otomatik kapanacak
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, { borderColor: colors.accentGold }]}
                  onPress={() => handleToggleStatus(item)}
                  disabled={togglingId === item.id}
                >
                  <Text style={[styles.toggleButtonText, { color: colors.accentGold }]}>
                    {item.status === "open" ? "Kapat" : "Yeniden Aç"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, { borderColor: colors.accentGold }]}
                  onPress={() => setCandidatesTarget(item)}
                >
                  <Text style={[styles.toggleButtonText, { color: colors.accentGold }]}>Aday Bul</Text>
                </TouchableOpacity>
                {item.status === "open" ? (
                  <TouchableOpacity
                    style={[styles.toggleButton, { borderColor: colors.accentGold }]}
                    onPress={() => handleExtend(item)}
                    disabled={togglingId === item.id}
                  >
                    <Text style={[styles.toggleButtonText, { color: colors.accentGold }]}>Uzat</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      <CreateJobModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={(job) => setJobs((current) => [job, ...current])}
      />
      <ApplicantsModal visible={applicantsTarget !== null} job={applicantsTarget} onClose={() => setApplicantsTarget(null)} />
      <CandidateSwipeModal
        visible={candidatesTarget !== null}
        job={candidatesTarget}
        onClose={() => setCandidatesTarget(null)}
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
  createButton: {
    margin: spacing.md,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  location: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  expiryWarning: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  toggleButton: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  toggleButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
