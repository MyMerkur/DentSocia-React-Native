import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Megaphone } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { Skeleton } from "../../../components/Skeleton";
import { getAnnouncements, type AnnouncementItem } from "../../../services/announcementApi";

// PRD v3 §9.4 — salt okunur duyuru akışı: FEATURE_FLAGS.socialFeed kapalıyken Ana Sayfa'nın
// varsayılanı. Sistem olayları + admin içerikleri, yorum/beğeni/algoritma yok — bu yüzden
// FeedScreen'in aksine yazar/mesajlaşma/profil bağlantısı hiç yok, sadece başlık+gövde+tarih.
function AnnouncementCardSkeleton() {
  return (
    <Card style={styles.card}>
      <Skeleton width="60%" height={14} style={styles.skeletonTitle} />
      <Skeleton width="90%" height={12} style={styles.skeletonLine} />
      <Skeleton width="40%" height={12} />
    </Card>
  );
}

export function AnnouncementFeedScreen() {
  const { colors } = useTheme();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getAnnouncements();
      setAnnouncements(page.announcements);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, "Duyurular yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const page = await getAnnouncements();
      setAnnouncements(page.announcements);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, "Duyurular yüklenemedi"));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await getAnnouncements(nextCursor);
      setAnnouncements((current) => [...current, ...page.announcements]);
      setNextCursor(page.nextCursor);
    } catch {
      // Sessizce yut: kullanıcı listeyi kaydırmaya devam edebilsin, aşağı çekip yenileyerek tekrar deneyebilir
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AnnouncementCardSkeleton />
        <AnnouncementCardSkeleton />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      data={announcements}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentGold} />}
      onEndReachedThreshold={0.4}
      onEndReached={handleLoadMore}
      ListEmptyComponent={
        <View style={styles.centered}>
          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : (
            <EmptyState icon={Megaphone} title="Henüz duyuru yok" description="Yeni duyurular burada görünecek." />
          )}
        </View>
      }
      ListFooterComponent={loadingMore ? <Skeleton height={80} style={styles.footerSkeleton} /> : null}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
          <Text style={[styles.date, { color: colors.textTertiary }]}>
            {new Date(item.createdAt).toLocaleDateString("tr-TR")}
          </Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    ...typographyPresets.body,
  },
  card: {
    margin: spacing.md,
    marginBottom: 0,
  },
  skeletonTitle: {
    marginBottom: spacing.sm,
  },
  skeletonLine: {
    marginBottom: spacing.xs,
  },
  footerSkeleton: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  title: {
    ...typographyPresets.h2,
    marginBottom: spacing.xs,
  },
  body: {
    ...typographyPresets.body,
  },
  date: {
    ...typographyPresets.bodySmall,
    marginTop: spacing.sm,
  },
});
