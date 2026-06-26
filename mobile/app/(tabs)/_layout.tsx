import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Platform } from "react-native";
import { colors } from "../../src/api";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontFamily: "Outfit_500Medium", fontSize: 10, letterSpacing: 0.5 },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.zinc500,
        tabBarStyle: { position: "absolute", borderTopColor: "rgba(255,255,255,0.05)", backgroundColor: "rgba(6,7,20,0.85)", height: 78, paddingTop: 8, paddingBottom: 18 },
        tabBarBackground: () => <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />,
      }}
    >
      <Tabs.Screen name="browse" options={{ title: "Browse", tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={20} color={color} /> }} />
      <Tabs.Screen name="livetv" options={{ title: "Live TV", tabBarIcon: ({ color }) => <Ionicons name="radio-outline" size={20} color={color} /> }} />
      <Tabs.Screen name="movies" options={{ title: "Movies", tabBarIcon: ({ color }) => <Ionicons name="film-outline" size={20} color={color} /> }} />
      <Tabs.Screen name="series" options={{ title: "Series", tabBarIcon: ({ color }) => <Ionicons name="albums-outline" size={20} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: "Search", tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={20} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color }) => <Ionicons name="menu-outline" size={20} color={color} /> }} />
    </Tabs>
  );
}
