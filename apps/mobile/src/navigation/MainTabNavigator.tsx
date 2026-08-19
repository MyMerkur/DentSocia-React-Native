import { useEffect, useState, type ComponentType } from "react";
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "@react-native-community/blur";
import { House, Users, CirclePlus, Briefcase, User, MessageCircle, Menu } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { duration, elevation, iconSizes, iconStrokeWidth, radii } from "@dentsocia/ui-tokens";
import { ProfileScreen } from "../features/profile/screens/ProfileScreen";
import { FeedScreen } from "../features/feed/screens/FeedScreen";
import { HubsScreen } from "../features/hubs/screens/HubsScreen";
import { CreateCaseScreen } from "../features/cases/screens/CreateCaseScreen";
import { CareerScreen } from "../features/jobs/screens/CareerScreen";
import { InboxScreen } from "../features/inbox/screens/InboxScreen";
import { getUnreadThreadCount } from "../services/inboxApi";
import { NotificationsHeaderButton } from "../features/notifications/components/NotificationsHeaderButton";
import { useTheme } from "../store/useThemeStore";

export type MainTabParamList = {
  Feed: undefined;
  Hubs: undefined;
  Create: undefined;
  Career: undefined;
  Inbox: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  focused: boolean;
  color: string;
}

// lucide-react-native doesn't export its icon component type publicly — mirrors the
// subset every icon actually needs here (see components/EmptyState.tsx for the same pattern).
interface IconComponentProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function AnimatedTabIcon(Icon: ComponentType<IconComponentProps>) {
  return function TabIcon({ focused, color }: TabIconProps) {
    const focusValue = useSharedValue(focused ? 1 : 0);

    useEffect(() => {
      focusValue.value = withTiming(focused ? 1 : 0, { duration: duration.fast });
    }, [focused, focusValue]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 + focusValue.value * 0.12 }],
    }));

    return (
      <Animated.View style={animatedStyle}>
        <Icon size={iconSizes.md} color={color} strokeWidth={iconStrokeWidth} />
      </Animated.View>
    );
  };
}

const FeedTabIcon = AnimatedTabIcon(House);
const HubsTabIcon = AnimatedTabIcon(Users);
const CreateTabIcon = AnimatedTabIcon(CirclePlus);
const CareerTabIcon = AnimatedTabIcon(Briefcase);
const InboxTabIcon = AnimatedTabIcon(MessageCircle);
const ProfileTabIcon = AnimatedTabIcon(User);

// headerLeft on Ana Sayfa — opens the sidebar (Faz 5, #72). Sits at the same header
// height as the title and NotificationsHeaderButton, so all three stay aligned.
function SidebarToggle() {
  const { colors } = useTheme();
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={styles.sidebarToggle}
      accessibilityLabel="Menü"
    >
      <Menu size={iconSizes.md} color={colors.textPrimary} strokeWidth={iconStrokeWidth} />
    </TouchableOpacity>
  );
}

const CREATE_ROUTE_NAME = "Create";
const BAR_HEIGHT = 56;
const CREATE_BUTTON_SIZE = 52;

// Custom tab bar (spec §7.9) — translucent blurred zemin, and the "Paylaş" tab
// rendered as a physically-elevated circular button rather than a flattened 5th
// icon (do not collapse this back into a plain tab). Badges are drawn here
// directly since a custom `tabBar` bypasses React Navigation's built-in
// `tabBarBadge` rendering.
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.barWrap, { height: BAR_HEIGHT + insets.bottom, borderTopColor: colors.border }]}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType={scheme === "dark" ? "dark" : "light"}
        blurAmount={16}
        overlayColor={colors.surface}
        reducedTransparencyFallbackColor={colors.surface}
      />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? colors.accentGold : colors.textSecondary;

        function handlePress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        if (route.name === CREATE_ROUTE_NAME) {
          return (
            <View key={route.key} style={styles.createSlot}>
              <Pressable
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel={options.title ?? route.name}
                style={[
                  styles.createButton,
                  { backgroundColor: colors.accentGoldStrong },
                  Platform.select<ViewStyle>({ ios: elevation.glow.ios, android: elevation.glow.android }),
                ]}
              >
                {options.tabBarIcon?.({ focused, color: colors.textOnAccent, size: iconSizes.md })}
              </Pressable>
            </View>
          );
        }

        const badgeCount = options.tabBarBadge;

        return (
          <Pressable
            key={route.key}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={options.title ?? route.name}
            style={styles.tabItem}
          >
            <View>
              {options.tabBarIcon?.({ focused, color, size: iconSizes.md })}
              {badgeCount ? (
                <View style={[styles.badge, { backgroundColor: colors.accentGold }]}>
                  <Text style={[styles.badgeText, { color: colors.textOnAccent }]}>{badgeCount}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// React Navigation invokes `tabBar` as a plain function call, not via createElement -
// passing `CustomTabBar` directly breaks its hooks ("Invalid hook call"). This module-level
// wrapper renders it as a real element while staying a stable reference across renders
// (avoids the react/no-unstable-nested-components warning an inline arrow would trigger).
function renderTabBar(props: BottomTabBarProps) {
  return <CustomTabBar {...props} />;
}

export function MainTabNavigator() {
  const { colors } = useTheme();
  const [unreadThreadCount, setUnreadThreadCount] = useState(0);

  useEffect(() => {
    getUnreadThreadCount()
      .then(setUnreadThreadCount)
      .catch(() => undefined);
  }, []);

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: "Ana Sayfa",
          tabBarIcon: FeedTabIcon,
          headerLeft: SidebarToggle,
          headerRight: NotificationsHeaderButton,
        }}
      />
      <Tab.Screen name="Hubs" component={HubsScreen} options={{ title: "Topluluklar", tabBarIcon: HubsTabIcon }} />
      <Tab.Screen name="Create" component={CreateCaseScreen} options={{ title: "Paylaş", tabBarIcon: CreateTabIcon }} />
      <Tab.Screen name="Career" component={CareerScreen} options={{ title: "Kariyer", tabBarIcon: CareerTabIcon }} />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: "Mesajlar",
          tabBarIcon: InboxTabIcon,
          tabBarBadge: unreadThreadCount > 0 ? unreadThreadCount : undefined,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil", tabBarIcon: ProfileTabIcon }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  sidebarToggle: {
    marginLeft: 12,
    padding: 6,
  },
  barWrap: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "visible",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  createButton: {
    width: CREATE_BUTTON_SIZE,
    height: CREATE_BUTTON_SIZE,
    borderRadius: CREATE_BUTTON_SIZE / 2,
    marginTop: -(CREATE_BUTTON_SIZE - BAR_HEIGHT) / 2 - 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
});
