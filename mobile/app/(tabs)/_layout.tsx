import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useState } from "react";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "../../src/api";
import { IS_TV, SIZES, SAFE, SIDE_RAIL_W, SIDE_RAIL_W_EXPANDED, s, vs, ms } from "../../src/responsive";

// ============================================================
// TV Layout — collapsible left-side navigation rail
// Netflix/Prime Video pattern: 72px collapsed (icons only), expands
// to 260px with labels when any nav item is D-pad-focused. Content is
// unaffected because SAFE.left already reserves rail width on TV.
// ============================================================
function TVSideRail({ state, descriptors, navigation }: BottomTabBarProps) {
  const [focusedTab, setFocusedTab] = useState<string | null>(null);
  const anyFocused = focusedTab !== null;

  return (
    <View
      style={[
        styles.rail,
        {
          top: SAFE.top,
          bottom: SAFE.bottom,
          width: anyFocused ? SIDE_RAIL_W_EXPANDED : SIDE_RAIL_W,
        },
      ]}
      pointerEvents="box-none"
    >
      <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
      <View style={styles.railLogo}>
        <Ionicons name="menu" size={SIZES.iconMd} color={colors.zinc400} />
      </View>
      <View style={{ paddingVertical: vs(10) }}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const active = state.index === i;
          const label = (options.title ?? route.name) as string;
          const iconRender = options.tabBarIcon;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              focusable
              hasTVPreferredFocus={active && !anyFocused}
              onFocus={() => setFocusedTab(route.key)}
              onBlur={() => setFocusedTab((f) => (f === route.key ? null : f))}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ focused, pressed }) => [
                styles.railItem,
                active && styles.railItemActive,
                focused && styles.railItemFocused,
                pressed && { opacity: 0.7 },
              ]}
            >
              {({ focused }) => {
                const color = focused ? "#050614" : active ? colors.cyan : colors.zinc300;
                return (
                  <>
                    <View style={{ width: SIDE_RAIL_W, alignItems: "center" }}>
                      {iconRender ? iconRender({ focused, color, size: SIZES.iconMd }) : null}
                    </View>
                    {anyFocused ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.railLabel,
                          {
                            color,
                            fontFamily: focused || active ? "Unbounded_700Bold" : "Outfit_500Medium",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    ) : null}
                    {active && !focused ? <View style={styles.railActiveBar} /> : null}
                  </>
                );
              }}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// Phone layout — traditional bottom tab bar
// ============================================================
function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { height: SIZES.tabBarH + SAFE.bottom, paddingBottom: SAFE.bottom + 2 }]}>
      <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const active = state.index === i;
          const label = (options.title ?? route.name) as string;
          const iconRender = options.tabBarIcon;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              focusable
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={({ focused, pressed }) => [
                styles.tab,
                active && styles.tabActive,
                focused && styles.tabFocused,
                pressed && { opacity: 0.7 },
              ]}
            >
              {({ focused }) => {
                const color = focused ? "#050614" : active ? colors.cyan : colors.zinc400;
                return (
                  <>
                    {iconRender ? iconRender({ focused, color, size: SIZES.iconSm }) : null}
                    <Text numberOfLines={1} style={[styles.label, { color, fontFamily: focused || active ? "Unbounded_700Bold" : "Outfit_500Medium" }]}>{label}</Text>
                  </>
                );
              }}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => (IS_TV ? <TVSideRail {...props} /> : <BottomTabBar {...props} />)}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="browse"    options={{ title: "Browse",    tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline"     size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="livetv"    options={{ title: "Live TV",   tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline"    size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="movies"    options={{ title: "Movies",    tabBarIcon: ({ color, size }) => <Ionicons name="film-outline"     size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="series"    options={{ title: "Series",    tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline"   size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="watchlist" options={{ title: "Watchlist", tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites", tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline"    size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="search"    options={{ title: "Search",    tabBarIcon: ({ color, size }) => <Ionicons name="search-outline"   size={size ?? SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="more"      options={{ title: "More",      tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline"     size={size ?? SIZES.iconMd} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // ---------- Left-side rail (TV) ----------
  rail: {
    position: "absolute",
    left: 0,
    borderRightColor: "rgba(255,255,255,0.06)",
    borderRightWidth: 1,
    backgroundColor: "rgba(6,7,20,0.94)",
    zIndex: 30,
  },
  railLogo: { alignItems: "center", justifyContent: "center", paddingVertical: vs(14) },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: vs(56),
    borderRadius: 12,
    marginHorizontal: 6,
    marginVertical: 3,
    paddingRight: 12,
  },
  railItemActive: {
    backgroundColor: "rgba(6,182,212,0.12)",
  },
  railItemFocused: {
    backgroundColor: colors.cyan,
    transform: [{ scale: 1.04 }],
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 12 } : null),
  },
  railLabel: {
    fontSize: SIZES.fontBody,
    letterSpacing: 0.5,
    marginLeft: 4,
    flex: 1,
  },
  railActiveBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    backgroundColor: colors.cyan,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },

  // ---------- Bottom tab bar (phone) ----------
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopColor: "rgba(255,255,255,0.06)",
    borderTopWidth: 1,
    backgroundColor: "rgba(6,7,20,0.92)",
  },
  row: {
    flex: 1, flexDirection: "row", alignItems: "stretch", justifyContent: "space-around",
    paddingTop: vs(4),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: s(3),
    borderRadius: 10,
    paddingVertical: vs(4),
    paddingHorizontal: s(6),
    minHeight: vs(46),
  },
  tabActive: {
    backgroundColor: "rgba(6,182,212,0.10)",
  },
  tabFocused: {
    backgroundColor: colors.cyan,
    transform: [{ scale: 1.06 }],
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 14 } : null),
  },
  label: {
    fontSize: SIZES.fontTiny,
    marginTop: 2,
    letterSpacing: 0.4,
  },
});
