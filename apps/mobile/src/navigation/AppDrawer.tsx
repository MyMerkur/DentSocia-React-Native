import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import {
  CreditCard,
  GraduationCap,
  Ticket,
  Briefcase,
  Target,
  LogOut,
  Palette,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react-native";
import { EMPLOYER_ROLES } from "@dentsocia/shared-constants";
import { fontFamilies, iconSizes, iconStrokeWidth, spacing } from "@dentsocia/ui-tokens";
import { useTheme } from "../store/useThemeStore";
import { getMe, type UserProfile } from "../services/profileApi";
import { logout } from "../services/authApi";
import { MainTabNavigator } from "./MainTabNavigator";
import { SubscriptionModal } from "../features/subscription/components/SubscriptionModal";
import { CoursesModal } from "../features/courses/components/CoursesModal";
import { EventsModal } from "../features/events/components/EventsModal";
import { BusinessModal } from "../features/business/components/BusinessModal";
import { MatchesModal } from "../features/matching/components/MatchesModal";
import { KycModal } from "../features/kyc/components/KycModal";
import { AdminModal } from "../features/admin/components/AdminModal";

const Drawer = createDrawerNavigator();

interface DrawerIconProps {
  size: number;
  color: string;
}

function KycIcon({ size, color }: DrawerIconProps) {
  return <ShieldCheck size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function MatchesIcon({ size, color }: DrawerIconProps) {
  return <Target size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function SubscriptionIcon({ size, color }: DrawerIconProps) {
  return <CreditCard size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function CoursesIcon({ size, color }: DrawerIconProps) {
  return <GraduationCap size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function EventsIcon({ size, color }: DrawerIconProps) {
  return <Ticket size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function BusinessIcon({ size, color }: DrawerIconProps) {
  return <Briefcase size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function DesignPreviewIcon({ size, color }: DrawerIconProps) {
  return <Palette size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function LogoutIcon({ size, color }: DrawerIconProps) {
  return <LogOut size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
function AdminIcon({ size, color }: DrawerIconProps) {
  return <ShieldAlert size={size} color={color} strokeWidth={iconStrokeWidth} />;
}

// Everything that used to crowd ProfileScreen's header row (Aboneliğim/Kurslar/Etkinlikler/
// İşletme/Çıkış Yap/Tasarım) plus CareerScreen's "Eşleşmelerim" now lives here — reachable
// from the sidebar icon on Ana Sayfa (Faz 5, #72).
function DrawerContent(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionVisible, setSubscriptionVisible] = useState(false);
  const [coursesVisible, setCoursesVisible] = useState(false);
  const [eventsVisible, setEventsVisible] = useState(false);
  const [businessVisible, setBusinessVisible] = useState(false);
  const [matchesVisible, setMatchesVisible] = useState(false);
  const [kycVisible, setKycVisible] = useState(false);
  const [adminVisible, setAdminVisible] = useState(false);

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  const isEmployer = profile ? (EMPLOYER_ROLES as readonly string[]).includes(profile.role) : false;

  function closeThenOpen(open: () => void) {
    props.navigation.closeDrawer();
    open();
  }

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
    >
      <Text style={[styles.header, { color: colors.textTertiary }]}>DENTSOCIA</Text>

      <DrawerItem
        label="Kimlik Doğrulama"
        icon={KycIcon}
        activeTintColor={colors.accentGold}
        inactiveTintColor={colors.textPrimary}
        onPress={() => closeThenOpen(() => setKycVisible(true))}
      />
      <DrawerItem
        label="Eşleşmelerim"
        icon={MatchesIcon}
        activeTintColor={colors.accentGold}
        inactiveTintColor={colors.textPrimary}
        onPress={() => closeThenOpen(() => setMatchesVisible(true))}
      />
      <DrawerItem
        label="Aboneliğim"
        icon={SubscriptionIcon}
        activeTintColor={colors.accentGold}
        inactiveTintColor={colors.textPrimary}
        onPress={() => closeThenOpen(() => setSubscriptionVisible(true))}
      />
      <DrawerItem
        label="Kurslar"
        icon={CoursesIcon}
        activeTintColor={colors.accentGold}
        inactiveTintColor={colors.textPrimary}
        onPress={() => closeThenOpen(() => setCoursesVisible(true))}
      />
      <DrawerItem
        label="Etkinlikler"
        icon={EventsIcon}
        activeTintColor={colors.accentGold}
        inactiveTintColor={colors.textPrimary}
        onPress={() => closeThenOpen(() => setEventsVisible(true))}
      />
      {isEmployer ? (
        <DrawerItem
          label="İşletme"
          icon={BusinessIcon}
          activeTintColor={colors.accentGold}
          inactiveTintColor={colors.textPrimary}
          onPress={() => closeThenOpen(() => setBusinessVisible(true))}
        />
      ) : null}

      {profile?.isAdmin ? (
        <DrawerItem
          label="Yönetici Paneli"
          icon={AdminIcon}
          activeTintColor={colors.accentGold}
          inactiveTintColor={colors.textPrimary}
          onPress={() => closeThenOpen(() => setAdminVisible(true))}
        />
      ) : null}

      {__DEV__ ? (
        <DrawerItem
          label="Tasarım Önizleme"
          icon={DesignPreviewIcon}
          activeTintColor={colors.accentGold}
          inactiveTintColor={colors.textPrimary}
          onPress={() => {
            props.navigation.closeDrawer();
            props.navigation.navigate("DesignPreview" as never);
          }}
        />
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      <DrawerItem
        label="Çıkış Yap"
        icon={LogoutIcon}
        activeTintColor={colors.danger}
        inactiveTintColor={colors.danger}
        onPress={() => {
          props.navigation.closeDrawer();
          logout();
        }}
      />

      {profile ? (
        <>
          <SubscriptionModal visible={subscriptionVisible} onClose={() => setSubscriptionVisible(false)} />
          <CoursesModal visible={coursesVisible} onClose={() => setCoursesVisible(false)} isInstructor={profile.kycLevel >= 4} />
          <EventsModal
            visible={eventsVisible}
            onClose={() => setEventsVisible(false)}
            isOrganizer={isEmployer && profile.kycLevel >= 3}
          />
          {isEmployer ? <BusinessModal visible={businessVisible} onClose={() => setBusinessVisible(false)} /> : null}
          <MatchesModal visible={matchesVisible} onClose={() => setMatchesVisible(false)} />
        </>
      ) : null}
      <KycModal visible={kycVisible} onClose={() => setKycVisible(false)} />
      <AdminModal visible={adminVisible} onClose={() => setAdminVisible(false)} />
    </DrawerContentScrollView>
  );
}

function renderDrawerContent(props: DrawerContentComponentProps) {
  return <DrawerContent {...props} />;
}

export function AppDrawer() {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: colors.surface, width: "78%" },
        drawerLabelStyle: { fontFamily: fontFamilies.medium, fontSize: iconSizes.md - 8 },
      }}
      drawerContent={renderDrawerContent}
    >
      <Drawer.Screen name="MainTabs" component={MainTabNavigator} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.lg,
  },
  header: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginLeft: spacing.lg,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
});
