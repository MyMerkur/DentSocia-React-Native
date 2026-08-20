import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Bookmark } from "lucide-react-native";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { iconSizes, iconStrokeWidth, spacing, typography } from "@dentsocia/ui-tokens";
import { useAuthStore } from "../../../store/useAuthStore";
import { JobListTab } from "../components/JobListTab";
import { MyApplicationsTab } from "../components/MyApplicationsTab";
import { MyPostingsTab } from "../components/MyPostingsTab";
import { SavedSearchModal } from "../components/SavedSearchModal";
import { JobSwipeTab } from "../../matching/components/JobSwipeTab";
import { useTheme } from "../../../store/useThemeStore";

type CareerTab = "jobs" | "discover" | "applications" | "postings";

export function CareerScreen() {
  const { colors } = useTheme();
  const role = useAuthStore((state) => state.user?.role);
  const isEmployer = role ? (EMPLOYER_ROLES as readonly string[]).includes(role) : false;
  const [activeTab, setActiveTab] = useState<CareerTab>("jobs");
  const [savedSearchVisible, setSavedSearchVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!isEmployer ? (
        <TouchableOpacity
          style={styles.savedSearchButton}
          onPress={() => setSavedSearchVisible(true)}
          accessibilityLabel="Kayıtlı Aramalarım"
        >
          <Bookmark size={iconSizes.sm} color={colors.accentGold} strokeWidth={iconStrokeWidth} />
          <Text style={[styles.savedSearchButtonText, { color: colors.accentGold }]}>Kayıtlı Aramalarım</Text>
        </TouchableOpacity>
      ) : null}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "jobs" && { borderBottomColor: colors.accentGold }]}
          onPress={() => setActiveTab("jobs")}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === "jobs" && { color: colors.accentGold, fontWeight: typography.weights.semibold },
            ]}
          >
            İlanlar
          </Text>
        </TouchableOpacity>
        {!isEmployer ? (
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "discover" && { borderBottomColor: colors.accentGold }]}
            onPress={() => setActiveTab("discover")}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === "discover" && { color: colors.accentGold, fontWeight: typography.weights.semibold },
              ]}
            >
              Keşfet
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "applications" && { borderBottomColor: colors.accentGold }]}
          onPress={() => setActiveTab("applications")}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === "applications" && { color: colors.accentGold, fontWeight: typography.weights.semibold },
            ]}
          >
            Başvurularım
          </Text>
        </TouchableOpacity>
        {isEmployer ? (
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "postings" && { borderBottomColor: colors.accentGold }]}
            onPress={() => setActiveTab("postings")}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                activeTab === "postings" && { color: colors.accentGold, fontWeight: typography.weights.semibold },
              ]}
            >
              İlanlarım
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {activeTab === "jobs" ? <JobListTab /> : null}
      {activeTab === "discover" && !isEmployer ? <JobSwipeTab /> : null}
      {activeTab === "applications" ? <MyApplicationsTab /> : null}
      {activeTab === "postings" && isEmployer ? <MyPostingsTab /> : null}
      {!isEmployer ? <SavedSearchModal visible={savedSearchVisible} onClose={() => setSavedSearchVisible(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  savedSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: "flex-end",
  },
  savedSearchButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
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
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
