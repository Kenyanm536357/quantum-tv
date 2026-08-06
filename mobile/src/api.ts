import axios from "axios/dist/browser/axios.cjs";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.backendUrl ||
  "";
export const API = `${BACKEND}/api`;

const client = axios.create({ baseURL: API, timeout: 25000 });

client.interceptors.request.use(async (config) => {
  const t = await AsyncStorage.getItem("qtv_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default client;

// ============================================================
// Palette — pulled straight from the Quantum TV logo:
//   • Deep royal purple background (bg / surface family)
//   • Cyan → lavender → magenta gradient (accent trio)
// The whole app should feel like the login screen, not
// generic dark-blue.
// ============================================================
export const colors = {
  // Backgrounds
  bg: "#0B0518",           // deepest — nearly black with a hint of purple
  bgAlt: "#150826",        // secondary bg for cards
  surface: "#1C0A38",      // royal purple surface (previously #0D0E23)
  surfaceAlt: "#2A0F5A",   // deeper purple surface

  // Text
  white: "#FFFFFF",
  zinc300: "#D4D4D8",
  zinc400: "#B4A9D4",      // muted lavender-tinted grey
  zinc500: "#8B7DB0",      // dimmer lavender-tinted grey

  // Logo-derived accent trio
  purple: "#8B5CF6",       // primary purple (from "TV" text)
  purpleDeep: "#5B21B6",   // darker purple for gradient
  cyan: "#67E8F9",         // cyan highlight (top of logo wreath)
  magenta: "#E879F9",      // magenta/pink accent (bottom of logo)
  pink: "#F0ABFC",         // soft pink (mid-logo)

  // Utility
  red: "#EF4444",
};

// Convenience gradient colour arrays for LinearGradient consumers
export const GRADIENTS = {
  // Full-screen ambient background: subtle royal-purple wash
  screenBg: ["#0B0518", "#170634", "#0B0518"] as const,
  // Radial-style header glow (used at top of every main screen)
  headerGlow: ["rgba(139,92,246,0.28)", "rgba(232,121,249,0.10)", "transparent"] as const,
  // Primary CTA gradient (also used on brand text)
  brand: ["#8B5CF6", "#67E8F9"] as const,
  brandVertical: ["#67E8F9", "#8B5CF6", "#E879F9"] as const, // matches logo
  // Focused card glow
  focusGlow: ["rgba(103,232,249,0.35)", "rgba(139,92,246,0.35)"] as const,
};
