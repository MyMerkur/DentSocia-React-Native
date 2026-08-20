import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { getApiErrorMessage, uploadFileToPresignedUrl } from "@dentsocia/api-client";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { fontFamilies, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Badge, type BadgeVariant } from "../../../components/Badge";
import { ModalShell } from "../../../components/ModalShell";
import { Card } from "../../../components/Card";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { SkeletonRow } from "../../../components/Skeleton";
import { getMe, type UserProfile } from "../../../services/profileApi";
import {
  requestKycUploadUrl,
  confirmKycUpload,
  listKycDocuments,
  type KycDocumentItem,
  type KycDocumentType,
} from "../../../services/kycApi";

interface KycModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

const DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  kimlik: "Kimlik Belgesi",
  diploma: "Diploma",
  kurumsal_belge: "Kurumsal Belge",
};

const STATUS_LABELS: Record<KycDocumentItem["status"], string> = {
  pending: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  needs_review: "Manuel İnceleme Bekliyor",
};

const STATUS_VARIANTS: Record<KycDocumentItem["status"], BadgeVariant> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
  needs_review: "warning",
};

export function KycModal({ visible, onClose }: KycModalProps) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<KycDocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<KycDocumentType | null>(null);
  const [claimedFullName, setClaimedFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setUploadingType(null);
    setError(null);
    loadData();
  }, [visible]);

  function loadData() {
    setLoading(true);
    Promise.all([getMe(), listKycDocuments()])
      .then(([userProfile, docs]) => {
        setProfile(userProfile);
        setDocuments(docs);
      })
      .catch((err) => setError(getApiErrorMessage(err, "KYC durumu yüklenemedi")))
      .finally(() => setLoading(false));
  }

  function latestFor(documentType: KycDocumentType): KycDocumentItem | undefined {
    return documents.find((doc) => doc.documentType === documentType);
  }

  async function handleUpload(documentType: KycDocumentType) {
    if (!claimedFullName.trim()) {
      setError("Belgedeki ad soyadı gir");
      return;
    }
    const result = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }
    const contentType = asset.type === "image/png" ? "image/png" : "image/jpeg";

    setSubmitting(true);
    setError(null);
    try {
      const { uploadUrl, storageKey } = await requestKycUploadUrl(documentType, contentType);
      await uploadFileToPresignedUrl(uploadUrl, asset.uri, contentType);
      await confirmKycUpload({ documentType, storageKey, contentType, claimedFullName: claimedFullName.trim() });
      setUploadingType(null);
      loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Belge yüklenemedi"));
    } finally {
      setSubmitting(false);
    }
  }

  const isEmployer = profile ? (EMPLOYER_ROLES as readonly string[]).includes(profile.role) : false;
  const applicableTypes: KycDocumentType[] = isEmployer ? ["kimlik", "kurumsal_belge"] : ["kimlik", "diploma"];
  const kimlikApproved = latestFor("kimlik")?.status === "approved";

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Kimlik Doğrulama</Text>
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

          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Profilini doğrulamak ve platformdaki tüm özelliklere erişmek için belgelerini yükle.
          </Text>

          {applicableTypes.map((documentType) => {
            const latest = latestFor(documentType);
            const isDiplomaBlocked = documentType === "diploma" && !kimlikApproved;
            const isFormOpen = uploadingType === documentType;

            return (
              <Card key={documentType} variant="flat" style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{DOCUMENT_LABELS[documentType]}</Text>
                  {latest ? <Badge label={STATUS_LABELS[latest.status]} variant={STATUS_VARIANTS[latest.status]} /> : null}
                </View>

                {isDiplomaBlocked ? (
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    Diploma yüklemeden önce kimlik belgen onaylanmalı.
                  </Text>
                ) : !isFormOpen ? (
                  <Button
                    label={latest ? "Yeniden Yükle" : "Belge Yükle"}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setError(null);
                      setUploadingType(documentType);
                    }}
                    style={styles.secondaryButton}
                  />
                ) : (
                  <View style={styles.uploadForm}>
                    <Input
                      style={styles.field}
                      placeholder="Belgedeki ad soyad"
                      value={claimedFullName}
                      onChangeText={setClaimedFullName}
                    />
                    <Button
                      label="Fotoğraf Seç ve Yükle"
                      variant="gold"
                      fullWidth
                      loading={submitting}
                      onPress={() => handleUpload(documentType)}
                      style={styles.field}
                    />
                    <TouchableOpacity onPress={() => setUploadingType(null)} disabled={submitting}>
                      <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Vazgeç</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          })}
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
    fontFamily: fontFamilies.semibold,
  },
  loaderStack: {
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  introText: {
    ...typographyPresets.body,
    marginBottom: spacing.lg,
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
  },
  cardTitle: {
    ...typographyPresets.h2,
  },
  hint: {
    ...typographyPresets.body,
  },
  secondaryButton: {
    alignSelf: "flex-start",
  },
  uploadForm: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  field: {
    marginBottom: 0,
  },
  cancelText: {
    fontSize: 12,
    textAlign: "center",
  },
});
