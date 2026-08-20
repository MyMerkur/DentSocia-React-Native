import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { ModalShell } from "../../../components/ModalShell";
import { Button } from "../../../components/Button";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { getJobCreditBalance } from "../../../services/jobCreditApi";
import { getSniperCreditBalance } from "../../../services/sniperApi";
import { getSubscriptionStatus, cancelSubscription, type SubscriptionSummary } from "../../../services/subscriptionApi";
import {
  listAffiliationRequests,
  approveAffiliationRequest,
  rejectAffiliationRequest,
  type PendingAffiliationRequest,
} from "../../../services/orgApi";
import { useAuthStore } from "../../../store/useAuthStore";
import { CheckoutWebView } from "../../subscription/components/CheckoutWebView";
import { JobCreditCheckoutWebView } from "./JobCreditCheckoutWebView";
import { SniperCreditCheckoutWebView } from "./SniperCreditCheckoutWebView";
import { SniperSearchModal } from "./SniperSearchModal";

interface BusinessModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

const PLAN_CODE = "clinic_premium_monthly";

const STATUS_LABELS: Record<SubscriptionSummary["status"], string> = {
  none: "Aboneliğiniz yok",
  pending_checkout: "Ödeme bekleniyor",
  active: "Aktif",
  past_due: "Ödeme sorunu",
  canceled: "İptal edildi",
  expired: "Süresi doldu",
};

export function BusinessModal({ visible, onClose }: BusinessModalProps) {
  const { colors } = useTheme();
  const [balance, setBalance] = useState<number | null>(null);
  const [sniperBalance, setSniperBalance] = useState<number | null>(null);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [creditCheckoutVisible, setCreditCheckoutVisible] = useState(false);
  const [sniperCreditCheckoutVisible, setSniperCreditCheckoutVisible] = useState(false);
  const [sniperSearchVisible, setSniperSearchVisible] = useState(false);
  const [subscriptionCheckoutVisible, setSubscriptionCheckoutVisible] = useState(false);
  const [affiliationRequests, setAffiliationRequests] = useState<PendingAffiliationRequest[]>([]);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orgId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setCreditCheckoutVisible(false);
    setSniperCreditCheckoutVisible(false);
    setSubscriptionCheckoutVisible(false);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orgId is stable for the session
  }, [visible]);

  function loadData() {
    if (!orgId) {
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getJobCreditBalance(),
      getSniperCreditBalance(),
      getSubscriptionStatus(),
      listAffiliationRequests(orgId),
    ])
      .then(([creditResult, sniperCreditResult, subscriptionResult, requests]) => {
        setBalance(creditResult.balance);
        setSniperBalance(sniperCreditResult.balance);
        setSummary(subscriptionResult);
        setAffiliationRequests(requests);
      })
      .catch((err) => setError(getApiErrorMessage(err, "Yüklenemedi")))
      .finally(() => setLoading(false));
  }

  async function handleApproveAffiliation(requestId: string) {
    if (!orgId) {
      return;
    }
    setRespondingRequestId(requestId);
    setError(null);
    try {
      await approveAffiliationRequest(orgId, requestId);
      setAffiliationRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (err) {
      setError(getApiErrorMessage(err, "İstek onaylanamadı"));
    } finally {
      setRespondingRequestId(null);
    }
  }

  async function handleRejectAffiliation(requestId: string) {
    if (!orgId) {
      return;
    }
    setRespondingRequestId(requestId);
    setError(null);
    try {
      await rejectAffiliationRequest(orgId, requestId);
      setAffiliationRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (err) {
      setError(getApiErrorMessage(err, "İstek reddedilemedi"));
    } finally {
      setRespondingRequestId(null);
    }
  }

  async function handleCancelSubscription() {
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

  function handleCreditCheckoutDone(result: "success" | "cancelled") {
    setCreditCheckoutVisible(false);
    if (result === "success") {
      loadData();
    }
  }

  function handleSniperCreditCheckoutDone(result: "success" | "cancelled") {
    setSniperCreditCheckoutVisible(false);
    if (result === "success") {
      loadData();
    }
  }

  function handleSubscriptionCheckoutDone(result: "success" | "cancelled") {
    setSubscriptionCheckoutVisible(false);
    if (result === "success") {
      loadData();
    }
  }

  return (
    <>
      <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>💼 İşletme</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {creditCheckoutVisible ? (
            <JobCreditCheckoutWebView startingBalance={balance ?? 0} onDone={handleCreditCheckoutDone} />
          ) : sniperCreditCheckoutVisible ? (
            <SniperCreditCheckoutWebView startingBalance={sniperBalance ?? 0} onDone={handleSniperCreditCheckoutDone} />
          ) : subscriptionCheckoutVisible ? (
            <CheckoutWebView planCode={PLAN_CODE} onDone={handleSubscriptionCheckoutDone} />
          ) : loading ? (
            <View style={styles.loader}>
              <BrandSpinner />
            </View>
          ) : (
            <View style={styles.content}>
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Aidiyet İstekleri</Text>
              {affiliationRequests.length === 0 ? (
                <Text style={[styles.balanceText, { color: colors.textSecondary }]}>Bekleyen istek yok.</Text>
              ) : (
                affiliationRequests.map((request) => (
                  <View
                    key={request.id}
                    style={[styles.affiliationRequestRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.affiliationRequestName, { color: colors.textPrimary }]}>
                      {request.applicant.displayName}
                    </Text>
                    <View style={styles.affiliationRequestActions}>
                      <Button
                        label="Onayla"
                        size="sm"
                        onPress={() => handleApproveAffiliation(request.id)}
                        disabled={respondingRequestId === request.id}
                      />
                      <Button
                        label="Reddet"
                        size="sm"
                        variant="danger"
                        onPress={() => handleRejectAffiliation(request.id)}
                        disabled={respondingRequestId === request.id}
                      />
                    </View>
                  </View>
                ))
              )}

              <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textPrimary }]}>
                İlan Kredisi
              </Text>
              <Text style={[styles.balanceText, { color: colors.textSecondary }]}>Bakiye: {balance ?? 0} kredi</Text>
              <Button label="1 Kredi Satın Al" onPress={() => setCreditCheckoutVisible(true)} fullWidth />

              <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textPrimary }]}>
                Keskin Nişancı Kredisi
              </Text>
              <Text style={[styles.balanceText, { color: colors.textSecondary }]}>
                Bakiye: {sniperBalance ?? 0} kredi
              </Text>
              <Button label="1 Kredi Satın Al" onPress={() => setSniperCreditCheckoutVisible(true)} fullWidth />
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.accentGold }]}
                onPress={() => setSniperSearchVisible(true)}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.accentGold }]}>Aday Ara</Text>
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, styles.sectionSpacing, { color: colors.textPrimary }]}>
                Premium Abonelik
              </Text>
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
                      variant="danger"
                      onPress={handleCancelSubscription}
                      loading={canceling}
                      fullWidth
                      style={styles.dangerButtonSpacing}
                    />
                  ) : (
                    <Button label="Premium Abone Ol" onPress={() => setSubscriptionCheckoutVisible(true)} fullWidth />
                  )}
                </>
              ) : null}
            </View>
          )}
      </ModalShell>
      <SniperSearchModal visible={sniperSearchVisible} onClose={() => setSniperSearchVisible(false)} />
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
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  sectionSpacing: {
    marginTop: spacing.lg,
  },
  balanceText: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  statusLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  periodText: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.sm,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  dangerButtonSpacing: {
    marginTop: spacing.md,
  },
  affiliationRequestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  affiliationRequestName: {
    fontSize: typography.sizes.sm,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  affiliationRequestActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
});
