import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { fontFamilies, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Avatar } from "../../../components/Avatar";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Skeleton } from "../../../components/Skeleton";
import { ReportModal } from "../../../components/ReportModal";
import { getPublicProfile, type PublicProfile } from "../../../services/publicProfileApi";
import { requestReference, writeReference } from "../../../services/referenceApi";
import { useAuthStore } from "../../../store/useAuthStore";
import { InboxModal } from "../../inbox/components/InboxModal";

interface UserProfileModalProps {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

export function UserProfileModal({ visible, userId, onClose }: UserProfileModalProps) {
  const { colors } = useTheme();
  const textPrimaryStyle = { color: colors.textPrimary };
  const accentGoldTextStyle = { color: colors.accentGold };
  const dangerTextStyle = { color: colors.danger };
  const successTextStyle = { color: colors.success };
  const textSecondaryStyle = { color: colors.textSecondary };
  const referenceRowStyle = { borderTopColor: colors.border };
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [writeFormVisible, setWriteFormVisible] = useState(false);
  const [relationship, setRelationship] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const currentUserId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!visible || !userId) {
      return;
    }
    setLoading(true);
    setError(null);
    setProfile(null);
    setWriteFormVisible(false);
    setFeedback(null);
    getPublicProfile(userId)
      .then(setProfile)
      .catch((err) => setError(getApiErrorMessage(err, "Profil yüklenemedi")))
      .finally(() => setLoading(false));
  }, [visible, userId]);

  async function handleRequestReference() {
    if (!userId) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestReference(userId);
      setFeedback("Referans isteği gönderildi");
    } catch (err) {
      setError(getApiErrorMessage(err, "Referans isteği gönderilemedi"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWriteReference() {
    if (!userId || !body.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await writeReference(userId, body.trim(), relationship.trim() || undefined);
      setFeedback("Referans yazıldı");
      setWriteFormVisible(false);
      setRelationship("");
      setBody("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Referans yazılamadı"));
    } finally {
      setSubmitting(false);
    }
  }

  const isSelf = profile?.id === currentUserId;

  return (
    <>
      <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, textPrimaryStyle]}>Kullanıcı Profili</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, accentGoldTextStyle]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.profileHeader}>
              <Skeleton width={64} height={64} radius={32} />
              <View style={styles.loadingLines}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} style={styles.loadingLineGap} />
              </View>
            </View>
          ) : null}
          {error ? <Text style={[styles.error, dangerTextStyle]}>{error}</Text> : null}
          {feedback ? <Text style={[styles.feedback, successTextStyle]}>{feedback}</Text> : null}

          {profile ? (
            <ScrollView>
              <View style={styles.profileHeader}>
                <Avatar name={profile.displayName} imageUrl={profile.avatarUrl} size="lg" />
                <View style={styles.profileHeaderText}>
                  <Text style={[styles.displayName, textPrimaryStyle]}>{profile.displayName}</Text>
                  {profile.title ? <Text style={[styles.title, accentGoldTextStyle]}>{profile.title}</Text> : null}
                  {profile.workplace ? <Text style={[styles.workplace, textSecondaryStyle]}>{profile.workplace}</Text> : null}
                  {profile.city ? <Text style={[styles.workplace, textSecondaryStyle]}>{profile.city}</Text> : null}
                </View>
              </View>

              {profile.bio ? <Text style={[styles.bio, textSecondaryStyle]}>{profile.bio}</Text> : null}

              {!isSelf ? (
                <View style={styles.actionRow}>
                  <Button label="Mesaj Gönder" variant="secondary" size="sm" onPress={() => setMessageVisible(true)} />
                  <Button label="Şikâyet Et" variant="secondary" size="sm" onPress={() => setReportVisible(true)} />
                  <Button
                    label="Referans İste"
                    variant="secondary"
                    size="sm"
                    loading={submitting}
                    onPress={handleRequestReference}
                  />
                  <Button
                    label="Referans Yaz"
                    variant="secondary"
                    size="sm"
                    onPress={() => setWriteFormVisible((current) => !current)}
                  />
                </View>
              ) : null}

              {writeFormVisible ? (
                <View style={styles.writeForm}>
                  <Input
                    style={styles.field}
                    placeholder="İlişkiniz (örn. Birlikte çalıştık)"
                    value={relationship}
                    onChangeText={setRelationship}
                  />
                  <Input
                    style={[styles.field, styles.multiline]}
                    placeholder="Referans metni"
                    value={body}
                    onChangeText={setBody}
                    multiline
                  />
                  <Button
                    label="Gönder"
                    onPress={handleWriteReference}
                    loading={submitting}
                    variant="gold"
                    size="sm"
                  />
                </View>
              ) : null}

              <Text style={[styles.sectionTitle, textPrimaryStyle]}>Referanslar ({profile.references.length})</Text>
              {profile.references.length === 0 ? (
                <Text style={[styles.emptyText, textSecondaryStyle]}>Henüz referans yok</Text>
              ) : (
                profile.references.map((reference) => (
                  <View key={reference.id} style={[styles.referenceRow, referenceRowStyle]}>
                    <Text style={[styles.referenceAuthor, textPrimaryStyle]}>{reference.counterpart.displayName}</Text>
                    {reference.relationship ? (
                      <Text style={[styles.referenceRelationship, textSecondaryStyle]}>{reference.relationship}</Text>
                    ) : null}
                    <Text style={[styles.referenceBody, textSecondaryStyle]}>{reference.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          ) : null}
      </ModalShell>

      <InboxModal visible={messageVisible} onClose={() => setMessageVisible(false)} startTarget={userId ? { userId } : null} />
      {userId ? (
        <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} targetType="user" targetId={userId} />
      ) : null}
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
  headerTitle: {
    ...typographyPresets.h1,
  },
  closeText: {
    fontSize: 13.5,
    fontFamily: fontFamilies.semibold,
  },
  loadingLines: {
    flex: 1,
    marginLeft: spacing.md,
  },
  loadingLineGap: {
    marginTop: spacing.xs,
  },
  error: {
    marginBottom: spacing.sm,
  },
  feedback: {
    marginBottom: spacing.sm,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  profileHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  displayName: {
    ...typographyPresets.h2,
  },
  title: {
    ...typographyPresets.bodySmall,
    marginTop: 2,
  },
  workplace: {
    ...typographyPresets.bodySmall,
    marginTop: 2,
  },
  bio: {
    ...typographyPresets.body,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  writeForm: {
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.sm,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  sectionTitle: {
    ...typographyPresets.h2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typographyPresets.body,
  },
  referenceRow: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  referenceAuthor: {
    ...typographyPresets.bodySmall,
  },
  referenceRelationship: {
    fontSize: 12,
    marginTop: 1,
  },
  referenceBody: {
    ...typographyPresets.body,
    marginTop: spacing.xs,
  },
});
