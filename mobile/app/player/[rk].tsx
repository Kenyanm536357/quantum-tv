import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import client, { colors } from "../../src/api";
import { SAFE, SIZES, ms, vs, s as scale, IS_TV } from "../../src/responsive";
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

  // Custom playback controls — expo-video's `nativeControls` overlay is
  // touch-oriented and not reliably operable with a D-pad remote (no
  // visible/focusable play/pause or seek buttons on Android TV). We render
  // our own focusable control bar instead and drive it off the player API.
  const [isPlaying, setIsPlaying] = useState(true);
  const [, setTick] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = player.addListener("playingChange", (playing: boolean) => setIsPlaying(playing));
    return () => sub.remove();
  }, [player]);

  // Force a re-render every 500ms so the time display / progress bar
  // reflect the player's live currentTime (which isn't itself reactive).
  useEffect(() => {
    if (phase !== "in-app") return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [phase]);

  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 5000);
  };

  useEffect(() => {
    if (phase === "in-app") showControlsTemporarily();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const togglePlay = () => {
    showControlsTemporarily();
    if (player.playing) player.pause();
    else player.play();
  };
  const seek = (deltaSeconds: number) => {
    showControlsTemporarily();
    player.seekBy(deltaSeconds);
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const sec = Math.floor(secs % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const duration = player.duration || 0;
  const currentTime = player.currentTime || 0;
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

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
          nativeControls={false}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
      )}

      {/* Invisible full-screen target so a D-pad press/OK or a touch tap
          can bring the controls back once they've auto-hidden — without
          this, focus has nowhere to land and the controls are unreachable.
          Style must be a focus-aware function (not a plain object) or
          Android TV paints its default white focus-highlight full-screen. */}
      {phase === "in-app" && (
        <Pressable
          testID="player-surface"
          focusable
          hasTVPreferredFocus={!controlsVisible}
          onPress={showControlsTemporarily}
          onFocus={showControlsTemporarily}
          android_ripple={{ color: "transparent", borderless: true }}
          style={() => [StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
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

      {(phase === "in-app" ? controlsVisible : true) && (
        <LinearGradient
          colors={["rgba(5,3,15,0.85)", "transparent"]}
          style={[s.topScrim, { height: SAFE.top + vs(90) }]}
          pointerEvents="none"
        />
      )}

      <Text
        numberOfLines={2}
        style={[s.titleText, { top: SAFE.top + 12, left: ms(60) + SAFE.left, right: SAFE.right }]}
      >
        {title}
      </Text>

      {phase === "in-app" && controlsVisible && (
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
            { top: SAFE.top + 10, right: SAFE.right + 10 },
            focused && s.actionBtnFocused,
          ]}
        >
          <Ionicons name="swap-horizontal-outline" size={ms(16)} color={colors.cyan} />
          <Text style={s.actionBtnTxt}>External Player</Text>
        </Pressable>
      )}

      {phase === "in-app" && (
        <LinearGradient
          colors={["transparent", "rgba(5,3,15,0.55)", "rgba(5,3,15,0.95)"]}
          locations={[0, 0.4, 1]}
          style={[s.bottomScrim, { height: SAFE.bottom + vs(200), opacity: controlsVisible ? 1 : 0 }]}
          pointerEvents="none"
        />
      )}

      {phase === "in-app" && controlsVisible && (
        <View style={[s.controlBar, { bottom: SAFE.bottom + vs(16), left: SAFE.left + scale(24), right: SAFE.right + scale(24) }]}>
          <View style={s.progressRow}>
            <Text style={s.timeText}>{formatTime(currentTime)}</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={s.timeText}>{formatTime(duration)}</Text>
          </View>
          <View style={s.transportRow}>
            <Pressable
              testID="player-rewind"
              focusable
              onFocus={showControlsTemporarily}
              onPress={() => seek(-10)}
              style={({ focused }) => [s.transportBtn, focused && s.actionBtnFocused]}
            >
              <Ionicons name="play-back" size={ms(22)} color="#fff" />
            </Pressable>
            <Pressable
              testID="player-play-pause"
              focusable
              hasTVPreferredFocus
              onFocus={showControlsTemporarily}
              onPress={togglePlay}
              style={({ focused }) => [s.transportBtnPrimary, focused && s.actionBtnFocused]}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={ms(28)} color="#050614" />
            </Pressable>
            <Pressable
              testID="player-forward"
              focusable
              onFocus={showControlsTemporarily}
              onPress={() => seek(10)}
              style={({ focused }) => [s.transportBtn, focused && s.actionBtnFocused]}
            >
              <Ionicons name="play-forward" size={ms(22)} color="#fff" />
            </Pressable>
          </View>
        </View>
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
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Unbounded_700Bold",
    fontSize: SIZES.fontBody,
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 8,
  },
  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 8,
  },
  switchBtn: {
    position: "absolute",
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: vs(8),
    paddingHorizontal: ms(14),
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(11,5,24,0.7)",
  },
  controlBar: {
    position: "absolute",
    zIndex: 11,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(10),
    marginBottom: vs(18),
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cyan,
  },
  timeText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Outfit_500Medium",
    fontSize: ms(12),
    minWidth: ms(40),
    textAlign: "center",
  },
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: ms(24),
  },
  transportBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  transportBtnPrimary: {
    width: ms(58),
    height: ms(58),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cyan,
    borderWidth: 2,
    borderColor: "transparent",
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
