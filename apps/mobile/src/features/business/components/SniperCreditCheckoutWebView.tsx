import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import axios from "axios";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { startSniperCreditCheckout, getSniperCreditBalance } from "../../../services/sniperApi";
import type { BillingInfoInput } from "../../../services/subscriptionApi";

interface SniperCreditCheckoutWebViewProps {
  startingBalance: number;
  onDone: (result: "success" | "cancelled") => void;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

export function SniperCreditCheckoutWebView({ startingBalance, onDone }: SniperCreditCheckoutWebViewProps) {
  const { colors } = useTheme();
  const [checkoutFormContent, setCheckoutFormContent] = useState<string | null>(null);
  const [needsBillingInfo, setNeedsBillingInfo] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfoInput>({});
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    attemptCheckout({});
  }, []);

  async function attemptCheckout(fields: BillingInfoInput) {
    setLoading(true);
    setError(null);
    try {
      const session = await startSniperCreditCheckout(fields);
      setCheckoutFormContent(session.checkoutFormContent);
      setNeedsBillingInfo(false);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setNeedsBillingInfo(true);
      } else {
        setError(getApiErrorMessage(err, "Kredi satın alma başlatılamadı"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function pollForCompletion() {
    setConfirming(true);
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        const { balance } = await getSniperCreditBalance();
        if (balance > startingBalance) {
          onDone("success");
          return;
        }
      } catch {
        // sessizce yut, sıradaki denemede tekrar sorulacak
      }
    }
    setConfirming(false);
    setError("Ödeme durumu doğrulanamadı, lütfen tekrar deneyin");
  }

  if (needsBillingInfo) {
    return (
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Fatura Bilgileri</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Bu bilgiler bir kere istenir, sonraki satın alımlarda tekrar sorulmaz.
        </Text>
        <Input
          style={styles.field}
          placeholder="TC Kimlik No"
          keyboardType="number-pad"
          maxLength={11}
          value={billingInfo.identityNumber ?? ""}
          onChangeText={(value) => setBillingInfo((current) => ({ ...current, identityNumber: value }))}
        />
        <Input
          style={styles.field}
          placeholder="Telefon"
          keyboardType="phone-pad"
          value={billingInfo.phone ?? ""}
          onChangeText={(value) => setBillingInfo((current) => ({ ...current, phone: value }))}
        />
        <Input
          style={styles.field}
          placeholder="Adres"
          value={billingInfo.address ?? ""}
          onChangeText={(value) => setBillingInfo((current) => ({ ...current, address: value }))}
        />
        <Input
          style={styles.field}
          placeholder="Şehir"
          value={billingInfo.city ?? ""}
          onChangeText={(value) => setBillingInfo((current) => ({ ...current, city: value }))}
        />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Button label="Devam Et" onPress={() => attemptCheckout(billingInfo)} loading={loading} fullWidth style={styles.actionButton} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <BrandSpinner />
      </View>
    );
  }

  if (confirming) {
    return (
      <View style={styles.centered}>
        <BrandSpinner />
        <Text style={[styles.confirmingText, { color: colors.textSecondary }]}>Ödeme sonucu doğrulanıyor…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        <Button label="Kapat" onPress={() => onDone("cancelled")} style={styles.actionButton} />
      </View>
    );
  }

  if (!checkoutFormContent) {
    return null;
  }

  return (
    <View style={styles.webviewContainer}>
      <WebView
        source={{ html: checkoutFormContent }}
        onNavigationStateChange={(navState) => {
          if (navState.url.includes("/payments/iyzico/sniper-credit-callback")) {
            pollForCompletion();
          }
        }}
      />
      <Button label="Ödemeyi tamamladım" onPress={pollForCompletion} fullWidth style={styles.manualConfirmButton} />
      <TouchableOpacity style={styles.cancelLink} onPress={() => onDone("cancelled")}>
        <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Vazgeç</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
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
  manualConfirmButton: {
    margin: spacing.md,
  },
  cancelLink: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cancelLinkText: {
    fontSize: typography.sizes.sm,
  },
});
