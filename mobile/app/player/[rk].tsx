import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import client, { colors } from "../../src/api";
import { SAFE, SIZES, ms, vs, IS_TV } from "../../src/responsive";
import {
  launchExternalPlayer,
  openPlayerStore,
  probeInstalledPlayers,
  type PlayerProbe,
} from "../../src/externalPlayer";

// ============================================================
// Player — plays the stream with the built-in high-quality
// in-app player (expo-video) first. Only if that player reports
// an error do we fall back to probing/launching an installed
// external player (VLC, MX Player, etc.) on the device.
// ============================================================

type Phase =
  | "loading"
  | "in-app"
  | "checking-player"
  | "launching"
  | "launched"
  | "no-player"
  | "error";

export default function Player() {
  const { rk, title } = useLocalSearchParams<{ rk: string; title: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [players, setPlayers] = useState<PlayerProbe[]>([]);
  const [launchMethod, setLaunchMethod] = useState<string | null>(null);
  const [playerLabel, setPlayerLabel] = useState<string | null>(null);
  const fellBackRef = useRef(false);

  const player = useVideoPlayer(url ?? null, (p) => {
    p.play();
  });

  // Runs the external-player probe/launch flow. Used both as the initial
  // fallback when the in-app player errors, and when the user manually
  // asks to switch players.
  const fallbackToExternal = async (cancelledRef: { current: boolean }) => {
    try {
      const { data } = await client.get(`/stream/${rk}`, {
        params: { direct: "true", external: "true" },
      });
      if (cancelledRef.current) return;
      if (!data?.url || typeof data.url !== "string" || !data.url.length) {
        setErrorMsg("No stream URL returned by the server.");
        setPhase("error");
        return;
      }
      const streamUrl = data.url as string;
      setDirectUrl(streamUrl);

      setPhase("checking-player");
      const probed = await probeInstalledPlayers();
      if (cancelledRef.current) return;
      setPlayers(probed);

      setPhase("launching");
      const result = await launchExternalPlayer(streamUrl);
      if (cancelledRef.current) return;
      if (!result.ok) {
        setPhase("no-player");
        return;
      }
      setLaunchMethod(result.method);
      setPlayerLabel(result.playerLabel || null);
      setPhase("launched");
    } catch (e: any) {
      if (cancelledRef.current) return;
      setErrorMsg(e?.response?.data?.detail || e?.message || "Could not retrieve stream.");
      setPhase("error");
    }
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    fellBackRef.current = false;
    setPhase("loading");
    setErrorMsg(null);
    setUrl(null);
    setDirectUrl(null);
    setLaunchMethod(null);
    setPlayerLabel(null);

    (async () => {
      try {
        // Built-in player uses the app-proxied URL (works reliably in-app
        // and keeps auth/HLS-rewriting on our side).
        const { data } = await client.get(`/stream/${rk}`, {
          params: { direct: "false", external: "false" },
        });
        if (cancelledRef.current) return;
        if (!data?.url || typeof data.url !== "string" || !data.url.length) {
          // No proxied URL available — go straight to external player flow.
          await fallbackToExternal(cancelledRef);
          return;
        }
        setUrl(data.url as string);
        setPhase("in-app");
      } catch {
        if (cancelledRef.current) return;
        // Proxy resolution failed — try the external player flow instead.
        await fallbackToExternal(cancelledRef);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [rk, retries]);

  // If the built-in player reports an error, fall back to an installed
  // external player exactly once per attempt.
  useEffect(() => {
    const sub = player.addListener("statusChange", (status: VideoPlayerStatus) => {
      if (status === "error" && !fellBackRef.current) {
        fellBackRef.current = true;
        const cancelledRef = { current: false };
        fallbackToExternal(cancelledRef);
      }
    });
    return () => sub.remove();
  }, [player, rk]);

  const retry = () => setRetries((r) => r + 1);

  const relaunch = async () => {
    if (!directUrl) return;
    setPhase("launching");
    const result = await launchExternalPlayer(directUrl);
    if (!result.ok) {
      setPhase("no-player");
      return;
    }
    setLaunchMethod(result.method);
    setPlayerLabel(result.playerLabel || null);
    setPhase("launched");
  };

  const knownInstalled = players.filter((p) => p.installed === true);

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0B0518", "#170634", "#0B0518"]} style={StyleSheet.absoluteFill} />

      {phase === "in-app" && (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
      )}

      <Pressable
        testID="player-back"
        onPress={() => router.back()}
        focusable
        hasTVPreferredFocus={phase !== "loading" && phase !== "launching" && phase !== "checking-player"}
        style={({ focused }) => [
          s.backBtn,
          { top: SAFE.top + 10, left: SAFE.left + 10 },
          focused && s.backBtnFocused,
        ]}
      >
        <Ionicons name="chevron-back" size={SIZES.iconMd} color="#fff" />
      </Pressable>

      <Text
        numberOfLines={2}
        style={[s.titleText, { top: SAFE.top + 12, left: ms(60) + SAFE.left, right: SAFE.right }]}
      >
        {title}
      </Text>

      {phase === "in-app" && (
        <Pressable
          testID="player-switch-external"
          focusable
          onPress={() => {
            const cancelledRef = { current: false };
            setPhase("checking-player");
            fallbackToExternal(cancelledRef);
          }}
          style={({ focused }) => [
            s.switchBtn,
            { bottom: SAFE.bottom + 16, right: SAFE.right + 16 },
            focused && s.actionBtnFocused,
          ]}
        >
          <Ionicons name="swap-horizontal-outline" size={ms(16)} color={colors.cyan} />
          <Text style={s.actionBtnTxt}>Use External Player</Text>
        </Pressable>
      )}

      {(phase === "loading" || phase === "launching" || phase === "checking-player") && (
        <View style={s.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
          <Text style={s.statusTitle}>
            {phase === "loading"
              ? "Resolving stream…"
              : phase === "checking-player"
                ? "Checking installed players…"
                : "Launching player…"}
          </Text>
          <Text style={s.statusSub}>
            {phase === "checking-player"
              ? "Running a quick system check for VLC, MX Player, and other apps."
              : "Handing off to your external video player."}
          </Text>
        </View>
      )}

      {phase === "launched" && (
        <View style={s.center}>
          <View style={s.iconCircle}>
            <Ionicons name="checkmark" size={ms(36)} color="#050614" />
          </View>
          <Text style={s.statusTitle}>Playing in External Player</Text>
          <Text style={s.statusSub}>
            {playerLabel
              ? `Opened with ${playerLabel}.`
              : "Your video player app has opened."}
            {"\n"}
            Use your remote Home/Apps button if it is behind Quantum TV.
            {launchMethod ? `\nMethod: ${launchMethod}` : ""}
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

      {phase === "no-player" && (
        <ScrollView contentContainerStyle={s.centerScroll}>
          <View style={[s.iconCircle, { backgroundColor: colors.purple }]}>
            <Ionicons name="alert-circle-outline" size={ms(36)} color="#fff" />
          </View>
          <Text style={s.statusTitle}>Could Not Open a Video Player</Text>
          <Text style={s.statusSub}>
            System check could not hand the stream to an installed player.
            {"\n\n"}
            If VLC / MX Player is installed, press Try Launch Again.
            On Fire TV, open that player once from Apps so Android can unlock it.
          </Text>

          {knownInstalled.length > 0 ? (
            <Text style={s.probeOk}>Detected: {knownInstalled.map((p) => p.label).join(", ")}</Text>
          ) : (
            <Text style={s.probeWarn}>
              No known player package was confirmed yet. Quantum TV will still try VLC, MX Player, Kodi, and others.
            </Text>
          )}

          <Pressable
            focusable
            hasTVPreferredFocus={IS_TV}
            onPress={relaunch}
            style={({ focused }) => [s.actionBtn, focused && s.actionBtnFocused]}
          >
            <Ionicons name="play-circle-outline" size={ms(18)} color={colors.cyan} />
            <Text style={s.actionBtnTxt}>Try Launch Again</Text>
          </Pressable>
          <Pressable
            focusable
            onPress={() => openPlayerStore("vlc")}
            style={({ focused }) => [s.actionBtn, focused && s.actionBtnFocused]}
          >
            <Ionicons name="download-outline" size={ms(18)} color={colors.cyan} />
            <Text style={s.actionBtnTxt}>Get VLC</Text>
          </Pressable>
          <Pressable
            focusable
            onPress={() => openPlayerStore("mx")}
            style={({ focused }) => [s.ghostBtn, focused && s.ghostBtnFocused]}
          >
            <Text style={s.ghostBtnTxt}>Get MX Player</Text>
          </Pressable>
          <Pressable
            focusable
            onPress={retry}
            style={({ focused }) => [s.ghostBtn, focused && s.ghostBtnFocused]}
          >
            <Text style={s.ghostBtnTxt}>Re-check System</Text>
          </Pressable>
        </ScrollView>
      )}

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
    position: "absolute",
    zIndex: 10,
    width: ms(46),
    height: ms(46),
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,5,24,0.7)",
  },
  backBtnFocused: {
    borderColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  titleText: {
    position: "absolute",
    zIndex: 9,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Unbounded_700Bold",
    fontSize: SIZES.fontBody,
  },
  switchBtn: {
    position: "absolute",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: vs(10),
    paddingHorizontal: ms(16),
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(11,5,24,0.7)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(IS_TV ? 80 : 32),
    paddingTop: vs(60),
  },
  centerScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ms(IS_TV ? 80 : 32),
    paddingTop: vs(80),
    paddingBottom: vs(40),
  },
  iconCircle: {
    width: ms(72),
    height: ms(72),
    borderRadius: 999,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(18),
    shadowColor: colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
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
    marginBottom: vs(20),
    maxWidth: ms(560),
  },
  probeOk: {
    color: colors.cyan,
    fontFamily: "Outfit_600SemiBold",
    fontSize: ms(12),
    marginBottom: vs(14),
    textAlign: "center",
  },
  probeWarn: {
    color: colors.zinc400,
    fontFamily: "Outfit_400Regular",
    fontSize: ms(12),
    marginBottom: vs(14),
    textAlign: "center",
    maxWidth: ms(520),
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: ms(24),
    paddingVertical: vs(12),
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.cyan,
    backgroundColor: "rgba(103,232,249,0.10)",
    marginBottom: vs(12),
    minWidth: ms(220),
    justifyContent: "center",
  },
  actionBtnFocused: {
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
  },
  actionBtnTxt: {
    color: colors.cyan,
    fontFamily: "Outfit_600SemiBold",
    fontSize: ms(IS_TV ? 15 : 13),
  },
  ghostBtn: {
    paddingHorizontal: ms(20),
    paddingVertical: vs(10),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    minWidth: ms(160),
    alignItems: "center",
    marginBottom: vs(10),
  },
  ghostBtnFocused: { borderColor: colors.cyan },
  ghostBtnTxt: {
    color: colors.zinc300,
    fontFamily: "Outfit_600SemiBold",
    fontSize: ms(IS_TV ? 14 : 12),
  },
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
