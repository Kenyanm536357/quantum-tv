import { Redirect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Image, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../src/api";
import { ms, vs, IS_TV } from "../src/responsive";
import {
  OTA_CHECK_TIMEOUT_MS,
  checkDownloadAndApply,
  withTimeout,
} from "../src/ota";

// ============================================================
// Startup screen — shows loading messages while silently
// checking for OTA updates, then routes into the app.
// If an update is available the user is prompted "Now / Later".
// ============================================================

type Phase = "loading" | "update-prompt" | "updating" | "ready";

const STARTUP_HARD_TIMEOUT_MS = 9000;

export default function Index() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("loading");
  const [msg, setMsg] = useState("Channels ready for you");
  const [installing, setInstalling] = useState(false);
  const phaseRef = useRef<Phase>("loading");

  const dotAnim = useRef(new Animated.Value(0)).current;
  const msgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Animated pulsing dots
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dotAnim]);

  // Fade message in
  const fadeInMsg = useCallback(() => {
    msgAnim.setValue(0);
    Animated.timing(msgAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [msgAnim]);

  useEffect(() => {
    fadeInMsg();
    let cancelled = false;

    const t1 = setTimeout(() => {
      if (cancelled) return;
      setMsg("Enjoy!");
      fadeInMsg();
    }, 1300);

    // Never leave the user stuck on the loading splash if OTA hangs.
    const hardTimeout = setTimeout(() => {
      if (cancelled) return;
      if (phaseRef.current === "loading") {
        setPhase("ready");
      }
    }, STARTUP_HARD_TIMEOUT_MS);

    const t2 = setTimeout(async () => {
      if (cancelled) return;
      // Silently check for OTA update with a hard timeout so startup cannot hang.
      if (Updates.isEnabled) {
        try {
          const result = await withTimeout(
            Updates.checkForUpdateAsync(),
            OTA_CHECK_TIMEOUT_MS,
            "checkForUpdateAsync",
          );
          if (!cancelled && result.isAvailable) {
            setPhase("update-prompt");
            return;
          }
        } catch {
          // offline, timeout, or not configured — continue into app
        }
      }
      if (!cancelled && phaseRef.current === "loading") setPhase("ready");
    }, 1800);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(hardTimeout);
    };
  }, [fadeInMsg]);

  // Read auth token once
  useEffect(() => {
    AsyncStorage.getItem("qtv_token")
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const handleUpdateNow = useCallback(async () => {
    if (installing) return;
    setInstalling(true);
    setPhase("updating");
    // Download then hard-reload so the next JS boot uses the new bundle.
    const result = await checkDownloadAndApply({ apply: true });
    if (!result.applied) {
      setInstalling(false);
      // If download succeeded but reload failed, still enter app; next cold
      // start with ON_LOAD should pick up the pending bundle.
      setPhase("ready");
    }
  }, [installing]);

  const handleUpdateLater = useCallback(() => {
    setPhase("ready");
  }, []);

  // Once ready, redirect to correct screen
  if (phase === "ready" && token !== undefined) {
    return token ? <Redirect href="/(tabs)/browse" /> : <Redirect href="/login" />;
  }

  // Full-screen updating view (hidden behind app during download)
  if (phase === "updating") {
    return (
      <View style={styles.root}>
        <LinearGradient colors={["#0B0518", "#170634", "#0B0518"]} style={StyleSheet.absoluteFill} />
        <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>QUANTUM <Text style={{ color: colors.cyan }}>TV</Text></Text>
        <View style={styles.updateBox}>
          <Ionicons name="cloud-download-outline" size={ms(36)} color={colors.cyan} style={{ marginBottom: vs(12) }} />
          <Text style={styles.updateTitle}>Downloading update…</Text>
          <Text style={styles.updateSub}>Please keep the app open. This won't take long.</Text>
          <Animated.View style={[styles.progressBar, { opacity: dotAnim }]}>
            <LinearGradient colors={[colors.purple, colors.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>
    );
  }

  // Startup loading screen (also hosts the update prompt modal)
  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0518", "#170634", "#0B0518"]} style={StyleSheet.absoluteFill} />
      <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brand}>QUANTUM <Text style={{ color: colors.cyan }}>TV</Text></Text>

      {phase === "loading" && (
        <Animated.Text style={[styles.loadingMsg, { opacity: msgAnim }]}>{msg}</Animated.Text>
      )}
      {phase === "loading" && (
        <Animated.View style={[styles.dots, { opacity: dotAnim }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === 1 ? colors.cyan : colors.purple }]} />
          ))}
        </Animated.View>
      )}

      {/* Update prompt modal */}
      <Modal transparent visible={phase === "update-prompt"} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBox}>
                <Ionicons name="cloud-download-outline" size={ms(28)} color="#050614" />
              </View>
            </View>
            <Text style={styles.modalTitle}>Update Available</Text>
            <Text style={styles.modalBody}>A new version of Quantum TV is ready. Would you like to update now or later?</Text>
            <Pressable
              focusable
              hasTVPreferredFocus={IS_TV}
              onPress={handleUpdateNow}
              style={({ focused }) => [styles.modalBtn, styles.modalBtnPrimary, focused && styles.modalBtnFocused]}
            >
              <Ionicons name="arrow-up-circle-outline" size={ms(16)} color="#050614" style={{ marginRight: 6 }} />
              <Text style={styles.modalBtnPrimaryTxt}>Update Now</Text>
            </Pressable>
            <Pressable
              focusable
              onPress={handleUpdateLater}
              style={({ focused }) => [styles.modalBtn, styles.modalBtnGhost, focused && styles.modalBtnGhostFocused]}
            >
              <Text style={styles.modalBtnGhostTxt}>Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0518", alignItems: "center", justifyContent: "center" },
  logo: { width: ms(IS_TV ? 110 : 80), height: ms(IS_TV ? 110 : 80), borderRadius: ms(20), marginBottom: vs(14) },
  brand: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(IS_TV ? 28 : 22), letterSpacing: 2.5, marginBottom: vs(32) },
  loadingMsg: { color: colors.zinc300, fontFamily: "Outfit_400Regular", fontSize: ms(IS_TV ? 16 : 14), letterSpacing: 0.4, marginBottom: vs(20) },
  dots: { flexDirection: "row", gap: ms(8) },
  dot: { width: ms(8), height: ms(8), borderRadius: 999 },

  // Full-screen update view
  updateBox: { alignItems: "center", paddingHorizontal: ms(40), marginTop: vs(20) },
  updateTitle: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: ms(IS_TV ? 18 : 15), textAlign: "center", marginBottom: vs(8) },
  updateSub: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: ms(IS_TV ? 14 : 12), textAlign: "center", marginBottom: vs(20) },
  progressBar: { height: 4, width: ms(220), borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)" },

  // Update prompt modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(6,7,20,0.92)", alignItems: "center", justifyContent: "center", padding: ms(24) },
  modalCard: {
    backgroundColor: "#150826", borderRadius: 24, padding: ms(28),
    borderWidth: 1, borderColor: "rgba(139,92,246,0.35)",
    maxWidth: ms(420), width: "100%", alignItems: "center",
    shadowColor: colors.purple, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20,
  },
  modalIconRow: { marginBottom: vs(16) },
  modalIconBox: { width: ms(60), height: ms(60), borderRadius: 999, backgroundColor: colors.cyan, alignItems: "center", justifyContent: "center" },
  modalTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(IS_TV ? 20 : 17), textAlign: "center", marginBottom: vs(10) },
  modalBody: { color: colors.zinc300, fontFamily: "Outfit_400Regular", fontSize: ms(IS_TV ? 14 : 12), textAlign: "center", marginBottom: vs(24), lineHeight: ms(IS_TV ? 22 : 18) },
  modalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: ms(24), paddingVertical: vs(12), borderRadius: 999, borderWidth: 2, width: "100%", marginBottom: vs(10) },
  modalBtnPrimary: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  modalBtnFocused: { transform: [{ scale: 1.04 }], shadowColor: colors.cyan, shadowOpacity: 0.8, shadowRadius: 14, elevation: 12 },
  modalBtnGhost: { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.18)" },
  modalBtnGhostFocused: { borderColor: colors.cyan },
  modalBtnPrimaryTxt: { color: "#050614", fontFamily: "Unbounded_700Bold", fontSize: ms(13) },
  modalBtnGhostTxt: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: ms(13) },
});
