import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import {
  JOB_POSITIONS,
  JOB_BRANCHES,
  JOB_WORK_TYPES,
  JOB_WEEKDAYS,
  JOB_PAYMENT_MODELS,
  JOB_EXPERIENCE_LEVELS,
  JOB_SALARY_TYPES,
  JOB_CLINIC_AMENITIES,
  type MicroCompetencyTag,
  type JobPosition,
  type JobBranch,
  type JobWorkType,
  type JobWeekday,
  type JobPaymentModel,
  type JobExperienceLevel,
  type JobSalaryType,
  type JobClinicAmenity,
} from "@dentsocia/shared-constants";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { ModalShell } from "../../../components/ModalShell";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { ChipSingleSelect, ChipMultiSelect } from "../../../components/ChipSelect";
import { createJob, type JobItem } from "../../../services/jobApi";
import { TagPicker } from "../../../components/TagPicker";
import { useTheme } from "../../../store/useThemeStore";

interface CreateJobModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (job: JobItem) => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };
const SGK_OPTIONS = ["SGK var", "SGK yok"] as const;

export function CreateJobModal({ visible, onClose, onCreated }: CreateJobModalProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [specialties, setSpecialties] = useState<MicroCompetencyTag[]>([]);
  const [position, setPosition] = useState<JobPosition | null>(null);
  const [branch, setBranch] = useState<JobBranch | null>(null);
  const [workType, setWorkType] = useState<JobWorkType | null>(null);
  const [workDays, setWorkDays] = useState<JobWeekday[]>([]);
  const [workHoursStart, setWorkHoursStart] = useState("");
  const [workHoursEnd, setWorkHoursEnd] = useState("");
  const [paymentModel, setPaymentModel] = useState<JobPaymentModel | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<JobExperienceLevel | null>(null);
  const [sgkChoice, setSgkChoice] = useState<(typeof SGK_OPTIONS)[number] | null>(null);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryType, setSalaryType] = useState<JobSalaryType | null>(null);
  const [premiumPercentage, setPremiumPercentage] = useState("");
  const [clinicAmenities, setClinicAmenities] = useState<JobClinicAmenity[]>([]);
  const [unitCount, setUnitCount] = useState("");
  const [employeeDentistCount, setEmployeeDentistCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSalary = salaryMin.length > 0 || salaryMax.length > 0;

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocation("");
    setSpecialties([]);
    setPosition(null);
    setBranch(null);
    setWorkType(null);
    setWorkDays([]);
    setWorkHoursStart("");
    setWorkHoursEnd("");
    setPaymentModel(null);
    setExperienceLevel(null);
    setSgkChoice(null);
    setSalaryMin("");
    setSalaryMax("");
    setSalaryType(null);
    setPremiumPercentage("");
    setClinicAmenities([]);
    setUnitCount("");
    setEmployeeDentistCount("");
  }

  async function handleSubmit() {
    if (!position || !branch || !workType || workDays.length === 0 || !paymentModel || !experienceLevel || !sgkChoice) {
      setError("Lütfen tüm zorunlu alanları doldurun");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const job = await createJob({
        title,
        description,
        location,
        specialties,
        position,
        branch,
        workType,
        workDays,
        workHoursStart,
        workHoursEnd,
        paymentModel,
        experienceLevel,
        hasSgk: sgkChoice === "SGK var",
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        salaryType: hasSalary ? (salaryType ?? undefined) : undefined,
        premiumPercentage: premiumPercentage ? Number(premiumPercentage) : undefined,
        clinicAmenities,
        unitCount: unitCount ? Number(unitCount) : undefined,
        employeeDentistCount: employeeDentistCount ? Number(employeeDentistCount) : undefined,
      });
      resetForm();
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
        <Input style={styles.field} placeholder="Şehir / ilçe" value={location} onChangeText={setLocation} />

        <ChipSingleSelect label="Pozisyon" options={JOB_POSITIONS} selected={position} onChange={setPosition} />
        <ChipSingleSelect label="Branş" options={JOB_BRANCHES} selected={branch} onChange={setBranch} />
        <ChipSingleSelect label="Çalışma tipi" options={JOB_WORK_TYPES} selected={workType} onChange={setWorkType} />
        <ChipMultiSelect label="Çalışma günleri" options={JOB_WEEKDAYS} selected={workDays} onChange={setWorkDays} />

        <View style={styles.timeRow}>
          <Input style={styles.timeField} label="Başlangıç" placeholder="09:00" value={workHoursStart} onChangeText={setWorkHoursStart} />
          <Input style={styles.timeField} label="Bitiş" placeholder="18:00" value={workHoursEnd} onChangeText={setWorkHoursEnd} />
        </View>

        <ChipSingleSelect label="Ödeme modeli" options={JOB_PAYMENT_MODELS} selected={paymentModel} onChange={setPaymentModel} />
        <ChipSingleSelect label="Tecrübe" options={JOB_EXPERIENCE_LEVELS} selected={experienceLevel} onChange={setExperienceLevel} />
        <ChipSingleSelect label="Sigorta" options={SGK_OPTIONS} selected={sgkChoice} onChange={setSgkChoice} />

        <Text style={[styles.label, { color: colors.textPrimary }]}>Aranan yetkinlikler</Text>
        <TagPicker selected={specialties} onChange={setSpecialties} />

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Opsiyonel</Text>

        <View style={styles.timeRow}>
          <Input
            style={styles.timeField}
            label="Min maaş"
            placeholder="30000"
            value={salaryMin}
            onChangeText={setSalaryMin}
            keyboardType="numeric"
          />
          <Input
            style={styles.timeField}
            label="Max maaş"
            placeholder="45000"
            value={salaryMax}
            onChangeText={setSalaryMax}
            keyboardType="numeric"
          />
        </View>
        {hasSalary ? (
          <ChipSingleSelect label="Maaş tipi" options={JOB_SALARY_TYPES} selected={salaryType} onChange={setSalaryType} />
        ) : null}

        <Input
          style={styles.field}
          label="Prim yüzdesi"
          placeholder="10"
          value={premiumPercentage}
          onChangeText={setPremiumPercentage}
          keyboardType="numeric"
        />

        <ChipMultiSelect label="Klinik olanakları" options={JOB_CLINIC_AMENITIES} selected={clinicAmenities} onChange={setClinicAmenities} />

        <View style={styles.timeRow}>
          <Input style={styles.timeField} label="Ünit sayısı" placeholder="4" value={unitCount} onChangeText={setUnitCount} keyboardType="numeric" />
          <Input
            style={styles.timeField}
            label="Çalışan hekim sayısı"
            placeholder="2"
            value={employeeDentistCount}
            onChangeText={setEmployeeDentistCount}
            keyboardType="numeric"
          />
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <View style={styles.buttonRow}>
          <Button label="İptal" onPress={onClose} disabled={submitting} variant="secondary" style={styles.flexButton} />
          <Button label="Yayınla" onPress={handleSubmit} loading={submitting} style={styles.flexButton} />
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
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
  timeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  timeField: {
    flex: 1,
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
