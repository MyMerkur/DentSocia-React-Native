import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { fontFamilies, spacing, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Input } from "../../../components/Input";
import { Badge } from "../../../components/Badge";
import { Avatar } from "../../../components/Avatar";
import { EmptyState } from "../../../components/EmptyState";
import { Skeleton, SkeletonRow } from "../../../components/Skeleton";
import { ModalShell } from "../../../components/ModalShell";
import { LockedCard } from "../../../components/LockedCard";
import { JobCard } from "../../../components/JobCard";
import { HeartButton } from "../../../components/HeartButton";
import { StepsIndicator } from "../../../components/StepsIndicator";
import { ResultCard } from "../../../components/ResultCard";
import { LockIcon, DocumentIcon, CardIcon, HeartIcon } from "../../../components/icons";

// Dev-only visual QA screen for the Faz 5 primitive library (#58) — not part of any
// user-facing flow. Reachable from ProfileScreen's "🎨 Tasarım" button when __DEV__.
export function DesignPreviewScreen() {
  const { colors, scheme } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [centerVisible, setCenterVisible] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.schemeLabel, { color: colors.accentGold }]}>Aktif tema: {scheme}</Text>

      <Section title="Button" colors={colors}>
        <Row>
          <Button label="Primary" onPress={() => {}} />
          <Button label="Gold" variant="gold" onPress={() => {}} />
          <Button label="Secondary" variant="secondary" onPress={() => {}} />
        </Row>
        <Row>
          <Button label="Ghost" variant="ghost" onPress={() => {}} />
          <Button label="Danger" variant="danger" onPress={() => {}} />
          <Button label="Disabled" onPress={() => {}} disabled />
          <Button label="Loading" onPress={() => {}} loading />
        </Row>
      </Section>

      <Section title="Card" colors={colors}>
        <Card variant="flat" style={styles.stackGap}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Flat</Text>
        </Card>
        <Card variant="elevated" style={styles.stackGap}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Elevated</Text>
        </Card>
        <Card variant="glass" style={styles.stackGap}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Glass</Text>
        </Card>
      </Section>

      <Section title="Input" colors={colors}>
        <Input label="E-posta" placeholder="ornek@dentsocia.dev" style={styles.stackGap} />
        <Input label="Şifre" error="Şifre en az 8 karakter olmalı" style={styles.stackGap} />
      </Section>

      <Section title="Badge" colors={colors}>
        <Row>
          <Badge label="Taslak" variant="neutral" />
          <Badge label="Aktif" variant="blue" />
          <Badge label="★ Premium" variant="gold" />
          <Badge label="Onaylandı" variant="success" />
          <Badge label="İncelemede" variant="warning" />
          <Badge label="Reddedildi" variant="danger" />
        </Row>
      </Section>

      <Section title="Avatar" colors={colors}>
        <Row>
          <Avatar name="Ada Lovelace" size="sm" />
          <Avatar name="Ada Lovelace" size="md" />
          <Avatar name="DentSocia Klinik" size="lg" verified />
        </Row>
      </Section>

      <Section title="EmptyState" colors={colors}>
        <EmptyState icon={MessageCircle} title="Henüz mesajın yok" description="Eşleştiğinde sohbet burada görünecek." ctaLabel="Keşfet" onCtaPress={() => {}} />
      </Section>

      <Section title="Skeleton" colors={colors}>
        <SkeletonRow />
        <View style={styles.stackGap}>
          <Skeleton width="60%" />
        </View>
      </Section>

      <Section title="ModalShell" colors={colors}>
        <Row>
          <Button label="Bottom Sheet" variant="secondary" onPress={() => setSheetVisible(true)} />
          <Button label="Center Modal" variant="secondary" onPress={() => setCenterVisible(true)} />
        </Row>
      </Section>

      <Section title="LockedCard" colors={colors}>
        <LockedCard previewText="Vaka: 34y kadın hasta, alt çene All-on-4 planlaması. Teşhis ve ilk görüntüleme aşağıda..." />
      </Section>

      <Section title="JobCard" colors={colors}>
        <JobCard
          tag="Nöbetçi İlan"
          timestamp="2s önce"
          clinicName="Akdeniz Ağız ve Diş Sağlığı"
          subtitle="İzmir, Konak · Bugün 18:00–24:00"
          onPress={() => {}}
        />
      </Section>

      <Section title="HeartButton" colors={colors}>
        <HeartButton liked={liked} count={liked ? 129 : 128} onToggle={() => setLiked((v) => !v)} />
      </Section>

      <Section title="StepsIndicator" colors={colors}>
        <StepsIndicator steps={["01 Belge", "02 OCR", "03 Onay"]} activeIndex={0} />
      </Section>

      <Section title="Özel İkonlar" colors={colors}>
        <Row>
          <LockIcon size={22} color={colors.accentGold} />
          <DocumentIcon size={22} color={colors.textSecondary} />
          <CardIcon size={22} color={colors.textSecondary} />
          <HeartIcon size={22} color={colors.danger} filled />
        </Row>
      </Section>

      <Section title="ResultCard" colors={colors}>
        <ResultCard title="Doğrulandı" description="Uzm. Dt. rozeti profiline eklendi" />
        <ResultCard tone="danger" title="Reddedildi" description="Belge okunaklı değil, tekrar yükleyin" style={styles.stackGap} />
      </Section>

      <ModalShell visible={sheetVisible} onClose={() => setSheetVisible(false)} variant="sheet">
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Başvuru Seçenekleri</Text>
      </ModalShell>
      <ModalShell visible={centerVisible} onClose={() => setCenterVisible(false)} variant="center">
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Sohbeti sonlandır?</Text>
      </ModalShell>
    </ScrollView>
  );
}

function Section({ title, colors, children }: { title: string; colors: ThemeColors; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  schemeLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  stackGap: {
    marginTop: spacing.sm,
  },
  cardTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 15,
  },
});
