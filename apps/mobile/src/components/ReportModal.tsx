import { useState } from "react";
import { StyleSheet, Text, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";
import { ModalShell } from "./ModalShell";
import { Input } from "./Input";
import { Button } from "./Button";
import { ChipSingleSelect } from "./ChipSelect";
import { createReport } from "../services/reportApi";
import type { ReportTargetType, ReportReason } from "../services/adminApi";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "70%" };

const REASONS: readonly ReportReason[] = ["spam", "inappropriate_content", "fake_profile", "harassment", "fraud", "other"];
const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  inappropriate_content: "Uygunsuz İçerik",
  fake_profile: "Sahte Profil",
  harassment: "Taciz",
  fraud: "Dolandırıcılık",
  other: "Diğer",
};

// PRD v3 §5.1 — tek şikâyet altyapısı, her yerden aynı modal çağrılabilir (targetType/targetId
// prop olarak alınır). Bu oturumda somut kullanım UserProfileModal'da; case/job/mesaj
// yüzeylerine bağlama ayrı bir takip işi.
export function ReportModal({ visible, onClose, targetType, targetId }: ReportModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      setError("Lütfen bir sebep seç");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReport(targetType, targetId, reason, details || undefined);
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Şikâyet gönderilemedi"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setReason(null);
    setDetails("");
    setDone(false);
    setError(null);
    onClose();
  }

  return (
    <ModalShell visible={visible} onClose={handleClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Şikâyet Et</Text>

      {done ? (
        <>
          <Text style={[styles.doneText, { color: colors.textSecondary }]}>
            Şikâyetin alındı, ekibimiz en kısa sürede inceleyecek.
          </Text>
          <Button label="Kapat" onPress={handleClose} fullWidth />
        </>
      ) : (
        <>
          <ChipSingleSelect
            label="Sebep"
            options={REASONS.map((value) => REASON_LABELS[value])}
            selected={reason ? REASON_LABELS[reason] : null}
            onChange={(label) => setReason(REASONS.find((value) => REASON_LABELS[value] === label) ?? null)}
          />
          <Input
            style={styles.field}
            placeholder="Detay (opsiyonel)"
            value={details}
            onChangeText={setDetails}
            multiline
          />
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Button label="Gönder" onPress={handleSubmit} loading={submitting} fullWidth />
        </>
      )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
    minHeight: 70,
    textAlignVertical: "top",
  },
  error: {
    marginBottom: spacing.sm,
  },
  doneText: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
});
