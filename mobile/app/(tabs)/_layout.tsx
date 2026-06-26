import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Platform } from "react-native";
import { colors } from "../../src/api";

const isTV = Platform.isTV;

/**
 * Bottom tabs on phones; large top-row–style tabs on Fire TV.
 * (Expo Router's <Tabs> renders bottom-tabs; on TV we make them taller and
 * larger so they are usable with a D-pad remote from 10 feet away.)
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: "Outfit_500Medium",
          fontSize: isTV ? 14 : 10,
          letterSpacing: 0.5,
        },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.zinc500,
        tabBarItemStyle: { paddingVertical: isTV ? 12 : 4 },
        tabBarStyle: {
          position: "absolute",
          borderTopColor: "rgba(255,255,255,0.05)",
          backgroundColor: "rgba(6,7,20,0.92)",
          height: isTV ? 96 : 78,
          paddingTop: isTV ? 14 : 8,
          paddingBottom: isTV ? 18 : 18,
        },
        tabBarBackground: () => <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />,
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{ title: "Browse", tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="livetv"
        options={{ title: "Live TV", tabBarIcon: ({ color }) => <Ionicons name="radio-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="movies"
        options={{ title: "Movies", tabBarIcon: ({ color }) => <Ionicons name="film-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="series"
        options={{ title: "Series", tabBarIcon: ({ color }) => <Ionicons name="albums-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ title: "Watchlist", tabBarIcon: ({ color }) => <Ionicons name="bookmark-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: "Favorites", tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: "Search", tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarIcon: ({ color }) => <Ionicons name="menu-outline" size={isTV ? 28 : 20} color={color} /> }}
      />
    </Tabs>
  );
}
