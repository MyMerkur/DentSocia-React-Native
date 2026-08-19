import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Users } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";
import { getJobApplications, updateApplicationStatus, type JobApplicantItem, type JobItem } from "../../../services/jobApi";
import { statusLabel, statusBadgeVariant } from "../statusStyles";
import { InboxModal } from "../../inbox/components/InboxModal";
import { UserProfileModal } from "../../profiles/components/UserProfileModal";
import { useTheme } from "../../../store/useThemeStore";

interface ApplicantsModalProps {
  visible: boolean;
  job: JobItem | null;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "80%" };

export function ApplicantsModal({ visible, job, onClose }: ApplicantsModalProps) {
  const { colors } = useTheme();
  const [applicants, setApplicants] = useState<JobApplicantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [messageTargetId, setMessageTargetId] = useState<string | null>(null);
  const [profileTargetId, setProfileTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !job) {
      return;
    }
    setLoading(true);
    setError(null);
    getJobApplications(job.id)
      .then(setApplicants)
      .catch((err) => setError(getApiErrorMessage(err, "Başvurular yüklenemedi")))
      .finally(() => setLoading(false));
  }, [visible, job]);

  async function handleDecision(applicationId: string, status: "accepted" | "rejected") {
    setUpdatingId(applicationId);
    try {
      const updated = await updateApplicationStatus(applicationId, status);
      setApplicants((current) => current.map((item) => (item.id === applicationId ? updated : item)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Güncellenemedi"));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{job?.title ?? ""}</Text>
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
              {applicants.length === 0 ? <EmptyState icon={Users} title="Henüz başvuru yok" /> : null}
              {applicants.map((applicant) => (
                <View key={applicant.id} style={[styles.row, { borderTopColor: colors.border }]}>
                  <Avatar name={applicant.applicant.displayName} imageUrl={applicant.applicant.avatarUrl} size="md" />
                  <View style={styles.rowContent}>
                    <TouchableOpacity onPress={() => setProfileTargetId(applicant.applicant.id)}>
                      <Text style={[styles.applicantName, { color: colors.textPrimary }]}>
                        {applicant.applicant.displayName}
                      </Text>
                    </TouchableOpacity>
                    {applicant.message ? (
                      <Text style={[styles.message, { color: colors.textSecondary }]}>{applicant.message}</Text>
                    ) : null}
                    <View style={styles.statusRow}>
                      <Badge label={statusLabel(applicant.status)} variant={statusBadgeVariant(applicant.status)} />
                    </View>
                    <TouchableOpacity onPress={() => setMessageTargetId(applicant.applicant.id)}>
                      <Text style={[styles.messageLink, { color: colors.accentGold }]}>Mesaj Gönder</Text>
                    </TouchableOpacity>
                    {applicant.status === "pending" ? (
                      <View style={styles.decisionRow}>
                        <TouchableOpacity
                          style={[styles.acceptButton, { backgroundColor: colors.success }]}
                          onPress={() => handleDecision(applicant.id, "accepted")}
                          disabled={updatingId === applicant.id}
                        >
                          <Text style={[styles.acceptButtonText, { color: colors.background }]}>Onayla</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectButton, { borderColor: colors.danger }]}
                          onPress={() => handleDecision(applicant.id, "rejected")}
                          disabled={updatingId === applicant.id}
                        >
                          <Text style={[styles.rejectButtonText, { color: colors.danger }]}>Reddet</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
      </ModalShell>

      <InboxModal
        visible={messageTargetId !== null}
        onClose={() => setMessageTargetId(null)}
        startTarget={
          messageTargetId && job ? { userId: messageTargetId, context: { type: "job", id: job.id } } : null
        }
      />
      <UserProfileModal visible={profileTargetId !== null} userId={profileTargetId} onClose={() => setProfileTargetId(null)} />
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
  skeletonList: {
    gap: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowContent: {
    flex: 1,
  },
  applicantName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  message: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  statusRow: {
    marginTop: spacing.xs,
  },
  messageLink: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  decisionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  acceptButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  acceptButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  rejectButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  rejectButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
