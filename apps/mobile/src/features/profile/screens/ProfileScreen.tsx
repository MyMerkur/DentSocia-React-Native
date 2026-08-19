import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getApiErrorMessage } from "@dentsocia/api-client";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useTheme } from "../../../store/useThemeStore";
import { BrandSpinner } from "../../../components/BrandSpinner";
import { getMe, type UserProfile } from "../../../services/profileApi";
import { ShowcaseTab } from "../components/ShowcaseTab";
import { CareerTab } from "../components/CareerTab";

type ProfileTab = "showcase" | "career";

export function ProfileScreen() {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("showcase");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch((err) => setError(getApiErrorMessage(err, "Profil yüklenemedi")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <BrandSpinner />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>{error ?? "Profil yüklenemedi"}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "showcase" && { borderBottomColor: colors.accentGold }]}
          onPress={() => setActiveTab("showcase")}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === "showcase" && { color: colors.accentGold, fontWeight: typography.weights.semibold },
            ]}
          >
            Vitrin
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "career" && { borderBottomColor: colors.accentGold }]}
          onPress={() => setActiveTab("career")}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === "career" && { color: colors.accentGold, fontWeight: typography.weights.semibold },
            ]}
          >
            Kariyer
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "showcase" ? (
        <ShowcaseTab profile={profile} onUpdated={setProfile} />
      ) : (
        <CareerTab profile={profile} onUpdated={setProfile} />
      )}
    </View>
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
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
});
