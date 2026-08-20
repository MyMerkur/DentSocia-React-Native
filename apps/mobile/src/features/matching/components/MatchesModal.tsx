import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Target } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Avatar } from "../../../components/Avatar";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";
import { getMatches, type MatchItem } from "../../../services/matchingApi";
import type { ThreadContextType } from "../../../services/inboxApi";
import { InboxModal } from "../../inbox/components/InboxModal";
import { UserProfileModal } from "../../profiles/components/UserProfileModal";
import { OrgProfileModal } from "../../orgs/components/OrgProfileModal";
import { useTheme } from "../../../store/useThemeStore";

interface MatchesModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "80%" };

export function MatchesModal({ visible, onClose }: MatchesModalProps) {
  const { colors } = useTheme();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<{ userId: string; context: { type: ThreadContextType; id: string } } | null>(
    null,
  );
  const [profileTarget, setProfileTarget] = useState<{ id: string; role: "candidate" | "employer" } | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setLoading(true);
    setError(null);
    getMatches()
      .then(setMatches)
      .catch((err) => setError(getApiErrorMessage(err, "Eşleşmeler yüklenemedi")))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <>
      <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Eşleşmelerim</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.skeletonList}>
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <ScrollView>
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              {matches.length === 0 ? <EmptyState icon={Target} title="Henüz bir eşleşmen yok" /> : null}
              {matches.map((match) => (
                <View key={match.id} style={[styles.row, { borderTopColor: colors.border }]}>
                  <Avatar name={match.counterpart.displayName} imageUrl={match.counterpart.avatarUrl} size="md" />
                  <View style={styles.rowContent}>
                    <TouchableOpacity
                      onPress={() => setProfileTarget({ id: match.counterpart.id, role: match.counterpartRole })}
                    >
                      <Text style={[styles.name, { color: colors.textPrimary }]}>
                        {match.counterpart.displayName}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.jobTitle, { color: colors.textSecondary }]}>{match.job.title}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setChatTarget({ userId: match.counterpart.id, context: { type: "job", id: match.job.id } })
                    }
                  >
                    <Text style={[styles.chatLink, { color: colors.accentGold }]}>Sohbeti Aç</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
      </ModalShell>

      <InboxModal visible={chatTarget !== null} onClose={() => setChatTarget(null)} startTarget={chatTarget} />
      <UserProfileModal
        visible={profileTarget?.role === "candidate"}
        userId={profileTarget?.role === "candidate" ? profileTarget.id : null}
        onClose={() => setProfileTarget(null)}
      />
      <OrgProfileModal
        visible={profileTarget?.role === "employer"}
        orgUserId={profileTarget?.role === "employer" ? profileTarget.id : null}
        onClose={() => setProfileTarget(null)}
      />
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
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowContent: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  jobTitle: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  chatLink: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
