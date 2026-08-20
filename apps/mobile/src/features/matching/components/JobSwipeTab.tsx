import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { getJobSwipeFeed, swipeJob, type SwipeJobCard } from "../../../services/matchingApi";
import type { ThreadContextType } from "../../../services/inboxApi";
import { SwipeCard } from "./SwipeCard";
import { InboxModal } from "../../inbox/components/InboxModal";
import { useTheme } from "../../../store/useThemeStore";
import { Badge } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { Skeleton } from "../../../components/Skeleton";

export function JobSwipeTab() {
  const { colors } = useTheme();
  const [deck, setDeck] = useState<SwipeJobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<{ userId: string; context: { type: ThreadContextType; id: string } } | null>(
    null,
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getJobSwipeFeed()
      .then(setDeck)
      .catch((err) => setError(getApiErrorMessage(err, "İlanlar yüklenemedi")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSwipe(job: SwipeJobCard, direction: "left" | "right") {
    setDeck((current) => current.filter((item) => item.id !== job.id));
    try {
      const result = await swipeJob(job.id, direction);
      if (result.matched) {
        Alert.alert("🎉 Eşleşme!", `${job.employer.displayName} ile "${job.title}" ilanı üzerinden eşleştiniz.`, [
          { text: "Kapat", style: "cancel" },
          {
            text: "Sohbeti Aç",
            onPress: () => setChatTarget({ userId: job.employer.id, context: { type: "job", id: job.id } }),
          },
        ]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Swipe işlemi başarısız oldu"));
    }
  }

  if (loading) {
    return (
      <View style={styles.skeletonWrapper}>
        <Skeleton height={420} radius={20} />
      </View>
    );
  }

  const current = deck[0];

  if (!current) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={RefreshCw}
          title="Şu an gösterilecek yeni ilan yok"
          description={error ?? undefined}
          ctaLabel="Yenile"
          onCtaPress={load}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SwipeCard
        key={current.id}
        onSwipeLeft={() => handleSwipe(current, "left")}
        onSwipeRight={() => handleSwipe(current, "right")}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
        <Text style={[styles.employer, { color: colors.accentGold }]}>{current.employer.displayName}</Text>
        {current.location ? (
          <Text style={[styles.location, { color: colors.textSecondary }]}>{current.location}</Text>
        ) : null}
        {current.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={6}>
            {current.description}
          </Text>
        ) : null}
        {current.specialties.length > 0 ? (
          <View style={styles.tagRow}>
            {current.specialties.map((tag) => (
              <Badge key={tag} label={tag} variant="neutral" />
            ))}
          </View>
        ) : null}
      </SwipeCard>

      <InboxModal visible={chatTarget !== null} onClose={() => setChatTarget(null)} startTarget={chatTarget} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonWrapper: {
    flex: 1,
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  employer: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  location: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  description: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.md,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
