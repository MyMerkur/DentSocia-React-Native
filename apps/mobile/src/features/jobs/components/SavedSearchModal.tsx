import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Bookmark, Trash2 } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import {
  JOB_POSITIONS,
  JOB_BRANCHES,
  JOB_WORK_TYPES,
  JOB_EXPERIENCE_LEVELS,
  type MicroCompetencyTag,
  type JobPosition,
  type JobBranch,
  type JobWorkType,
  type JobExperienceLevel,
} from "@dentsocia/shared-constants";
import { iconSizes, iconStrokeWidth, spacing, typography, typographyPresets } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { ChipSingleSelect } from "../../../components/ChipSelect";
import { TagPicker } from "../../../components/TagPicker";
import { useTheme } from "../../../store/useThemeStore";
import { createSavedSearch, deleteSavedSearch, getMySavedSearches, type SavedSearchItem } from "../../../services/savedSearchApi";

interface SavedSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

function summarizeCriteria(criteria: SavedSearchItem["criteria"]): string {
  const parts = [criteria.location, criteria.workType, criteria.branch, criteria.position, criteria.experienceLevel, ...criteria.specialties].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : "Tüm kriterler açık";
}

// PRD v3 §9.2 — kayıtlı arama. Kriter seti kaydedilir, eşleşen yeni ilan çıktığında bildirim
// gelir (backend: job.service.ts → savedSearch.service.ts). Burada ad-hoc ilan filtreleme
// yapılmıyor, sadece kriter kaydı + mevcut kayıtların yönetimi.
export function SavedSearchModal({ visible, onClose }: SavedSearchModalProps) {
  const { colors } = useTheme();
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState<JobWorkType | null>(null);
  const [position, setPosition] = useState<JobPosition | null>(null);
  const [branch, setBranch] = useState<JobBranch | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<JobExperienceLevel | null>(null);
  const [specialties, setSpecialties] = useState<MicroCompetencyTag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSavedSearches(await getMySavedSearches());
    } catch {
      // sessizce yut — liste boş görünür, kullanıcı yeniden açarak tekrar deneyebilir
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSavedSearch({
        label: label || undefined,
        criteria: {
          location: location || undefined,
          workType: workType ?? undefined,
          position: position ?? undefined,
          branch: branch ?? undefined,
          experienceLevel: experienceLevel ?? undefined,
          specialties,
        },
      });
      setSavedSearches((current) => [created, ...current]);
      setLabel("");
      setLocation("");
      setWorkType(null);
      setPosition(null);
      setBranch(null);
      setExperienceLevel(null);
      setSpecialties([]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Kayıtlı arama oluşturulamadı"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSavedSearch(id);
      setSavedSearches((current) => current.filter((item) => item.id !== id));
    } catch {
      // sessizce yut
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
      <ScrollView>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Kayıtlı Aramalarım</Text>

        {loading ? null : savedSearches.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Henüz kayıtlı arama yok"
            description="Kriterlerine uyan yeni bir ilan çıktığında haberdar olmak için aşağıdan bir arama kaydet."
          />
        ) : (
          savedSearches.map((item) => (
            <Card key={item.id} style={styles.savedSearchCard}>
              <View style={styles.savedSearchRow}>
                <View style={styles.savedSearchTextCol}>
                  {item.label ? <Text style={[styles.savedSearchLabel, { color: colors.textPrimary }]}>{item.label}</Text> : null}
                  <Text style={[styles.savedSearchSummary, { color: colors.textSecondary }]}>{summarizeCriteria(item.criteria)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} accessibilityLabel="Kayıtlı aramayı sil">
                  <Trash2 size={iconSizes.md} color={colors.danger} strokeWidth={iconStrokeWidth} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Yeni arama kaydet</Text>
        <Input style={styles.field} placeholder="Ad (opsiyonel, örn. İzmir yarı zamanlı)" value={label} onChangeText={setLabel} />
        <Input style={styles.field} placeholder="Şehir / ilçe" value={location} onChangeText={setLocation} />
        <ChipSingleSelect label="Çalışma tipi" options={JOB_WORK_TYPES} selected={workType} onChange={setWorkType} />
        <ChipSingleSelect label="Pozisyon" options={JOB_POSITIONS} selected={position} onChange={setPosition} />
        <ChipSingleSelect label="Branş" options={JOB_BRANCHES} selected={branch} onChange={setBranch} />
        <ChipSingleSelect label="Tecrübe" options={JOB_EXPERIENCE_LEVELS} selected={experienceLevel} onChange={setExperienceLevel} />
        <Text style={[styles.label, { color: colors.textPrimary }]}>Yetkinlikler</Text>
        <TagPicker selected={specialties} onChange={setSpecialties} />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Button label="Aramayı Kaydet" onPress={handleCreate} loading={submitting} fullWidth style={styles.saveButton} />
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
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  savedSearchCard: {
    marginBottom: spacing.sm,
  },
  savedSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  savedSearchTextCol: {
    flex: 1,
  },
  savedSearchLabel: {
    ...typographyPresets.h2,
  },
  savedSearchSummary: {
    ...typographyPresets.bodySmall,
    marginTop: 2,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  error: {
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
