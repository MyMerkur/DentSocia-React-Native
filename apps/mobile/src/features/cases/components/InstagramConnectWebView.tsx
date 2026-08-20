import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { getConnectAuthorizeUrl, getInstagramStatus } from "../../../services/instagramApi";

interface InstagramConnectWebViewProps {
  onDone: (result: "success" | "cancelled") => void;
}

export function InstagramConnectWebView({ onDone }: InstagramConnectWebViewProps) {
  const { colors } = useTheme();
  const confirmingTextStyle = { color: colors.textSecondary };
  const errorStyle = { color: colors.danger };
  const cancelLinkTextStyle = { color: colors.textSecondary };
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConnectAuthorizeUrl()
      .then(setAuthorizeUrl)
      .catch((err) => setError(getApiErrorMessage(err, "Instagram bağlantısı başlatılamadı")))
      .finally(() => setLoading(false));
  }, []);

  async function confirmConnection() {
    setConfirming(true);
    try {
      const status = await getInstagramStatus();
      if (status.connected) {
        onDone("success");
        return;
      }
      setError("Bağlantı doğrulanamadı, lütfen tekrar dene");
    } catch (err) {
      setError(getApiErrorMessage(err, "Bağlantı doğrulanamadı"));
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandSpinner />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.error, errorStyle]}>{error}</Text>
        <Button label="Kapat" onPress={() => onDone("cancelled")} style={styles.actionButton} />
      </View>
    );
  }

  if (confirming) {
    return (
      <View style={styles.centered}>
        <BrandSpinner />
        <Text style={[styles.confirmingText, confirmingTextStyle]}>Bağlantı doğrulanıyor…</Text>
      </View>
    );
  }

  if (!authorizeUrl) {
    return null;
  }

  return (
    <View style={styles.webviewContainer}>
      <WebView
        source={{ uri: authorizeUrl }}
        onNavigationStateChange={(navState) => {
          if (navState.url.includes("/instagram/oauth/callback")) {
            confirmConnection();
          }
        }}
      />
      <TouchableOpacity style={styles.cancelLink} onPress={() => onDone("cancelled")}>
        <Text style={[styles.cancelLinkText, cancelLinkTextStyle]}>Vazgeç</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
  confirmingText: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  webviewContainer: {
    height: 480,
  },
  cancelLink: {
    alignItems: "center",
    marginVertical: spacing.md,
  },
  cancelLinkText: {
    fontSize: typography.sizes.sm,
  },
});
