import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import {
  getInstagramStatus,
  listInstagramMedia,
  disconnectInstagram,
  type InstagramMediaItem,
} from "../../../services/instagramApi";
import { InstagramConnectWebView } from "./InstagramConnectWebView";

interface InstagramImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (media: { mediaUrl: string; caption: string }) => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

export function InstagramImportModal({ visible, onClose, onSelect }: InstagramImportModalProps) {
  const { colors } = useTheme();
  const titleStyle = { color: colors.textPrimary };
  const closeTextStyle = { color: colors.accentGold };
  const errorStyle = { color: colors.danger };
  const disconnectLinkStyle = { color: colors.danger };
  const mediaThumbnailStyle = { backgroundColor: colors.surfaceElevated };
  const mediaCaptionStyle = { color: colors.textSecondary };
  const [connected, setConnected] = useState<boolean | null>(null);
  const [media, setMedia] = useState<InstagramMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setConnecting(false);
    loadStatus();
  }, [visible]);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const status = await getInstagramStatus();
      setConnected(status.connected);
      if (status.connected) {
        const items = await listInstagramMedia();
        setMedia(items);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Instagram durumu yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }

  function handleConnectDone(result: "success" | "cancelled") {
    setConnecting(false);
    if (result === "success") {
      loadStatus();
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectInstagram();
      setConnected(false);
      setMedia([]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Bağlantı kaldırılamadı"));
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, titleStyle]}>Instagram'dan İçe Aktar</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, closeTextStyle]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {connecting ? (
            <InstagramConnectWebView onDone={handleConnectDone} />
          ) : loading ? (
            <View style={styles.loader}><BrandSpinner /></View>
          ) : (
            <View style={styles.content}>
              {error ? <Text style={[styles.error, errorStyle]}>{error}</Text> : null}

              {connected === false ? (
                <Button label="Instagram Hesabını Bağla" onPress={() => setConnecting(true)} fullWidth />
              ) : null}

              {connected === true ? (
                <>
                  <TouchableOpacity onPress={handleDisconnect} disabled={disconnecting}>
                    <Text style={[styles.disconnectLink, disconnectLinkStyle]}>
                      {disconnecting ? "Kaldırılıyor…" : "Bağlantıyı Kaldır"}
                    </Text>
                  </TouchableOpacity>
                  <ScrollView contentContainerStyle={styles.mediaGrid}>
                    {media.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.mediaItem}
                        onPress={() => onSelect({ mediaUrl: item.mediaUrl, caption: item.caption })}
                      >
                        <Image source={{ uri: item.mediaUrl }} style={[styles.mediaThumbnail, mediaThumbnailStyle]} />
                        {item.caption ? (
                          <Text style={[styles.mediaCaption, mediaCaptionStyle]} numberOfLines={2}>
                            {item.caption}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </View>
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
  loader: {
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  content: {
    paddingBottom: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  disconnectLink: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  mediaItem: {
    width: 100,
  },
  mediaThumbnail: {
    width: 100,
    height: 100,
    borderRadius: radii.sm,
  },
  mediaCaption: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
});
