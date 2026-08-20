import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { useTheme } from "../../../store/useThemeStore";

interface ApplyModalProps {
  visible: boolean;
  jobTitle: string;
  onClose: () => void;
  onSubmit: (message?: string) => Promise<void>;
}

export function ApplyModal({ visible, jobTitle, onClose, onSubmit }: ApplyModalProps) {
  const { colors } = useTheme();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(message || undefined);
      setMessage("");
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Başvuru gönderilemedi"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet">
          <Text style={[styles.title, { color: colors.textPrimary }]}>{jobTitle}</Text>
          <Input
            style={styles.multiline}
            placeholder="Kısa bir mesaj (opsiyonel)"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <View style={styles.buttonRow}>
            <Button label="İptal" onPress={onClose} disabled={submitting} variant="secondary" style={styles.flexButton} />
            <Button label="Başvur" onPress={handleSubmit} loading={submitting} style={styles.flexButton} />
          </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  error: {
    marginTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
});
