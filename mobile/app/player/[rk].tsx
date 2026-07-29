import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import client, { colors } from "../../src/api";
import { SAFE, SIZES, ms, vs, IS_TV } from "../../src/responsive";

// ============================================================
// Player — resolves the stream URL from the backend, then
// hands it off to an external video player app installed on
// the device (VLC, MX Player, etc.).
// No built-in video playback — the user must have a compatible
// player installed on their Fire Stick / Android TV device.
// ============================================================

/** Launch the stream URL in whatever video-player the device has. */
async function launchExternalPlayer(url: string): Promise<"ok" | "no-player"> {
  if (Platform.OS === "android") {
    // Android / Fire TV: broadcast a VIEW intent for video.
    // Any installed video player (VLC, MX Player, Kodi, …) will handle it.
    const intent = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
    try {
      await Linking.openURL(intent);
      return "ok";
    } catch {
      // Intent failed — no player registered for video/*
      return "no-player";
    }
  }

  // iOS / other: try VLC scheme, then give up gracefully.
  const vlc = `vlc://${url}`;
  try {
    const supported = await Linking.canOpenURL(vlc);
    if (supported) {
      await Linking.openURL(vlc);
      return "ok";
    }
  } catch { /* ignore */ }
  return "no-player";
}

type Phase = "loading" | "launching" | "launched" | "no-player" | "error";

