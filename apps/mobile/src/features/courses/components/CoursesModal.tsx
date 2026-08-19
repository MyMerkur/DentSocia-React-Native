import { useEffect, useState } from "react";
import { Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { GraduationCap } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Card } from "../../../components/Card";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { EmptyState } from "../../../components/EmptyState";
import {
  createCourse,
  listCourses,
  listMyCourses,
  enrollInCourse,
  listMyEnrollments,
  listCourseEnrollments,
  completeEnrollment,
  type CourseItem,
  type EnrollmentItem,
  type CourseParticipant,
} from "../../../services/courseApi";
import { TagPicker } from "../../../components/TagPicker";

interface CoursesModalProps {
  visible: boolean;
  onClose: () => void;
  isInstructor: boolean;
}

type CoursesTab = "browse" | "mine" | "manage";

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

const STATUS_LABELS: Record<"enrolled" | "completed", string> = {
  enrolled: "Devam ediyor",
  completed: "Tamamlandı",
};

export function CoursesModal({ visible, onClose, isInstructor }: CoursesModalProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<CoursesTab>("browse");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);

  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);

  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CourseParticipant[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSpecialties, setNewSpecialties] = useState<MicroCompetencyTag[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedCourseId(null);
    loadActiveTab(activeTab);
  }, [visible, activeTab]);

  async function loadActiveTab(tab: CoursesTab) {
    setLoading(true);
    setError(null);
    try {
      if (tab === "browse") {
        setCourses(await listCourses());
      } else if (tab === "mine") {
        setEnrollments(await listMyEnrollments());
      } else {
        setMyCourses(await listMyCourses());
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll(courseId: string) {
    setEnrollingCourseId(courseId);
    setError(null);
    try {
      await enrollInCourse(courseId);
      await loadActiveTab("browse");
    } catch (err) {
      setError(getApiErrorMessage(err, "Kursa katılınamadı"));
    } finally {
      setEnrollingCourseId(null);
    }
  }

  async function handleShareCertificate(verificationUrl: string) {
    await Share.share({ message: verificationUrl });
  }

  async function handleCreateCourse() {
    setCreating(true);
    setError(null);
    try {
      await createCourse({
        title: newTitle,
        description: newDescription || undefined,
        specialties: newSpecialties,
      });
      setNewTitle("");
      setNewDescription("");
      setNewSpecialties([]);
      await loadActiveTab("manage");
    } catch (err) {
      setError(getApiErrorMessage(err, "Kurs oluşturulamadı"));
    } finally {
      setCreating(false);
    }
  }

  async function handleSelectCourseToManage(courseId: string) {
    setSelectedCourseId(courseId);
    setLoading(true);
    setError(null);
    try {
      setParticipants(await listCourseEnrollments(courseId));
    } catch (err) {
      setError(getApiErrorMessage(err, "Katılımcılar yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(enrollmentId: string) {
    if (!selectedCourseId) {
      return;
    }
    setCompletingId(enrollmentId);
    setError(null);
    try {
      await completeEnrollment(selectedCourseId, enrollmentId);
      setParticipants(await listCourseEnrollments(selectedCourseId));
    } catch (err) {
      setError(getApiErrorMessage(err, "Tamamlandı olarak işaretlenemedi"));
    } finally {
      setCompletingId(null);
    }
  }

  const activeTabBorderStyle = { borderBottomColor: colors.accentGold };
  const activeTabTextStyle = { color: colors.accentGold };

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>🎓 Kurslar</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "browse" && activeTabBorderStyle]}
              onPress={() => setActiveTab("browse")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  activeTab === "browse" && styles.tabTextActive,
                  activeTab === "browse" && activeTabTextStyle,
                ]}
              >
                Kurslar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === "mine" && activeTabBorderStyle]}
              onPress={() => setActiveTab("mine")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  activeTab === "mine" && styles.tabTextActive,
                  activeTab === "mine" && activeTabTextStyle,
                ]}
              >
                Kayıtlarım
              </Text>
            </TouchableOpacity>
            {isInstructor ? (
              <TouchableOpacity
                style={[styles.tabButton, activeTab === "manage" && activeTabBorderStyle]}
                onPress={() => setActiveTab("manage")}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: colors.textSecondary },
                    activeTab === "manage" && styles.tabTextActive,
                    activeTab === "manage" && activeTabTextStyle,
                  ]}
                >
                  Yönettiklerim
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          {loading ? (
            <View style={styles.loader}><BrandSpinner /></View>
          ) : (
            <ScrollView style={styles.content}>
              {activeTab === "browse" ? (
                courses.length === 0 ? (
                  <EmptyState icon={GraduationCap} title="Henüz kurs yok" />
                ) : (
                  courses.map((course) => (
                    <Card key={course.id} variant="elevated" style={styles.card}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{course.title}</Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {course.instructor.displayName}
                      </Text>
                      {course.description ? (
                        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{course.description}</Text>
                      ) : null}
                      <Button
                        label="Katıl"
                        onPress={() => handleEnroll(course.id)}
                        loading={enrollingCourseId === course.id}
                        fullWidth
                        style={styles.cardButton}
                      />
                    </Card>
                  ))
                )
              ) : null}

              {activeTab === "mine" ? (
                enrollments.length === 0 ? (
                  <EmptyState icon={GraduationCap} title="Henüz bir kursa kayıtlı değilsiniz" />
                ) : (
                  enrollments.map((enrollment) => (
                    <Card key={enrollment.id} variant="elevated" style={styles.card}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{enrollment.course.title}</Text>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {STATUS_LABELS[enrollment.status]}
                      </Text>
                      {enrollment.certificate ? (
                        <View style={styles.certificateBlock}>
                          <Image
                            source={{ uri: enrollment.certificate.qrCodeDataUrl }}
                            style={[styles.qrImage, { backgroundColor: colors.surface }]}
                          />
                          <TouchableOpacity
                            style={[styles.secondaryButton, { borderColor: colors.accentGold }]}
                            onPress={() => handleShareCertificate(enrollment.certificate!.verificationUrl)}
                          >
                            <Text style={[styles.secondaryButtonText, { color: colors.accentGold }]}>Paylaş</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </Card>
                  ))
                )
              ) : null}

              {activeTab === "manage" && isInstructor ? (
                selectedCourseId ? (
                  <View>
                    <TouchableOpacity onPress={() => setSelectedCourseId(null)}>
                      <Text style={[styles.backLink, { color: colors.accentGold }]}>{"< Geri"}</Text>
                    </TouchableOpacity>
                    {participants.length === 0 ? (
                      <EmptyState icon={GraduationCap} title="Henüz katılımcı yok" />
                    ) : (
                      participants.map((participant) => (
                        <Card key={participant.id} variant="elevated" style={styles.card}>
                          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                            {participant.participant.displayName}
                          </Text>
                          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                            {STATUS_LABELS[participant.status]}
                          </Text>
                          {participant.status === "enrolled" ? (
                            <Button
                              label="Tamamlandı İşaretle"
                              onPress={() => handleComplete(participant.id)}
                              loading={completingId === participant.id}
                              fullWidth
                              style={styles.cardButton}
                            />
                          ) : null}
                        </Card>
                      ))
                    )}
                  </View>
                ) : (
                  <View>
                    <Card variant="elevated" style={styles.card}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>+ Kurs Oluştur</Text>
                      <Input
                        style={styles.field}
                        placeholder="Kurs başlığı"
                        value={newTitle}
                        onChangeText={setNewTitle}
                      />
                      <Input
                        style={[styles.field, styles.multiline]}
                        placeholder="Açıklama (opsiyonel)"
                        value={newDescription}
                        onChangeText={setNewDescription}
                        multiline
                      />
                      <TagPicker selected={newSpecialties} onChange={setNewSpecialties} />
                      <Button
                        label="Oluştur"
                        onPress={handleCreateCourse}
                        loading={creating}
                        disabled={newTitle.length < 3}
                        fullWidth
                        style={styles.cardButton}
                      />
                    </Card>

                    {myCourses.map((course) => (
                      <TouchableOpacity key={course.id} onPress={() => handleSelectCourseToManage(course.id)}>
                        <Card variant="elevated" style={styles.card}>
                          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{course.title}</Text>
                        </Card>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ) : null}
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  closeText: {
    fontSize: typography.sizes.sm,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  tabTextActive: {
    fontWeight: typography.weights.semibold,
  },
  loader: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  content: {
    maxHeight: "100%",
  },
  error: {
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  cardBody: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  cardButton: {
    marginTop: spacing.sm,
  },
  field: {
    marginTop: spacing.sm,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  secondaryButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  certificateBlock: {
    marginTop: spacing.sm,
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  qrImage: {
    width: 120,
    height: 120,
    borderRadius: radii.sm,
  },
  backLink: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
});
