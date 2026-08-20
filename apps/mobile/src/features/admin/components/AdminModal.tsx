import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Card } from "../../../components/Card";
import { Badge } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";
import {
  getPendingKycDocuments,
  reviewKycDocument,
  getOpenReports,
  resolveReport,
  type PendingKycDocument,
  type OpenReport,
} from "../../../services/adminApi";
import { ShieldCheck, Flag } from "lucide-react-native";

interface AdminModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "90%" };

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  kimlik: "Kimlik Belgesi",
  diploma: "Diploma",
  kurumsal_belge: "Kurumsal Belge",
};

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  inappropriate_content: "Uygunsuz İçerik",
  fake_profile: "Sahte Profil",
  harassment: "Taciz",
  fraud: "Dolandırıcılık",
  other: "Diğer",
};

// Kullanıcı onayıyla eklenen minimal admin ekranı — sadece ADMIN_EMAILS listesindeki
// hesaplara AppDrawer'dan gösteriliyor. İlan denetimi bilinçli olarak dışarıda bırakıldı
// (işveren kendi ilanını zaten kapatabiliyor).
export function AdminModal({ visible, onClose }: AdminModalProps) {
  const { colors } = useTheme();
  const [documents, setDocuments] = useState<PendingKycDocument[]>([]);
  const [reports, setReports] = useState<OpenReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([getPendingKycDocuments(), getOpenReports()])
      .then(([docs, reps]) => {
        setDocuments(docs);
        setReports(reps);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Yönetici verileri yüklenemedi")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible]);

  async function handleKycDecision(id: string, decision: "approved" | "rejected") {
    setActingId(id);
    try {
      await reviewKycDocument(id, decision);
      setDocuments((current) => current.filter((doc) => doc.id !== id));
    } catch (err) {
      setError(getApiErrorMessage(err, "Belge değerlendirilemedi"));
    } finally {
      setActingId(null);
    }
  }

  async function handleReportDecision(id: string, status: "resolved" | "dismissed") {
    setActingId(id);
    try {
      await resolveReport(id, status);
      setReports((current) => current.filter((report) => report.id !== id));
    } catch (err) {
      setError(getApiErrorMessage(err, "Şikâyet çözümlenemedi"));
    } finally {
      setActingId(null);
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Yönetici Paneli</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderStack}>
          <SkeletonRow avatarSize={0} />
          <SkeletonRow avatarSize={0} />
        </View>
      ) : (
        <ScrollView>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KYC Onay Kuyruğu ({documents.length})</Text>
          {documents.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Kuyrukta belge yok" />
          ) : (
            documents.map((doc) => (
              <Card key={doc.id} variant="flat" style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{DOCUMENT_TYPE_LABELS[doc.documentType]}</Text>
                  {doc.aiConfidence ? (
                    <Badge
                      label={`AI güveni: ${doc.aiConfidence}`}
                      variant={doc.aiConfidence === "high" ? "success" : doc.aiConfidence === "medium" ? "warning" : "danger"}
                    />
                  ) : null}
                </View>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Başvuran: {doc.applicant.displayName}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Beyan edilen ad: {doc.claimedFullName}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  AI'nın okuduğu ad: {doc.extractedFullName ?? "—"} {doc.aiNameMatches === false ? "(eşleşmiyor)" : ""}
                </Text>
                {doc.reviewNote ? <Text style={[styles.hint, { color: colors.textSecondary }]}>Not: {doc.reviewNote}</Text> : null}
                <View style={styles.decisionRow}>
                  <TouchableOpacity
                    style={[styles.approveButton, { backgroundColor: colors.success }]}
                    onPress={() => handleKycDecision(doc.id, "approved")}
                    disabled={actingId === doc.id}
                  >
                    <Text style={[styles.decisionButtonText, { color: colors.background }]}>Onayla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectButton, { borderColor: colors.danger }]}
                    onPress={() => handleKycDecision(doc.id, "rejected")}
                    disabled={actingId === doc.id}
                  >
                    <Text style={[styles.decisionButtonText, { color: colors.danger }]}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Şikâyetler ({reports.length})</Text>
          {reports.length === 0 ? (
            <EmptyState icon={Flag} title="Açık şikâyet yok" />
          ) : (
            reports.map((report) => (
              <Card key={report.id} variant="flat" style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{REASON_LABELS[report.reason]}</Text>
                  <Badge label={report.targetType} variant="neutral" />
                </View>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Şikâyet eden: {report.reporter.displayName}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Hedef ID: {report.targetId}</Text>
                {report.details ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{report.details}</Text> : null}
                <View style={styles.decisionRow}>
                  <TouchableOpacity
                    style={[styles.approveButton, { backgroundColor: colors.success }]}
                    onPress={() => handleReportDecision(report.id, "resolved")}
                    disabled={actingId === report.id}
                  >
                    <Text style={[styles.decisionButtonText, { color: colors.background }]}>Çöz</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectButton, { borderColor: colors.danger }]}
                    onPress={() => handleReportDecision(report.id, "dismissed")}
                    disabled={actingId === report.id}
                  >
                    <Text style={[styles.decisionButtonText, { color: colors.danger }]}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
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
    ...typographyPresets.h1,
  },
  closeText: {
    fontSize: 13.5,
    fontWeight: typography.weights.semibold,
  },
  loaderStack: {
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  hint: {
    fontSize: typography.sizes.sm,
    marginBottom: 2,
  },
  decisionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  approveButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  rejectButton: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  decisionButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
