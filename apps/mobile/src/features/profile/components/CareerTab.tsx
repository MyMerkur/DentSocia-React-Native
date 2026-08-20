import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { updateCareer, type ExperienceEntry, type UserProfile } from "../../../services/profileApi";
import { TagPicker } from "../../../components/TagPicker";

interface CareerTabProps {
  profile: UserProfile;
  onUpdated: (profile: UserProfile) => void;
}

export function CareerTab({ profile, onUpdated }: CareerTabProps) {
  const { colors } = useTheme();
  const textPrimaryStyle = { color: colors.textPrimary };
  const textSecondaryStyle = { color: colors.textSecondary };
  const dangerTextStyle = { color: colors.danger };
  const addButtonBorderStyle = { borderColor: colors.accentGold };
  const accentGoldTextStyle = { color: colors.accentGold };
  const [openToWork, setOpenToWork] = useState(profile.career.openToWork);
  const [hiddenSearch, setHiddenSearch] = useState(profile.career.hiddenSearch);
  const [desiredPositions, setDesiredPositions] = useState<MicroCompetencyTag[]>(profile.career.desiredPositions);
  const [experienceYears, setExperienceYears] = useState(
    profile.career.experienceYears != null ? String(profile.career.experienceYears) : "",
  );
  const [experience, setExperience] = useState<ExperienceEntry[]>(profile.career.experience);
  const [newTitle, setNewTitle] = useState("");
  const [newWorkplace, setNewWorkplace] = useState("");
  const [newStartYear, setNewStartYear] = useState("");
  const [newEndYear, setNewEndYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddExperience() {
    const startYear = Number(newStartYear);
    if (!newTitle.trim() || !newWorkplace.trim() || !startYear) {
      return;
    }
    const endYear = newEndYear ? Number(newEndYear) : null;
    setExperience([...experience, { title: newTitle.trim(), workplace: newWorkplace.trim(), startYear, endYear }]);
    setNewTitle("");
    setNewWorkplace("");
    setNewStartYear("");
    setNewEndYear("");
  }

  function handleRemoveExperience(index: number) {
    setExperience(experience.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCareer({
        openToWork,
        hiddenSearch,
        desiredPositions,
        experienceYears: experienceYears ? Number(experienceYears) : undefined,
        experience,
      });
      onUpdated(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Kaydedilemedi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.switchRow}>
        <Text style={[styles.label, textPrimaryStyle]}>İş arıyorum</Text>
        <Switch
          value={openToWork}
          onValueChange={setOpenToWork}
          trackColor={{ true: colors.accentGold, false: colors.border }}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={[styles.label, textPrimaryStyle]}>Gizli iş arama modu</Text>
        <Switch
          value={hiddenSearch}
          onValueChange={setHiddenSearch}
          trackColor={{ true: colors.accentGold, false: colors.border }}
        />
      </View>

      <Text style={[styles.label, textPrimaryStyle]}>Aranan pozisyonlar</Text>
      <TagPicker selected={desiredPositions} onChange={setDesiredPositions} />

      <Input
        style={styles.field}
        placeholder="Deneyim (yıl)"
        keyboardType="number-pad"
        value={experienceYears}
        onChangeText={setExperienceYears}
      />

      <Text style={[styles.label, textPrimaryStyle]}>İş deneyimi</Text>
      {experience.map((entry, index) => (
        <Card key={`${entry.title}-${entry.startYear}-${index}`} style={styles.experienceRow}>
          <View style={styles.experienceRowContent}>
            <View style={styles.experienceInfo}>
              <Text style={[styles.experienceTitle, textPrimaryStyle]}>{entry.title}</Text>
              <Text style={[styles.experienceSubtitle, textSecondaryStyle]}>
                {entry.workplace} · {entry.startYear} - {entry.endYear ?? "devam ediyor"}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveExperience(index)}>
              <Text style={[styles.removeText, dangerTextStyle]}>Sil</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      <View style={styles.addForm}>
        <Input style={styles.field} placeholder="Unvan" value={newTitle} onChangeText={setNewTitle} />
        <Input style={styles.field} placeholder="İşyeri" value={newWorkplace} onChangeText={setNewWorkplace} />
        <View style={styles.yearRow}>
          <Input
            style={[styles.field, styles.yearInput]}
            placeholder="Başlangıç yılı"
            keyboardType="number-pad"
            value={newStartYear}
            onChangeText={setNewStartYear}
          />
          <Input
            style={[styles.field, styles.yearInput]}
            placeholder="Bitiş yılı (boş = devam)"
            keyboardType="number-pad"
            value={newEndYear}
            onChangeText={setNewEndYear}
          />
        </View>
        <TouchableOpacity style={[styles.addButton, addButtonBorderStyle]} onPress={handleAddExperience}>
          <Text style={[styles.addButtonText, accentGoldTextStyle]}>Deneyim Ekle</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={[styles.error, dangerTextStyle]}>{error}</Text> : null}

      <Button label="Kaydet" onPress={handleSave} loading={saving} fullWidth style={styles.saveButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  field: {
    marginBottom: spacing.md,
  },
  experienceRow: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  experienceRowContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  experienceInfo: {
    flex: 1,
  },
  experienceTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  experienceSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  removeText: {
    fontSize: typography.sizes.sm,
  },
  addForm: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  yearRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  yearInput: {
    flex: 1,
  },
  addButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  error: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
