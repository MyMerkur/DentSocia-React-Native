import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Briefcase } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { applyToJob, getJobs, type JobItem } from "../../../services/jobApi";
import { ApplyModal } from "./ApplyModal";
import { OrgProfileModal } from "../../orgs/components/OrgProfileModal";
import { useTheme } from "../../../store/useThemeStore";
import { Card } from "../../../components/Card";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";

export function JobListTab() {
  const { colors } = useTheme();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<JobItem | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [orgTarget, setOrgTarget] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getJobs();
      setJobs(page.jobs);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, "İlanlar yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const page = await getJobs();
      setJobs(page.jobs);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, "İlanlar yüklenemedi"));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await getJobs(nextCursor);
      setJobs((current) => [...current, ...page.jobs]);
      setNextCursor(page.nextCursor);
    } catch {
      // sessizce yut, kullanıcı aşağı çekip tekrar deneyebilir
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleApply(message?: string) {
    if (!applyTarget) {
      return;
    }
    await applyToJob(applyTarget.id, message);
    setAppliedIds((current) => new Set(current).add(applyTarget.id));
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
        data={jobs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentGold} />}
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        ListEmptyComponent={
          <View style={styles.centered}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : (
              <EmptyState icon={Briefcase} title="Şu anda açık ilan yok" description="Yeni ilanlar yayınlandığında burada göreceksin." />
            )}
          </View>
        }
        ListFooterComponent={loadingMore ? <SkeletonRow /> : null}
        renderItem={({ item }) => {
          const alreadyApplied = appliedIds.has(item.id);
          return (
            <Card style={styles.card}>
              <TouchableOpacity onPress={() => setOrgTarget(item.employer.id)}>
                <Text style={[styles.employerName, { color: colors.textSecondary }]}>{item.employer.displayName}</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
              {item.location ? (
                <Text style={[styles.location, { color: colors.textSecondary }]}>{item.location}</Text>
              ) : null}
              {item.description ? (
                <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              {item.specialties.length > 0 ? (
                <View style={styles.tagRow}>
                  {item.specialties.map((tag) => (
                    <Badge key={tag} label={tag} variant="neutral" />
                  ))}
                </View>
              ) : null}
              <Button
                label={alreadyApplied ? "Başvuruldu" : "Başvur"}
                onPress={() => setApplyTarget(item)}
                disabled={alreadyApplied}
                fullWidth
                style={styles.applyButton}
              />
            </Card>
          );
        }}
      />
      <ApplyModal
        visible={applyTarget !== null}
        jobTitle={applyTarget?.title ?? ""}
        onClose={() => setApplyTarget(null)}
        onSubmit={handleApply}
      />
      <OrgProfileModal visible={orgTarget !== null} orgUserId={orgTarget} onClose={() => setOrgTarget(null)} />
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
    ...typographyPresets.body,
  },
  card: {
    margin: spacing.md,
    marginBottom: 0,
  },
  employerName: {
    ...typographyPresets.bodySmall,
    marginBottom: spacing.xs,
  },
  title: {
    ...typographyPresets.h2,
  },
  location: {
    ...typographyPresets.bodySmall,
    marginTop: 2,
  },
  description: {
    ...typographyPresets.body,
    marginTop: spacing.xs,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  applyButton: {
    marginTop: spacing.md,
  },
});
