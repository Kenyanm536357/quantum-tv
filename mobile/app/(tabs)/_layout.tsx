import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "../../src/api";
import { IS_TV, SIZES, SAFE, SIDE_RAIL_W, SIDE_RAIL_EXPANDED_W, s, vs } from "../../src/responsive";

// ============================================================
// TV Layout — Netflix-style collapsible left navigation rail.
// Collapsed (icons only) by default so shows get the full screen.
// Expands while D-pad focus is inside the rail; collapses on
// selection or when focus moves into content. No animations.
// ============================================================
function TVSideRail({ state, descriptors, navigation }: BottomTabBarProps) {
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onItemFocus = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const onItemBlur = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), 120);
  };

  return (
    <View
      style={[
        styles.rail,
        { top: SAFE.top, bottom: SAFE.bottom, width: expanded ? SIDE_RAIL_EXPANDED_W : SIDE_RAIL_W },
        expanded && styles.railExpanded,
      ]}
      pointerEvents="box-none"
    >
      <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
      <View style={styles.railHeader}>
        <Text style={styles.railBrand} numberOfLines={1}>
          {expanded ? (<>QUANTUM <Text style={{ color: colors.cyan }}>TV</Text></>) : (<Text style={{ color: colors.cyan }}>Q</Text>)}
        </Text>
      </View>
      <View style={{ paddingVertical: vs(6) }}>
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
              hasTVPreferredFocus={active}
              onFocus={onItemFocus}
              onBlur={onItemBlur}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
                setExpanded(false);
              }}
              style={({ focused, pressed }) => [
                styles.railItem,
                expanded && { paddingRight: 12 },
                active && styles.railItemActive,
                focused && styles.railItemFocused,
                pressed && { opacity: 0.7 },
              ]}
            >
              {({ focused }) => {
                const color = focused ? "#050614" : "#FFFFFF";
                return (
                  <>
                    <View style={styles.railIconBox}>
                      {iconRender ? iconRender({ focused, color, size: SIZES.iconMd }) : null}
                    </View>
                    {expanded ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.railLabel,
                          { color, fontFamily: focused || active ? "Unbounded_700Bold" : "Outfit_500Medium" },
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
                const color = focused ? "#050614" : active ? colors.cyan : "#FFFFFF";
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
  railExpanded: {
    backgroundColor: "rgba(6,7,20,0.98)",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 8, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 20 } : null),
  },
  railHeader: { alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: vs(16) },
  railBrand: { color: "#FFFFFF", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH2, letterSpacing: 1.2 },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: vs(52),
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 3,
  },
  railItemActive: { backgroundColor: "rgba(6,182,212,0.12)" },
  railItemFocused: {
    // BIG obvious highlight without any transform to prevent layout wiggle.
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 12 } : null),
  },
  railIconBox: { width: 52, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  railLabel: { fontSize: SIZES.fontBody, letterSpacing: 0.5, flex: 1 },
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
  tabActive: { backgroundColor: "rgba(6,182,212,0.10)" },
  tabFocused: {
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 14 } : null),
  },
  label: { fontSize: SIZES.fontTiny, marginTop: 2, letterSpacing: 0.4 },
});
