import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { getApiErrorMessage, uploadFileToPresignedUrl } from "@dentsocia/api-client";
import { EMPLOYER_ROLES, type MicroCompetencyTag } from "@dentsocia/shared-constants";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Badge } from "../../../components/Badge";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { requestAvatarUploadUrl, updateShowcase, getMe, type UserProfile } from "../../../services/profileApi";
import {
  searchOrgs,
  setAffiliation,
  requestAffiliation,
  listMyAffiliationRequests,
  type OrgSearchResult,
} from "../../../services/orgApi";
import {
  getIncomingRequests,
  fulfillRequest,
  getMyReferences,
  setReferenceVisibility,
  type ReferenceItem,
} from "../../../services/referenceApi";
import { acceptInstructorInvite } from "../../../services/instructorInviteApi";
import { TagPicker } from "../../../components/TagPicker";
import { OrgProfileModal } from "../../orgs/components/OrgProfileModal";

interface ShowcaseTabProps {
  profile: UserProfile;
  onUpdated: (profile: UserProfile) => void;
}

export function ShowcaseTab({ profile, onUpdated }: ShowcaseTabProps) {
  const { colors } = useTheme();
  const isEmployer = (EMPLOYER_ROLES as readonly string[]).includes(profile.role);
  const [displayName, setDisplayName] = useState(profile.showcase.displayName);
  const [title, setTitle] = useState(profile.showcase.title);
  const [bio, setBio] = useState(profile.showcase.bio);
  const [workplace, setWorkplace] = useState(profile.showcase.workplace);
  const [city, setCity] = useState(profile.showcase.city);
  const [specialties, setSpecialties] = useState<MicroCompetencyTag[]>(profile.showcase.specialties);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [affiliationQuery, setAffiliationQuery] = useState("");
  const [affiliationResults, setAffiliationResults] = useState<OrgSearchResult[]>([]);
  const [affiliationSaving, setAffiliationSaving] = useState(false);
  const [pendingAffiliation, setPendingAffiliation] = useState<{ orgId: string; displayName?: string } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<ReferenceItem[]>([]);
  const [myReferences, setMyReferences] = useState<ReferenceItem[]>([]);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [fulfillRelationship, setFulfillRelationship] = useState("");
  const [fulfillBody, setFulfillBody] = useState("");
  const [referenceSaving, setReferenceSaving] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const isInstructor = profile.kycLevel >= 4;

  const textPrimaryStyle = { color: colors.textPrimary };
  const textSecondaryStyle = { color: colors.textSecondary };
  const accentGoldTextStyle = { color: colors.accentGold };
  const dangerTextStyle = { color: colors.danger };
  const avatarPlaceholderStyle = { backgroundColor: colors.surface, borderColor: colors.border };
  const previewButtonBorderStyle = { borderColor: colors.accentGold };
  const affiliationChipBgStyle = { backgroundColor: colors.surfaceElevated };
  const affiliationResultRowStyle = { borderBottomColor: colors.border };
  const referenceRowStyle = { borderTopColor: colors.border };

  useEffect(() => {
    if (isEmployer) {
      return;
    }
    getIncomingRequests()
      .then(setIncomingRequests)
      .catch(() => undefined);
    getMyReferences()
      .then(setMyReferences)
      .catch(() => undefined);
    listMyAffiliationRequests()
      .then((requests) => {
        const pending = requests.find((item) => item.status === "pending");
        if (pending) {
          setPendingAffiliation({ orgId: pending.orgId });
        }
      })
      .catch(() => undefined);
  }, [isEmployer]);

  async function handleFulfill(referenceId: string) {
    if (!fulfillBody.trim()) {
      return;
    }
    setReferenceSaving(true);
    setError(null);
    try {
      await fulfillRequest(referenceId, fulfillBody.trim(), fulfillRelationship.trim() || undefined);
      setIncomingRequests((current) => current.filter((item) => item.id !== referenceId));
      setFulfillingId(null);
      setFulfillRelationship("");
      setFulfillBody("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Referans yazılamadı"));
    } finally {
      setReferenceSaving(false);
    }
  }

  async function handleToggleVisibility(reference: ReferenceItem) {
    setReferenceSaving(true);
    setError(null);
    try {
      const updated = await setReferenceVisibility(reference.id, reference.status !== "hidden");
      setMyReferences((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Görünürlük güncellenemedi"));
    } finally {
      setReferenceSaving(false);
    }
  }

  async function handleAcceptInvite() {
    if (!inviteToken.trim()) {
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await acceptInstructorInvite(inviteToken.trim());
      const refreshed = await getMe();
      onUpdated(refreshed);
      setInviteToken("");
    } catch (err) {
      setInviteError(getApiErrorMessage(err, "Davet kabul edilemedi"));
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handlePickAvatar() {
    const result = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    const contentType = asset.type === "image/png" ? "image/png" : "image/jpeg";

    setUploadingAvatar(true);
    setError(null);
    try {
      const { uploadUrl, storageKey } = await requestAvatarUploadUrl(contentType);
      await uploadFileToPresignedUrl(uploadUrl, asset.uri, contentType);
      const updated = await updateShowcase({ avatarKey: storageKey });
      onUpdated(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Fotoğraf yüklenemedi"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateShowcase({ displayName, title, bio, workplace, city, specialties });
      onUpdated(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Kaydedilemedi"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSearchAffiliation(query: string) {
    setAffiliationQuery(query);
    if (query.trim().length < 2) {
      setAffiliationResults([]);
      return;
    }
    try {
      const results = await searchOrgs(query);
      setAffiliationResults(results);
    } catch {
      // sessizce yut, kullanıcı yazmaya devam edebilir
    }
  }

  async function handleLeaveOrg() {
    setAffiliationSaving(true);
    setError(null);
    try {
      const updated = await setAffiliation(null);
      onUpdated(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Kurum bağlantısı güncellenemedi"));
    } finally {
      setAffiliationSaving(false);
    }
  }

  async function handleRequestAffiliation(org: OrgSearchResult) {
    setAffiliationSaving(true);
    setError(null);
    try {
      await requestAffiliation(org.id);
      setPendingAffiliation({ orgId: org.id, displayName: org.displayName });
      setAffiliationQuery("");
      setAffiliationResults([]);
    } catch (err) {
      setError(getApiErrorMessage(err, "İstek gönderilemedi"));
    } finally {
      setAffiliationSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploadingAvatar}>
        {profile.showcase.avatarUrl ? (
          <Image source={{ uri: profile.showcase.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, avatarPlaceholderStyle]}>
            <Text style={[styles.avatarPlaceholderText, textSecondaryStyle]}>Fotoğraf Ekle</Text>
          </View>
        )}
        {uploadingAvatar ? (
          <View style={styles.avatarOverlay}>
            <BrandSpinner size={18} />
          </View>
        ) : null}
      </TouchableOpacity>

      <Input style={styles.field} placeholder="Ad Soyad" value={displayName} onChangeText={setDisplayName} />
      <Input style={styles.field} placeholder="Unvan (örn. Diş Hekimi)" value={title} onChangeText={setTitle} />
      <Input
        style={[styles.field, styles.multiline]}
        placeholder="Kısa biyografi"
        value={bio}
        onChangeText={setBio}
        multiline
      />
      <Input style={styles.field} placeholder="Çalıştığı yer" value={workplace} onChangeText={setWorkplace} />
      {isEmployer ? (
        <>
          <Badge
            label={profile.showcase.isVerifiedOrg ? "✅ Doğrulanmış Kurum" : "⚠️ Doğrulanmamış Kurum"}
            variant={profile.showcase.isVerifiedOrg ? "success" : "warning"}
          />
          <TouchableOpacity
            style={[styles.previewButton, previewButtonBorderStyle]}
            onPress={() => setPreviewVisible(true)}
          >
            <Text style={[styles.previewButtonText, accentGoldTextStyle]}>Vitrinimi Görüntüle</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.affiliationSection}>
          <Text style={[styles.label, textPrimaryStyle]}>Bağlı olduğun kurum (opsiyonel)</Text>
          {profile.showcase.affiliatedOrg ? (
            <View style={[styles.affiliationChip, affiliationChipBgStyle]}>
              <Text style={[styles.affiliationChipText, textPrimaryStyle]}>{profile.showcase.affiliatedOrg.displayName}</Text>
              <TouchableOpacity onPress={handleLeaveOrg} disabled={affiliationSaving}>
                <Text style={[styles.affiliationChipRemove, dangerTextStyle]}>×</Text>
              </TouchableOpacity>
            </View>
          ) : pendingAffiliation ? (
            <Text style={[styles.affiliationPendingText, textSecondaryStyle]}>
              {pendingAffiliation.displayName
                ? `${pendingAffiliation.displayName} kurumuna isteğiniz gönderildi, onay bekleniyor.`
                : "Bir kuruma bağlanma isteğiniz onay bekliyor."}
            </Text>
          ) : (
            <>
              <Input
                style={styles.field}
                placeholder="Kurumunu DentSocia'da bul"
                value={affiliationQuery}
                onChangeText={handleSearchAffiliation}
              />
              {affiliationResults.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[styles.affiliationResultRow, affiliationResultRowStyle]}
                  onPress={() => handleRequestAffiliation(org)}
                  disabled={affiliationSaving}
                >
                  <Text style={[styles.affiliationResultText, textPrimaryStyle]}>{org.displayName}</Text>
                  {org.workplace ? (
                    <Text style={[styles.affiliationResultSubtext, textSecondaryStyle]}>{org.workplace}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
      <Input style={styles.field} placeholder="Şehir" value={city} onChangeText={setCity} />

      <Text style={[styles.label, textPrimaryStyle]}>Mikro-yetkinlikler</Text>
      <TagPicker selected={specialties} onChange={setSpecialties} />

      {!isEmployer && isInstructor ? <Badge label="🎓 Eğitmen" variant="gold" /> : null}

      {!isEmployer && !isInstructor ? (
        <View style={styles.inviteSection}>
          <Text style={[styles.label, textPrimaryStyle]}>Eğitmen daveti var mı?</Text>
          <Input
            style={styles.field}
            placeholder="Davet kodu"
            value={inviteToken}
            onChangeText={setInviteToken}
            autoCapitalize="none"
            error={inviteError ?? undefined}
          />
          <TouchableOpacity
            style={[styles.previewButton, previewButtonBorderStyle]}
            onPress={handleAcceptInvite}
            disabled={inviteSubmitting}
          >
            <Text style={[styles.previewButtonText, accentGoldTextStyle]}>Kabul Et</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!isEmployer ? (
        <View style={styles.referencesSection}>
          <Text style={[styles.label, textPrimaryStyle]}>Referanslarım</Text>

          {incomingRequests.length > 0 ? (
            <>
              <Text style={[styles.referencesSubLabel, textSecondaryStyle]}>Bekleyen istekler</Text>
              {incomingRequests.map((request) => (
                <View key={request.id}>
                  <View style={[styles.referenceRow, referenceRowStyle]}>
                    <Text style={[styles.referenceName, textPrimaryStyle]}>{request.counterpart.displayName}</Text>
                    {fulfillingId !== request.id ? (
                      <TouchableOpacity onPress={() => setFulfillingId(request.id)}>
                        <Text style={[styles.referenceAction, accentGoldTextStyle]}>Yaz</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {fulfillingId === request.id ? (
                    <View style={styles.fulfillForm}>
                      <Input
                        style={styles.field}
                        placeholder="İlişkiniz (opsiyonel)"
                        value={fulfillRelationship}
                        onChangeText={setFulfillRelationship}
                      />
                      <Input
                        style={[styles.field, styles.multiline]}
                        placeholder="Referans metni"
                        value={fulfillBody}
                        onChangeText={setFulfillBody}
                        multiline
                      />
                      <TouchableOpacity
                        style={[styles.previewButton, previewButtonBorderStyle]}
                        onPress={() => handleFulfill(request.id)}
                        disabled={referenceSaving}
                      >
                        <Text style={[styles.previewButtonText, accentGoldTextStyle]}>Gönder</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}

          <Text style={[styles.referencesSubLabel, textSecondaryStyle]}>Yazılmış referanslarım ({myReferences.length})</Text>
          {myReferences.length === 0 ? (
            <Text style={[styles.referencesEmptyText, textSecondaryStyle]}>Henüz bir referansın yok</Text>
          ) : (
            myReferences.map((reference) => (
              <View key={reference.id} style={[styles.referenceRow, referenceRowStyle]}>
                <View style={styles.referenceInfo}>
                  <Text style={[styles.referenceName, textPrimaryStyle]}>{reference.counterpart.displayName}</Text>
                  <Text style={[styles.referenceBody, textSecondaryStyle]}>{reference.body}</Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleVisibility(reference)} disabled={referenceSaving}>
                  <Text style={[styles.referenceAction, accentGoldTextStyle]}>
                    {reference.status === "hidden" ? "Göster" : "Gizle"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      ) : null}

      {error ? <Text style={[styles.error, dangerTextStyle]}>{error}</Text> : null}

      <Button label="Kaydet" onPress={handleSave} loading={saving} fullWidth style={styles.saveButton} />

      <OrgProfileModal visible={previewVisible} orgUserId={profile.id} onClose={() => setPreviewVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  avatarWrapper: {
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
  },
  avatarPlaceholder: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlaceholderText: {
    fontSize: typography.sizes.xs,
    textAlign: "center",
    paddingHorizontal: spacing.xs,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  previewButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  previewButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  affiliationSection: {
    marginBottom: spacing.md,
  },
  affiliationChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  affiliationChipText: {
    fontSize: typography.sizes.sm,
    marginRight: spacing.xs,
  },
  affiliationChipRemove: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  affiliationPendingText: {
    fontSize: typography.sizes.sm,
    fontStyle: "italic",
  },
  affiliationResultRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  affiliationResultText: {
    fontSize: typography.sizes.sm,
  },
  affiliationResultSubtext: {
    fontSize: typography.sizes.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  inviteSection: {
    marginTop: spacing.md,
  },
  referencesSection: {
    marginTop: spacing.lg,
  },
  referencesSubLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  referencesEmptyText: {
    fontSize: typography.sizes.sm,
  },
  referenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  referenceInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  referenceName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  referenceBody: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  referenceAction: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  fulfillForm: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  error: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});
