import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { ImageOff } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typographyPresets } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { Card } from "../../../components/Card";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { EmptyState } from "../../../components/EmptyState";
import { Skeleton } from "../../../components/Skeleton";
import { getFeed, type CaseItem } from "../../../services/caseApi";
import { useAuthStore } from "../../../store/useAuthStore";
import { InboxModal } from "../../inbox/components/InboxModal";
import { UserProfileModal } from "../../profiles/components/UserProfileModal";
import type { MainTabParamList } from "../../../navigation/MainTabNavigator";

function FeedCardSkeleton() {
  return (
    <Card style={styles.card}>
      <View style={styles.authorRow}>
        <Skeleton width={32} height={32} radius={16} />
        <Skeleton width={120} height={12} style={styles.skeletonName} />
      </View>
      <Skeleton height={220} radius={radii.sm} style={styles.skeletonImage} />
      <Skeleton width="70%" height={13} style={styles.skeletonLine} />
      <Skeleton width="40%" height={13} />
    </Card>
  );
}

export function FeedScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageTarget, setMessageTarget] = useState<{ authorId: string; caseId: string } | null>(null);
  const [profileTargetId, setProfileTargetId] = useState<string | null>(null);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getFeed();
      setCases(page.cases);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, "Ana akış yüklenemedi"));
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
      const page = await getFeed();
      setCases(page.cases);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, "Ana akış yüklenemedi"));
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
      const page = await getFeed(nextCursor);
      setCases((current) => [...current, ...page.cases]);
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
        <FeedCardSkeleton />
        <FeedCardSkeleton />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: colors.background }]}
        data={cases}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentGold} />}
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        ListEmptyComponent={
          <View style={styles.centered}>
            {error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            ) : (
              <EmptyState
                icon={ImageOff}
                title="Henüz vaka paylaşılmamış"
                description="İlk vakanı paylaşarak akışı başlatan sen ol."
                ctaLabel="Vaka Paylaş"
                onCtaPress={() => navigation.navigate("Create")}
              />
            )}
          </View>
        }
        ListFooterComponent={loadingMore ? <Skeleton height={220} style={styles.footerSkeleton} /> : null}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.authorRow}>
              <TouchableOpacity onPress={() => setProfileTargetId(item.author.id)}>
                <Avatar name={item.author.displayName} imageUrl={item.author.avatarUrl} size="sm" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setProfileTargetId(item.author.id)}>
                <Text style={[styles.authorName, { color: colors.textPrimary }]}>{item.author.displayName}</Text>
              </TouchableOpacity>
            </View>

            {item.images[0] ? (
              <Image source={{ uri: item.images[0].url }} style={[styles.image, { backgroundColor: colors.surfaceElevated }]} />
            ) : null}

            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
            {item.description ? (
              <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
                {item.description}
              </Text>
            ) : null}
            {item.specialties.length > 0 ? (
              <View style={styles.tagRow}>
                {item.specialties.map((tag) => (
                  <Badge key={tag} label={tag} variant="neutral" />
                ))}
              </View>
            ) : null}

            {item.author.id !== currentUserId ? (
              <TouchableOpacity onPress={() => setMessageTarget({ authorId: item.author.id, caseId: item.id })}>
                <Text style={[styles.messageLink, { color: colors.accentGold }]}>Yazara Mesaj</Text>
              </TouchableOpacity>
            ) : null}
          </Card>
        )}
      />

      <InboxModal
        visible={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        startTarget={
          messageTarget ? { userId: messageTarget.authorId, context: { type: "case", id: messageTarget.caseId } } : null
        }
      />
      <UserProfileModal visible={profileTargetId !== null} userId={profileTargetId} onClose={() => setProfileTargetId(null)} />
    </>
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
  skeletonName: {
    marginLeft: spacing.sm,
  },
  skeletonImage: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  skeletonLine: {
    marginBottom: spacing.xs,
  },
  footerSkeleton: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  authorName: {
    ...typographyPresets.bodySmall,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typographyPresets.h2,
    marginBottom: spacing.xs,
  },
  description: {
    ...typographyPresets.body,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  messageLink: {
    ...typographyPresets.bodySmall,
    marginTop: spacing.sm,
  },
});
