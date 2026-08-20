import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { UserSearch } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import type { MicroCompetencyTag } from "@dentsocia/shared-constants";
import { fontFamilies, radii, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import {
  searchCandidates,
  unlockCandidate,
  getSniperCreditBalance,
  type SniperCandidate,
} from "../../../services/sniperApi";
import { ModalShell } from "../../../components/ModalShell";
import { TagPicker } from "../../../components/TagPicker";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { LockIcon } from "../../../components/icons";
import { InboxModal } from "../../inbox/components/InboxModal";
import { SniperCreditCheckoutWebView } from "./SniperCreditCheckoutWebView";

interface SniperSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const SHEET_HEIGHT: ViewStyle = { maxHeight: "85%" };

export function SniperSearchModal({ visible, onClose }: SniperSearchModalProps) {
  const { colors } = useTheme();
  const [balance, setBalance] = useState(0);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [messagingCandidateId, setMessagingCandidateId] = useState<string | null>(null);

  const [specialties, setSpecialties] = useState<MicroCompetencyTag[]>([]);
  const [city, setCity] = useState("");
  const [minExperienceYears, setMinExperienceYears] = useState("");
  const [maxExperienceYears, setMaxExperienceYears] = useState("");

  const [results, setResults] = useState<SniperCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setCheckoutVisible(false);
    setMessagingCandidateId(null);
    loadBalance();
  }, [visible]);

  function loadBalance() {
    getSniperCreditBalance()
      .then(({ balance: value }) => setBalance(value))
      .catch(() => undefined);
  }

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const items = await searchCandidates({
        specialties,
        city: city.trim() || undefined,
        minExperienceYears: minExperienceYears ? Number(minExperienceYears) : undefined,
        maxExperienceYears: maxExperienceYears ? Number(maxExperienceYears) : undefined,
      });
      setResults(items);
    } catch (err) {
      setError(getApiErrorMessage(err, "Arama yapılamadı"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock(candidateId: string) {
    setUnlockingId(candidateId);
    setError(null);
    try {
      const result = await unlockCandidate(candidateId);
      setResults((current) => current.map((item) => (item.candidateId === candidateId ? result.candidate : item)));
      loadBalance();
    } catch (err) {
      setError(getApiErrorMessage(err, "Aday açılamadı"));
    } finally {
      setUnlockingId(null);
    }
  }

  function handleCreditCheckoutDone(result: "success" | "cancelled") {
    setCheckoutVisible(false);
    if (result === "success") {
      loadBalance();
    }
  }

  if (messagingCandidateId) {
    return (
      <InboxModal
        visible={visible}
        onClose={() => setMessagingCandidateId(null)}
        startTarget={{ userId: messagingCandidateId }}
      />
    );
  }

  return (
    <ModalShell visible={visible} onClose={onClose} variant="sheet" contentStyle={SHEET_HEIGHT}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>🎯 Keskin Nişancı</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeText, { color: colors.accentGold }]}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {checkoutVisible ? (
            <SniperCreditCheckoutWebView startingBalance={balance} onDone={handleCreditCheckoutDone} />
          ) : (
            <ScrollView>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceText, { color: colors.textPrimary }]}>Kredi bakiyesi: {balance}</Text>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.accentGold }]}
                  onPress={() => setCheckoutVisible(true)}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.accentGold }]}>1 Kredi Satın Al</Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Uzmanlık</Text>
              <TagPicker selected={specialties} onChange={setSpecialties} />
              <Input style={styles.field} placeholder="Şehir (opsiyonel)" value={city} onChangeText={setCity} />
              <View style={styles.rangeRow}>
                <Input
                  style={[styles.field, styles.rangeInput]}
                  placeholder="Min. deneyim (yıl)"
                  keyboardType="number-pad"
                  value={minExperienceYears}
                  onChangeText={setMinExperienceYears}
                />
                <Input
                  style={[styles.field, styles.rangeInput]}
                  placeholder="Maks. deneyim (yıl)"
                  keyboardType="number-pad"
                  value={maxExperienceYears}
                  onChangeText={setMaxExperienceYears}
                />
              </View>
              <Button label="Ara" onPress={handleSearch} loading={loading} fullWidth style={styles.searchButton} />

              {searched && !loading ? (
                results.length === 0 ? (
                  <EmptyState icon={UserSearch} title="Kriterlere uyan aday bulunamadı" />
                ) : (
                  results.map((candidate) => (
                    <Card key={candidate.candidateId} variant="elevated" style={styles.card}>
                      <View style={styles.cardTitleRow}>
                        {!candidate.unlocked ? <LockIcon size={14} color={colors.accentGold} /> : null}
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                          {candidate.unlocked ? candidate.displayName : "Gizli Aday"}
                        </Text>
                      </View>
                      <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                        {candidate.specialties.join(", ") || "Uzmanlık belirtilmemiş"}
                      </Text>
                      <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                        {candidate.city || "Şehir belirtilmemiş"}
                        {candidate.experienceYears !== null ? ` · ${candidate.experienceYears} yıl deneyim` : ""}
                      </Text>
                      {candidate.unlocked ? (
                        <Button
                          label="Mesaj Gönder"
                          onPress={() => setMessagingCandidateId(candidate.candidateId)}
                          fullWidth
                          style={styles.cardButton}
                        />
                      ) : (
                        <Button
                          label="Kredi ile Aç (1 kredi)"
                          onPress={() => handleUnlock(candidate.candidateId)}
                          loading={unlockingId === candidate.candidateId}
                          fullWidth
                          style={styles.cardButton}
                        />
                      )}
                    </Card>
                  ))
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
    ...typographyPresets.h1,
  },
  closeText: {
    fontSize: 13.5,
    fontFamily: fontFamilies.semibold,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  balanceText: {
    ...typographyPresets.bodyLarge,
  },
  secondaryButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
  },
  sectionTitle: {
    ...typographyPresets.label,
    marginBottom: spacing.xs,
  },
  field: {
    marginTop: spacing.sm,
  },
  rangeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rangeInput: {
    flex: 1,
  },
  searchButton: {
    marginTop: spacing.sm,
  },
  error: {
    marginBottom: spacing.sm,
  },
  card: {
    marginTop: spacing.md,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cardTitle: {
    ...typographyPresets.h2,
  },
  cardSubtitle: {
    ...typographyPresets.bodySmall,
    marginTop: spacing.xs,
  },
  cardBody: {
    ...typographyPresets.bodySmall,
    marginTop: spacing.xs,
  },
  cardButton: {
    marginTop: spacing.sm,
  },
});
