import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { Skeleton } from "../../../components/Skeleton";
import { getCandidateSwipeFeed, swipeCandidate, type SwipeCandidateCard } from "../../../services/matchingApi";
import type { JobItem } from "../../../services/jobApi";
import type { ThreadContextType } from "../../../services/inboxApi";
import { SwipeCard } from "./SwipeCard";
import { InboxModal } from "../../inbox/components/InboxModal";
import { useTheme } from "../../../store/useThemeStore";

interface CandidateSwipeModalProps {
  visible: boolean;
  job: JobItem | null;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { height: "80%" };

export function CandidateSwipeModal({ visible, job, onClose }: CandidateSwipeModalProps) {
  const { colors } = useTheme();
  const [deck, setDeck] = useState<SwipeCandidateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<{ userId: string; context: { type: ThreadContextType; id: string } } | null>(
    null,
  );

  const load = useCallback(() => {
    if (!job) {
      return;
    }
    setLoading(true);
    setError(null);
    getCandidateSwipeFeed(job.id)
      .then(setDeck)
      .catch((err) => setError(getApiErrorMessage(err, "Adaylar yüklenemedi")))
      .finally(() => setLoading(false));
  }, [job]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    load();
  }, [visible, load]);

  async function handleSwipe(candidate: SwipeCandidateCard, direction: "left" | "right") {
    if (!job) {
      return;
    }
    setDeck((current) => current.filter((item) => item.id !== candidate.id));
    try {
      const result = await swipeCandidate(job.id, candidate.id, direction);
      if (result.matched) {
        Alert.alert("🎉 Eşleşme!", `${candidate.displayName} ile "${job.title}" ilanı üzerinden eşleştiniz.`, [
          { text: "Kapat", style: "cancel" },
          {
            text: "Sohbeti Aç",
            onPress: () => setChatTarget({ userId: candidate.id, context: { type: "job", id: job.id } }),
          },
        ]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Swipe işlemi başarısız oldu"));
    }
  }

  const current = deck[0];

  return (
    <>
      <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {job?.title ?? ""} — Adaylar
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          {loading ? (
            <Skeleton height={360} radius={20} />
          ) : current ? (
            <View style={styles.deckArea}>
              <SwipeCard
                key={current.id}
                onSwipeLeft={() => handleSwipe(current, "left")}
                onSwipeRight={() => handleSwipe(current, "right")}
              >
                <View style={styles.avatarWrapper}>
                  <Avatar name={current.displayName} imageUrl={current.avatarUrl} size="lg" />
                </View>
                <Text style={[styles.candidateName, { color: colors.textPrimary }]}>{current.displayName}</Text>
                {current.experienceYears != null ? (
                  <Text style={[styles.experience, { color: colors.textSecondary }]}>
                    {current.experienceYears} yıl deneyim
                  </Text>
                ) : null}
                {current.desiredPositions.length > 0 ? (
                  <View style={styles.tagRow}>
                    {current.desiredPositions.map((tag) => (
                      <Badge key={tag} label={tag} variant="neutral" />
                    ))}
                  </View>
                ) : null}
              </SwipeCard>
            </View>
          ) : (
            <View style={styles.centered}>
              <EmptyState
                icon={RefreshCw}
                title="Şu an gösterilecek yeni aday yok"
                ctaLabel="Yenile"
                onCtaPress={load}
              />
            </View>
          )}
      </ModalShell>

      <InboxModal visible={chatTarget !== null} onClose={() => setChatTarget(null)} startTarget={chatTarget} />
    </>
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
    flexShrink: 1,
  },
  closeText: {
    fontSize: typography.sizes.sm,
  },
  error: {
    marginBottom: spacing.sm,
  },
  deckArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrapper: {
    alignSelf: "center",
  },
  candidateName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    textAlign: "center",
    marginTop: spacing.md,
  },
  experience: {
    fontSize: typography.sizes.sm,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
    justifyContent: "center",
  },
});
