import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { fontFamilies, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { getSubscriptionStatus, cancelSubscription, type SubscriptionSummary } from "../../../services/subscriptionApi";
import { CheckoutWebView } from "./CheckoutWebView";

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

const PLAN_CODE = "teaser_monthly";

const STATUS_LABELS: Record<SubscriptionSummary["status"], string> = {
  none: "Aboneliğiniz yok",
  pending_checkout: "Ödeme bekleniyor",
  active: "Aktif",
  past_due: "Ödeme sorunu",
  canceled: "İptal edildi",
  expired: "Süresi doldu",
};

export function SubscriptionModal({ visible, onClose }: SubscriptionModalProps) {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setCheckoutVisible(false);
    loadStatus();
  }, [visible]);

  function loadStatus() {
    setLoading(true);
    setError(null);
    getSubscriptionStatus()
      .then(setSummary)
      .catch((err) => setError(getApiErrorMessage(err, "Abonelik durumu yüklenemedi")))
      .finally(() => setLoading(false));
  }

  async function handleCancel() {
    setCanceling(true);
    setError(null);
    try {
      const updated = await cancelSubscription();
      setSummary(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Abonelik iptal edilemedi"));
    } finally {
      setCanceling(false);
    }
  }

  function handleCheckoutDone(result: "success" | "cancelled") {
    setCheckoutVisible(false);
    if (result === "success") {
      loadStatus();
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Aboneliğim</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {checkoutVisible ? (
            <CheckoutWebView planCode={PLAN_CODE} onDone={handleCheckoutDone} />
          ) : loading ? (
            <View style={styles.loader}>
              <BrandSpinner />
            </View>
          ) : (
            <View style={styles.content}>
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

              {summary ? (
                <>
                  <Text style={[styles.statusLabel, { color: colors.textPrimary }]}>
                    {STATUS_LABELS[summary.status]}
                  </Text>
                  {summary.status === "active" && summary.currentPeriodEnd ? (
                    <Text style={[styles.periodText, { color: colors.textSecondary }]}>
                      Yenilenme tarihi: {new Date(summary.currentPeriodEnd).toLocaleDateString("tr-TR")}
                    </Text>
                  ) : null}

                  {summary.status === "active" ? (
                    <Button
                      label="İptal Et"
                      onPress={handleCancel}
                      loading={canceling}
                      variant="danger"
                      fullWidth
                      style={styles.actionButton}
                    />
                  ) : (
                    <Button
                      label="Abone Ol"
                      onPress={() => setCheckoutVisible(true)}
                      fullWidth
                      style={styles.actionButton}
                    />
                  )}
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
    ...typographyPresets.h1,
  },
  closeText: {
    fontSize: 13.5,
    fontFamily: fontFamilies.semibold,
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
  statusLabel: {
    ...typographyPresets.h1,
    marginBottom: spacing.xs,
  },
  periodText: {
    ...typographyPresets.bodySmall,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginTop: spacing.md,
  },
});
