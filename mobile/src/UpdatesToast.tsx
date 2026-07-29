import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, AppState, AppStateStatus, Animated } from "react-native";
import * as Updates from "expo-updates";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./api";
import { ms, s, vs, SAFE, IS_TV } from "./responsive";
import {
  OTA_CHECK_TIMEOUT_MS,
  checkDownloadAndApply,
  withTimeout,
} from "./ota";

const PERIODIC_CHECK_MS = 5 * 60 * 1000; // backup agent every 5 minutes

/**
 * UpdatesToast — backup agent that periodically checks the Expo update
 * service in the background (on mount, on foreground resume, and on an
 * interval). Never blocks navigation. Shows a focusable banner only when
 * an update is confirmed available.
 */
export default function UpdatesToast() {
  const [available, setAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [statusText, setStatusText] = useState("A newer build of Quantum TV is ready.");
  const checkingRef = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const check = useCallback(async () => {
    // Skip in Expo Go / dev — Updates.checkForUpdateAsync throws there.
    if (!Updates.isEnabled || checkingRef.current || installing) return;
    checkingRef.current = true;
    try {
      const res = await withTimeout(
        Updates.checkForUpdateAsync(),
        OTA_CHECK_TIMEOUT_MS,
        "checkForUpdateAsync",
      );
      if (res.isAvailable) {
        setAvailable(true);
        setDismissed(false);
        setStatusText("A newer build of Quantum TV is ready.");
      }
    } catch {
      /* timeout / offline / no eas config — silent backup check */
    } finally {
      checkingRef.current = false;
    }
  }, [installing]);

  // Initial check + periodic backup agent + foreground resume
  useEffect(() => {
    check();
    const interval = setInterval(() => {
      check();
    }, PERIODIC_CHECK_MS);
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") check();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [check]);

  // Fade the banner in / out based on visibility
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: available && !dismissed ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [available, dismissed, opacity]);

  const install = useCallback(async () => {
    if (installing) return;
    setInstalling(true);
    setStatusText("Downloading & restarting…");
    const result = await checkDownloadAndApply({
      apply: true,
      onStatus: (msg) => setStatusText(msg),
    });
    if (!result.applied) {
      setInstalling(false);
      setStatusText(result.message || "Update failed. Try again.");
    }
  }, [installing]);

  if (!available || dismissed) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { opacity }]}>
      <View style={styles.card} testID="updates-toast">
        <View style={styles.iconDot}>
          <Ionicons name="cloud-download-outline" size={ms(18)} color="#050614" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            Update available
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {statusText}
          </Text>
        </View>
        <Pressable
          testID="updates-toast-install"
          focusable
          hasTVPreferredFocus={IS_TV}
          disabled={installing}
          onPress={install}
          style={({ focused }) => [
            styles.btn,
            styles.btnPrimary,
            focused && { borderColor: "#fff", transform: [{ scale: 1.04 }] },
          ]}
        >
          <Text style={styles.btnPrimaryTxt}>{installing ? "…" : "Install"}</Text>
        </Pressable>
        <Pressable
          testID="updates-toast-later"
          focusable
          disabled={installing}
          onPress={() => setDismissed(true)}
          style={({ focused }) => [
            styles.btn,
            styles.btnGhost,
            focused && { borderColor: colors.cyan },
          ]}
        >
          <Text style={styles.btnGhostTxt}>Later</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: SAFE.top + vs(8),
    right: SAFE.right + s(12),
    zIndex: 9999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
    borderRadius: 999,
    backgroundColor: "rgba(6,7,20,0.94)",
    borderWidth: 2,
    borderColor: colors.cyan,
    maxWidth: s(430),
    shadowColor: colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  iconDot: {
    width: ms(28),
    height: ms(28),
    borderRadius: 999,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(13),
  },
  body: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Outfit_400Regular",
    fontSize: ms(11),
    marginTop: 1,
  },
  btn: {
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    borderRadius: 999,
    borderWidth: 2,
  },
  btnPrimary: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  btnPrimaryTxt: {
    color: "#050614",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(12),
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.20)",
  },
  btnGhostTxt: {
    color: "#fff",
    fontFamily: "Outfit_600SemiBold",
    fontSize: ms(12),
  },
});
