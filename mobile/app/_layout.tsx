import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Unbounded_400Regular, Unbounded_700Bold, Unbounded_800ExtraBold } from "@expo-google-fonts/unbounded";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import { ErrorBoundary } from "../src/ErrorBoundary";

SplashScreen.preventAutoHideAsync().catch(() => {});

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Unbounded_400Regular, Unbounded_700Bold, Unbounded_800ExtraBold,
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold,
  });
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <ErrorBoundary label="root">
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0B0518" } }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
