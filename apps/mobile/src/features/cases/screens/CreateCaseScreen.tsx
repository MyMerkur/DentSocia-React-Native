import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { getApiErrorMessage, uploadFileToPresignedUrl } from "@dentsocia/api-client";
import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { BrandSpinner } from "../../../components/BrandSpinner";
import {
  createCase,
  requestImageUploadUrl,
  generateCaseDraft,
  type CaseImageInput,
  type CaseStage,
} from "../../../services/caseApi";
import { TagPicker } from "../../../components/TagPicker";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { InstagramImportModal } from "../components/InstagramImportModal";

const STAGES: { key: CaseStage; label: string }[] = [
  { key: "before", label: "Öncesi" },
  { key: "during", label: "Orta" },
  { key: "after", label: "Sonrası" },
];

export function CreateCaseScreen() {
  const { colors } = useTheme();
  const thumbnailStyle = { backgroundColor: colors.surfaceElevated };
  const removeBadgeStyle = { backgroundColor: colors.danger };
  const removeBadgeTextStyle = { color: colors.textPrimary };
  const addThumbnailButtonStyle = { borderColor: colors.border };
  const addThumbnailTextStyle = { color: colors.textSecondary };
  const errorStyle = { color: colors.danger };
  const successStyle = { color: colors.success };
  const labelStyle = { color: colors.textPrimary };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [specialties, setSpecialties] = useState<MicroCompetencyTag[]>([]);
  const [images, setImages] = useState<(CaseImageInput & { previewUri: string })[]>([]);
  const [uploadingStage, setUploadingStage] = useState<CaseStage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [captionText, setCaptionText] = useState("");
  const [draftSourceImages, setDraftSourceImages] = useState<(CaseImageInput & { previewUri: string })[]>([]);
  const [uploadingDraftImage, setUploadingDraftImage] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [instagramModalVisible, setInstagramModalVisible] = useState(false);

  async function handleSelectInstagramMedia(media: { mediaUrl: string; caption: string }) {
    setInstagramModalVisible(false);
    setUploadingDraftImage(true);
    setDraftError(null);
    try {
      const { uploadUrl, storageKey } = await requestImageUploadUrl("image/jpeg");
      await uploadFileToPresignedUrl(uploadUrl, media.mediaUrl, "image/jpeg");
      setDraftSourceImages((current) => [...current, { storageKey, stage: "before", previewUri: media.mediaUrl }]);
      if (!captionText && media.caption) {
        setCaptionText(media.caption);
      }
    } catch (err) {
      setDraftError(getApiErrorMessage(err, "Instagram fotoğrafı yüklenemedi"));
    } finally {
      setUploadingDraftImage(false);
    }
  }

  async function handleAddDraftSourceImage() {
    const result = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    const contentType = asset.type === "image/png" ? "image/png" : "image/jpeg";

    setUploadingDraftImage(true);
    setDraftError(null);
    try {
      const { uploadUrl, storageKey } = await requestImageUploadUrl(contentType);
      await uploadFileToPresignedUrl(uploadUrl, asset.uri, contentType);
      setDraftSourceImages((current) => [...current, { storageKey, stage: "before", previewUri: asset.uri! }]);
    } catch (err) {
      setDraftError(getApiErrorMessage(err, "Fotoğraf yüklenemedi"));
    } finally {
      setUploadingDraftImage(false);
    }
  }

  function handleRemoveDraftSourceImage(index: number) {
    setDraftSourceImages((current) => current.filter((_, i) => i !== index));
  }

  async function handleGenerateDraft() {
    setGeneratingDraft(true);
    setDraftError(null);
    try {
      const draft = await generateCaseDraft({
        storageKeys: draftSourceImages.map((image) => image.storageKey),
        captionText: captionText || undefined,
      });
      setTitle(draft.title);
      setDescription(draft.description);
      setSpecialties(draft.specialties);
      setImages((current) => [...current, ...draftSourceImages]);
      setDraftSourceImages([]);
      setCaptionText("");
      setSuccessMessage("Taslak oluşturuldu, düzenleyip paylaşabilirsin.");
    } catch (err) {
      setDraftError(getApiErrorMessage(err, "Taslak oluşturulamadı"));
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function handleAddImage(stage: CaseStage) {
    const result = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return;
    }

    const contentType = asset.type === "image/png" ? "image/png" : "image/jpeg";

    setUploadingStage(stage);
    setError(null);
    try {
      const { uploadUrl, storageKey } = await requestImageUploadUrl(contentType);
      await uploadFileToPresignedUrl(uploadUrl, asset.uri, contentType);
      setImages((current) => [...current, { storageKey, stage, previewUri: asset.uri! }]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Fotoğraf yüklenemedi"));
    } finally {
      setUploadingStage(null);
    }
  }

  function handleRemoveImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await createCase({
        title,
        description: description || undefined,
        specialties,
        images: images.map(({ storageKey, stage }) => ({ storageKey, stage })),
      });
      setTitle("");
      setDescription("");
      setSpecialties([]);
      setImages([]);
      setSuccessMessage("Vaka paylaşıldı. Ana akıştan görebilirsin.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Vaka paylaşılamadı"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.aiDraftSection}>
          <Text style={[styles.label, labelStyle]}>🤖 Instagram Gönderisinden Taslak Oluştur (Eğitmen)</Text>
          <Input
            style={[styles.field, styles.multiline]}
            placeholder="Instagram açıklaması (opsiyonel)"
            value={captionText}
            onChangeText={setCaptionText}
            multiline
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {draftSourceImages.map((image, index) => (
              <View key={image.storageKey} style={styles.thumbnailWrapper}>
                <Image source={{ uri: image.previewUri }} style={[styles.thumbnail, thumbnailStyle]} />
                <TouchableOpacity style={[styles.removeBadge, removeBadgeStyle]} onPress={() => handleRemoveDraftSourceImage(index)}>
                  <Text style={[styles.removeBadgeText, removeBadgeTextStyle]}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.addThumbnailButton, addThumbnailButtonStyle]}
              onPress={handleAddDraftSourceImage}
              disabled={uploadingDraftImage}
            >
              {uploadingDraftImage ? (
                <BrandSpinner size={16} />
              ) : (
                <Text style={[styles.addThumbnailText, addThumbnailTextStyle]}>+ Ekle</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addThumbnailButton, addThumbnailButtonStyle]}
              onPress={() => setInstagramModalVisible(true)}
              disabled={uploadingDraftImage}
            >
              <Text style={[styles.addThumbnailText, addThumbnailTextStyle]}>📷 Instagram</Text>
            </TouchableOpacity>
          </ScrollView>
          {draftError ? <Text style={[styles.error, errorStyle]}>{draftError}</Text> : null}
          <Button
            label="Taslak Oluştur"
            onPress={handleGenerateDraft}
            loading={generatingDraft}
            disabled={draftSourceImages.length === 0}
            fullWidth
            style={styles.draftButton}
          />
        </Card>

        <Input style={styles.field} placeholder="Vaka başlığı" value={title} onChangeText={setTitle} />
        <Input
          style={[styles.field, styles.multiline]}
          placeholder="Açıklama"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={[styles.label, labelStyle]}>İlgili yetkinlikler</Text>
        <TagPicker selected={specialties} onChange={setSpecialties} />

        {STAGES.map((stage) => (
          <View key={stage.key} style={styles.stageSection}>
            <Text style={[styles.label, labelStyle]}>{stage.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
              {images
                .map((image, index) => ({ image, index }))
                .filter(({ image }) => image.stage === stage.key)
                .map(({ image, index }) => (
                  <View key={image.storageKey} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: image.previewUri }} style={[styles.thumbnail, thumbnailStyle]} />
                    <TouchableOpacity style={[styles.removeBadge, removeBadgeStyle]} onPress={() => handleRemoveImage(index)}>
                      <Text style={[styles.removeBadgeText, removeBadgeTextStyle]}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              <TouchableOpacity
                style={[styles.addThumbnailButton, addThumbnailButtonStyle]}
                onPress={() => handleAddImage(stage.key)}
                disabled={uploadingStage !== null}
              >
                {uploadingStage === stage.key ? (
                  <BrandSpinner size={16} />
                ) : (
                  <Text style={[styles.addThumbnailText, addThumbnailTextStyle]}>+ Ekle</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        ))}

        {error ? <Text style={[styles.error, errorStyle]}>{error}</Text> : null}
        {successMessage ? <Text style={[styles.success, successStyle]}>{successMessage}</Text> : null}

        <Button label="Paylaş" onPress={handleSubmit} loading={submitting} fullWidth style={styles.submitButton} />
      </ScrollView>
      <InstagramImportModal
        visible={instagramModalVisible}
        onClose={() => setInstagramModalVisible(false)}
        onSelect={handleSelectInstagramMedia}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  aiDraftSection: {
    marginBottom: spacing.lg,
  },
  draftButton: {
    marginTop: spacing.sm,
  },
  field: {
    marginBottom: spacing.md,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  stageSection: {
    marginTop: spacing.md,
  },
  thumbnailRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  thumbnailWrapper: {
    position: "relative",
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBadgeText: {
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm,
  },
  addThumbnailButton: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addThumbnailText: {
    fontSize: typography.sizes.xs,
  },
  error: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
  success: {
    marginTop: spacing.lg,
    textAlign: "center",
  },
  submitButton: {
    marginTop: spacing.lg,
  },
});