export default function Player() {
  const { rk, title } = useLocalSearchParams<{ rk: string; title: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setErrorMsg(null);
    setUrl(null);

    (async () => {
      try {
        const { data } = await client.get(`/stream/${rk}?direct=true`);
        if (cancelled) return;
        if (!data?.url || typeof data.url !== "string" || !data.url.length) {
          setErrorMsg("No stream URL returned by the server.");
          setPhase("error");
          return;
        }
        const streamUrl = data.url as string;
        setUrl(streamUrl);
        setPhase("launching");
        const result = await launchExternalPlayer(streamUrl);
        if (cancelled) return;
        if (result === "no-player") {
          setPhase("no-player");
        } else {
          setPhase("launched");
        }
      } catch (e: any) {
        if (cancelled) return;
        setErrorMsg(e?.response?.data?.detail || e?.message || "Could not retrieve stream.");
        setPhase("error");
      }
    })();

    return () => { cancelled = true; };
  }, [rk, retries]);

  const retry = () => setRetries((r) => r + 1);

  const relaunch = () => {
    if (url) {
      setPhase("launching");
      launchExternalPlayer(url).then((result) => {
        setPhase(result === "no-player" ? "no-player" : "launched");
      });
    }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0B0518", "#170634", "#0B0518"]} style={StyleSheet.absoluteFill} />

      {/* Back button */}
      <Pressable
        testID="player-back"
        onPress={() => router.back()}
        focusable
        hasTVPreferredFocus={phase !== "loading" && phase !== "launching"}
        style={({ focused }) => [
          s.backBtn,
          { top: SAFE.top + 10, left: SAFE.left + 10 },
          focused && s.backBtnFocused,
        ]}
      >
        <Ionicons name="chevron-back" size={SIZES.iconMd} color="#fff" />
      </Pressable>

      {/* Title */}
      <Text numberOfLines={2} style={[s.titleText, { top: SAFE.top + 12, left: ms(60) + SAFE.left, right: SAFE.right }]}>
        {title}
      </Text>

      {/* ---- Loading / resolving URL ---- */}
      {(phase === "loading" || phase === "launching") && (
        <View style={s.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
          <Text style={s.statusTitle}>
            {phase === "loading" ? "Resolving stream…" : "Launching player…"}
          </Text>
          <Text style={s.statusSub}>Handing off to your external video player.</Text>
        </View>
      )}

      {/* ---- Successfully launched ---- */}
      {phase === "launched" && (
        <View style={s.center}>
          <View style={s.iconCircle}>
            <Ionicons name="checkmark" size={ms(36)} color="#050614" />
          </View>
          <Text style={s.statusTitle}>Playing in External Player</Text>
          <Text style={s.statusSub}>
            Your video player app has opened. Switch to it using the Home button on your remote.
          </Text>
          <Pressable
            focusable
            hasTVPreferredFocus={IS_TV}
            onPress={relaunch}
            style={({ focused }) => [s.actionBtn, focused && s.actionBtnFocused]}
          >
            <Ionicons name="play-circle-outline" size={ms(18)} color={colors.cyan} />
            <Text style={s.actionBtnTxt}>Re-launch Player</Text>
          </Pressable>
          <Pressable
            focusable
            onPress={() => router.back()}
            style={({ focused }) => [s.ghostBtn, focused && s.ghostBtnFocused]}
          >
            <Text style={s.ghostBtnTxt}>Go Back</Text>
          </Pressable>
        </View>
      )}

      {/* ---- No external player installed ---- */}
      {phase === "no-player" && (
        <View style={s.center}>
          <View style={[s.iconCircle, { backgroundColor: colors.purple }]}>
            <Ionicons name="alert-circle-outline" size={ms(36)} color="#fff" />
          </View>
          <Text style={s.statusTitle}>No Video Player Found</Text>
          <Text style={s.statusSub}>
            You need a video player app installed on your Fire Stick to watch content.{"\n\n"}
            We recommend <Text style={{ color: colors.cyan, fontFamily: "Outfit_600SemiBold" }}>VLC for Fire</Text> or{" "}
            <Text style={{ color: colors.cyan, fontFamily: "Outfit_600SemiBold" }}>MX Player</Text> —
            both are free on the Amazon Appstore.
          </Text>
          <Pressable
            focusable
            hasTVPreferredFocus={IS_TV}
            onPress={() =>
              Linking.openURL("amzn://apps/android?s=vlc").catch(() =>
                Linking.openURL("https://www.amazon.com/s?k=VLC").catch(() => {})
              )
            }
            style={({ focused }) => [s.actionBtn, focused && s.actionBtnFocused]}
          >
            <Ionicons name="download-outline" size={ms(18)} color={colors.cyan} />
            <Text style={s.actionBtnTxt}>Get VLC from Appstore</Text>
          </Pressable>
          <Pressable
            focusable
            onPress={relaunch}
            style={({ focused }) => [s.ghostBtn, focused && s.ghostBtnFocused]}
          >
            <Text style={s.ghostBtnTxt}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {/* ---- Stream error ---- */}
      {phase === "error" && (
        <View style={s.center}>
          <Ionicons name="alert-circle" size={ms(42)} color="#fca5a5" />
          <Text style={s.errTitle}>Stream Unavailable</Text>
          <Text style={s.errMsg}>{errorMsg}</Text>
          <Pressable
            testID="player-retry"
            focusable
            hasTVPreferredFocus
            onPress={retry}
            style={({ focused }) => [s.actionBtn, focused && s.actionBtnFocused]}
          >
            <Ionicons name="refresh" size={ms(18)} color={colors.cyan} />
            <Text style={s.actionBtnTxt}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0518" },

  backBtn: {
    position: "absolute", zIndex: 10,
    width: ms(46), height: ms(46),
    borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(11,5,24,0.7)",
  },
  backBtnFocused: {
    borderColor: colors.cyan,
    shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 10, elevation: 8,
  },
  titleText: {
    position: "absolute", zIndex: 9,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Unbounded_700Bold",
    fontSize: SIZES.fontBody,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(IS_TV ? 80 : 32),
    paddingTop: vs(60),
  },

  iconCircle: {
    width: ms(72), height: ms(72), borderRadius: 999,
    backgroundColor: colors.cyan,
    alignItems: "center", justifyContent: "center",
    marginBottom: vs(18),
    shadowColor: colors.cyan, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  statusTitle: {
    color: "#fff",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(IS_TV ? 20 : 16),
    textAlign: "center",
    marginBottom: vs(10),
  },
  statusSub: {
    color: colors.zinc400,
    fontFamily: "Outfit_400Regular",
    fontSize: ms(IS_TV ? 14 : 12),
    textAlign: "center",
    lineHeight: ms(IS_TV ? 22 : 18),
    marginBottom: vs(28),
    maxWidth: ms(520),
  },

  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: ms(24), paddingVertical: vs(12),
    borderRadius: 999, borderWidth: 2, borderColor: colors.cyan,
    backgroundColor: "rgba(103,232,249,0.10)",
    marginBottom: vs(12),
    minWidth: ms(220), justifyContent: "center",
  },
  actionBtnFocused: {
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan, shadowOpacity: 0.7, shadowRadius: 14, elevation: 10,
  },
  actionBtnTxt: { color: colors.cyan, fontFamily: "Outfit_600SemiBold", fontSize: ms(IS_TV ? 15 : 13) },

  ghostBtn: {
    paddingHorizontal: ms(20), paddingVertical: vs(10),
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    minWidth: ms(160), alignItems: "center",
  },
  ghostBtnFocused: { borderColor: colors.cyan },
  ghostBtnTxt: { color: colors.zinc300, fontFamily: "Outfit_600SemiBold", fontSize: ms(IS_TV ? 14 : 12) },

  errTitle: {
    color: "#fca5a5",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(IS_TV ? 18 : 15),
    textAlign: "center",
    marginTop: vs(12),
    marginBottom: vs(8),
  },
  errMsg: {
    color: "rgba(252,165,165,0.75)",
    fontFamily: "Outfit_400Regular",
    fontSize: ms(IS_TV ? 13 : 11),
    textAlign: "center",
    marginBottom: vs(24),
  },
});
