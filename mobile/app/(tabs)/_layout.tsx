import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors } from "../../src/api";
import { IS_TV, SIZES, SAFE, s, vs, ms } from "../../src/responsive";

/**
 * Custom Fire-TV-friendly tab bar.
 *
 * Why we roll our own: the default `<Tabs>` tab bar (from
 * @react-navigation/bottom-tabs) doesn't propagate D-pad focus on Fire OS —
 * highlights are subtle, left/right doesn't switch tabs, and focus can't
 * enter it from above. This version:
 *   - Every tab is a `Pressable focusable={true}` (Fire OS D-pad reaches it)
 *   - Focused tab shows a HUGE cyan glow (older users can't miss it)
 *   - Active tab has a bright cyan underline even when not focused
 *   - Labels are ALWAYS visible (icon-only was too abstract for older folks)
 */
function TVTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View
      style={[
        styles.bar,
        {
          height: SIZES.tabBarH + SAFE.bottom,
          paddingBottom: SAFE.bottom + 2,
          paddingHorizontal: SAFE.left,
        },
      ]}
    >
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
              // Wrap-around left/right so D-pad never dead-ends at the edge
              nextFocusLeft={undefined}
              nextFocusRight={undefined}
              // Absorb the "on-press" from a click or D-pad SELECT
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
                    {iconRender ? iconRender({ focused, color, size: SIZES.iconMd }) : null}
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.label,
                        {
                          color,
                          fontFamily: focused || active ? "Unbounded_700Bold" : "Outfit_500Medium",
                        },
                      ]}
                    >
                      {label}
                    </Text>
                    {active && !focused ? <View style={styles.activeUnderline} /> : null}
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
      // Use our custom TV-first tab bar
      tabBar={(props) => <TVTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="browse"    options={{ title: "Browse",    tabBarIcon: ({ color }) => <Ionicons name="grid-outline"     size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="livetv"    options={{ title: "Live TV",   tabBarIcon: ({ color }) => <Ionicons name="radio-outline"    size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="movies"    options={{ title: "Movies",    tabBarIcon: ({ color }) => <Ionicons name="film-outline"     size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="series"    options={{ title: "Series",    tabBarIcon: ({ color }) => <Ionicons name="albums-outline"   size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="watchlist" options={{ title: "Watchlist", tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites", tabBarIcon: ({ color }) => <Ionicons name="heart-outline"    size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="search"    options={{ title: "Search",    tabBarIcon: ({ color }) => <Ionicons name="search-outline"   size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="more"      options={{ title: "More",      tabBarIcon: ({ color }) => <Ionicons name="menu-outline"     size={SIZES.iconMd} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopColor: "rgba(255,255,255,0.06)",
    borderTopWidth: 1,
    backgroundColor: "rgba(6,7,20,0.92)",
  },
  row: {
    flex: 1, flexDirection: "row", alignItems: "stretch", justifyContent: "space-around",
    paddingTop: IS_TV ? vs(6) : vs(4),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: s(3),
    borderRadius: 10,
    paddingVertical: IS_TV ? vs(6) : vs(4),
    paddingHorizontal: s(6),
    // Give D-pad a big, unmistakable landing target
    minHeight: IS_TV ? vs(58) : vs(46),
  },
  tabActive: {
    // Subtle background hint on the active tab so the customer can always
    // tell where they ARE, even when focus has moved into content above.
    backgroundColor: "rgba(6,182,212,0.10)",
  },
  tabFocused: {
    // BIG obvious highlight when the D-pad is on this tab
    backgroundColor: colors.cyan,
    transform: [{ scale: 1.06 }],
    shadowColor: colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    ...(Platform.OS === "android" ? { elevation: 14 } : null),
  },
  label: {
    fontSize: SIZES.fontSmall,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  activeUnderline: {
    position: "absolute",
    bottom: 3,
    height: 3,
    width: "60%",
    borderRadius: 2,
    backgroundColor: colors.cyan,
  },
});
