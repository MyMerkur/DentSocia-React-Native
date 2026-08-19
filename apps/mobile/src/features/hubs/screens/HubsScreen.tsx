import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Users } from "lucide-react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { radii, spacing, typography, type ThemeColors } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { getMe, type UserProfile } from "../../../services/profileApi";
import { discoverHubs, listMyHubs, listManagedHubs, type HubItem } from "../../../services/hubApi";
import { HubDetailModal } from "../components/HubDetailModal";
import { CreateHubModal } from "../components/CreateHubModal";
import { Card } from "../../../components/Card";
import { EmptyState } from "../../../components/EmptyState";
import { SkeletonRow } from "../../../components/Skeleton";

type HubsTab = "discover" | "mine" | "managed";

const PAID_HUB_CREATION_KYC_LEVEL = 4;

function getTabTextColor(isActive: boolean, colors: ThemeColors): string {
  return isActive ? colors.accentGold : colors.textSecondary;
}

export function HubsScreen() {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<HubsTab>("discover");
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab]);

  async function loadTab(tab: HubsTab) {
    setLoading(true);
    setError(null);
    try {
      if (tab === "discover") {
        const result = await discoverHubs();
        setHubs(result.hubs);
      } else if (tab === "mine") {
        setHubs(await listMyHubs());
      } else {
        setHubs(await listManagedHubs());
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Hublar yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }

  function handleMembershipChanged() {
    loadTab(activeTab);
  }

  function handleCreated() {
    setActiveTab("managed");
  }

  const activeTabBorderStyle = { borderBottomColor: colors.accentGold };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Hubs</Text>
        {profile && profile.kycLevel >= 1 ? (
          <TouchableOpacity
            style={[styles.createButton, { borderColor: colors.accentGold }]}
            onPress={() => setCreateVisible(true)}
          >
            <Text style={[styles.createButtonText, { color: colors.accentGold }]}>+ Hub Oluştur</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "discover" && activeTabBorderStyle]}
          onPress={() => setActiveTab("discover")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "discover" && styles.tabTextActive,
              { color: getTabTextColor(activeTab === "discover", colors) },
            ]}
          >
            Keşfet
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "mine" && activeTabBorderStyle]}
          onPress={() => setActiveTab("mine")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "mine" && styles.tabTextActive,
              { color: getTabTextColor(activeTab === "mine", colors) },
            ]}
          >
            Hublarım
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "managed" && activeTabBorderStyle]}
          onPress={() => setActiveTab("managed")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "managed" && styles.tabTextActive,
              { color: getTabTextColor(activeTab === "managed", colors) },
            ]}
          >
            Yönettiklerim
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {loading ? (
        <View style={styles.skeletonList}>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {hubs.length === 0 ? (
            <EmptyState icon={Users} title="Henüz Hub yok" description="Keşfet sekmesinden yeni Hub'lara göz atabilirsin." />
          ) : (
            hubs.map((hub) => (
              <TouchableOpacity key={hub.id} onPress={() => setSelectedHubId(hub.id)}>
                <Card variant="elevated" style={styles.card}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{hub.name}</Text>
                  {hub.description ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{hub.description}</Text>
                  ) : null}
                  <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                    {hub.memberCount} üye · {hub.type === "paid" ? `₺${hub.price}/ay` : "Ücretsiz"}
                    {hub.isMember ? " · Üyesiniz" : ""}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <HubDetailModal
        hubId={selectedHubId}
        onClose={() => setSelectedHubId(null)}
        onMembershipChanged={handleMembershipChanged}
      />
      <CreateHubModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        canCreatePaid={(profile?.kycLevel ?? 0) >= PAID_HUB_CREATION_KYC_LEVEL}
        onCreated={handleCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: spacing.md,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  createButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  createButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  tabTextActive: {
    fontWeight: typography.weights.semibold,
  },
  skeletonList: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  content: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  error: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  cardBody: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  cardMeta: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
});
