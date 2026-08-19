import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { createJob, type JobItem } from "../../../services/jobApi";
import { TagPicker } from "../../../components/TagPicker";
import { useTheme } from "../../../store/useThemeStore";

interface CreateJobModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (job: JobItem) => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

export function CreateJobModal({ visible, onClose, onCreated }: CreateJobModalProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [specialties, setSpecialties] = useState<MicroCompetencyTag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const job = await createJob({
        title,
        description: description || undefined,
        location: location || undefined,
        specialties,
      });
      setTitle("");
      setDescription("");
      setLocation("");
      setSpecialties([]);
      onCreated(job);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "İlan oluşturulamadı"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <ScrollView>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Yeni İlan</Text>
            <Input style={styles.field} placeholder="Pozisyon başlığı" value={title} onChangeText={setTitle} />
            <Input
              style={[styles.field, styles.multiline]}
              placeholder="Açıklama"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Input style={styles.field} placeholder="Konum" value={location} onChangeText={setLocation} />
            <Text style={[styles.label, { color: colors.textPrimary }]}>Aranan yetkinlikler</Text>
            <TagPicker selected={specialties} onChange={setSpecialties} />

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

            <View style={styles.buttonRow}>
              <Button label="İptal" onPress={onClose} disabled={submitting} variant="secondary" style={styles.flexButton} />
              <Button
                label="Yayınla"
                onPress={handleSubmit}
                loading={submitting}
                style={styles.flexButton}
              />
            </View>
          </ScrollView>
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
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
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
