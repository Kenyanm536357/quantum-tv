import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import { colors } from "../../src/api";
import { IS_TV, SIZES, SAFE, ms } from "../../src/responsive";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "Outfit_500Medium",
          fontSize: SIZES.fontSmall,
          letterSpacing: 0.5,
        },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.zinc500,
        tabBarItemStyle: { paddingVertical: IS_TV ? 6 : 2 },
        tabBarStyle: {
          position: "absolute",
          borderTopColor: "rgba(255,255,255,0.05)",
          backgroundColor: "rgba(6,7,20,0.92)",
          height: SIZES.tabBarH + SAFE.bottom,
          paddingTop: IS_TV ? 6 : 4,
          paddingBottom: SAFE.bottom + 2,
          paddingHorizontal: SAFE.left,
        },
        tabBarBackground: () => <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />,
      }}
    >
      <Tabs.Screen name="browse"   options={{ title: "Browse",    tabBarIcon: ({ color }) => <Ionicons name="grid-outline"     size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="livetv"   options={{ title: "Live TV",   tabBarIcon: ({ color }) => <Ionicons name="radio-outline"    size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="movies"   options={{ title: "Movies",    tabBarIcon: ({ color }) => <Ionicons name="film-outline"     size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="series"   options={{ title: "Series",    tabBarIcon: ({ color }) => <Ionicons name="albums-outline"   size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="watchlist" options={{ title: "Watchlist", tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites", tabBarIcon: ({ color }) => <Ionicons name="heart-outline"    size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="search"   options={{ title: "Search",    tabBarIcon: ({ color }) => <Ionicons name="search-outline"   size={SIZES.iconMd} color={color} /> }} />
      <Tabs.Screen name="more"     options={{ title: "More",      tabBarIcon: ({ color }) => <Ionicons name="menu-outline"     size={SIZES.iconMd} color={color} /> }} />
    </Tabs>
  );
}
