import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { spacing, typography } from "@dentsocia/ui-tokens";
import { useAuthStore } from "../../../store/useAuthStore";
import { JobListTab } from "../components/JobListTab";
import { MyApplicationsTab } from "../components/MyApplicationsTab";
import { MyPostingsTab } from "../components/MyPostingsTab";
import { JobSwipeTab } from "../../matching/components/JobSwipeTab";
import { useTheme } from "../../../store/useThemeStore";

type CareerTab = "jobs" | "discover" | "applications" | "postings";

export function CareerScreen() {
  const { colors } = useTheme();
  const role = useAuthStore((state) => state.user?.role);
  const isEmployer = role ? (EMPLOYER_ROLES as readonly string[]).includes(role) : false;
  const [activeTab, setActiveTab] = useState<CareerTab>("jobs");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
