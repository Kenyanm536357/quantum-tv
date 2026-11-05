import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions, useTVEventHandler } from "react-native";
import { getAdjacentChannel } from "../../src/channelContext";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import client, { colors } from "../../src/api";
import { SAFE, SIZES, ms, vs, s as scale, IS_TV } from "../../src/responsive";

// ============================================================
// Player — plays the stream with the built-in in-app player
// (expo-video). On error a retry screen is shown; live channels
// auto-reconnect.
// ============================================================

type Phase =
  | "loading"
  | "in-app"
  | "error";

export default function Player() {
  useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(SAFE.top, insets.top + vs(8));
  const { rk, title } = useLocalSearchParams<{ rk: string; title: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const fellBackRef = useRef(false);
  const triedTransportStreamRef = useRef(false);
  const resumeAppliedRef = useRef(false);
  const progressSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resumeMs, setResumeMs] = useState<number>(0);

  const player = useVideoPlayer(url ?? null, (p) => {
    p.play();
  });

  const ratingKey = String(rk || "");
  const isLiveKey = ratingKey.startsWith("iptv-live-");
  useKeepAwake();

  // Live streams never give up: on error/end/stall, reconnect after a short delay.
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconnect = () => {
    if (reconnectTimer.current) return;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      setRetries((r) => r + 1);
    }, 4000);
  };
  useEffect(() => () => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
  }, [rk]);
  const canTrackProgress = /^(iptv-(movie|ep)-)/.test(ratingKey);

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

  const saveProgress = async () => {
    if (!canTrackProgress || phase !== "in-app") return;
    const positionMs = Math.max(0, Math.floor((player.currentTime || 0) * 1000));
    const durationMs = Math.max(0, Math.floor((player.duration || 0) * 1000));
    if (positionMs < 5000) return;
    try {
      await client.post("/me/progress", {
        rating_key: ratingKey,
        position_ms: positionMs,
        duration_ms: durationMs,
        title: String(title || ""),
        media_type: ratingKey.startsWith("iptv-ep-") ? "episode" : "movie",
      });
    } catch {
      // Best-effort persistence — ignore transient network failures.
    }
  };

  useEffect(() => {
    resumeAppliedRef.current = false;
    setResumeMs(0);
    if (!canTrackProgress) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await client.get(`/me/progress/${encodeURIComponent(ratingKey)}`);
        if (cancelled) return;
        setResumeMs(Math.max(0, Number(data?.position_ms || 0)));
      } catch {
        if (!cancelled) setResumeMs(0);
      }
    })();
    return () => { cancelled = true; };
  }, [canTrackProgress, ratingKey]);

  useEffect(() => {
    if (!canTrackProgress || phase !== "in-app") return;
    if (resumeAppliedRef.current) return;
    if (resumeMs < 10_000) {
      resumeAppliedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      if (resumeAppliedRef.current) return;
      const targetSec = resumeMs / 1000;
      const delta = targetSec - (player.currentTime || 0);
      if (delta > 1) player.seekBy(delta);
      resumeAppliedRef.current = true;
    }, 1200);
    return () => clearTimeout(timer);
  }, [canTrackProgress, phase, player, resumeMs]);

  useEffect(() => {
    if (progressSaveTimerRef.current) {
      clearInterval(progressSaveTimerRef.current);
      progressSaveTimerRef.current = null;
    }
    if (!canTrackProgress || phase !== "in-app") return;
    progressSaveTimerRef.current = setInterval(() => {
      saveProgress();
    }, 12_000);
    return () => {
      if (progressSaveTimerRef.current) {
        clearInterval(progressSaveTimerRef.current);
        progressSaveTimerRef.current = null;
      }
      saveProgress();
    };
  }, [canTrackProgress, phase]);

  const showStreamError = (message: string) => {
    setErrorMsg(message);
    setPhase("error");
  };

  useEffect(() => {
    const cancelledRef = { current: false };
    fellBackRef.current = false;
    triedTransportStreamRef.current = false;
    setPhase("loading");
    setErrorMsg(null);
    setUrl(null);

    (async () => {
      try {
        // Built-in player uses the app-proxied URL (works reliably in-app
        // and keeps auth/HLS-rewriting on our side).
        const { data } = await client.get(`/stream/${rk}`, {
          params: { direct: "false", external: "false" },
        });
        if (cancelledRef.current) return;
        if (!data?.url || typeof data.url !== "string" || !data.url.length) {
          if (isLiveKey) { scheduleReconnect(); return; }
          showStreamError("No stream URL returned by the server.");
          return;
        }
        setUrl(data.url as string);
        setPhase("in-app");
      } catch {
        if (cancelledRef.current) return;
        if (isLiveKey) { scheduleReconnect(); return; }
        showStreamError("Could not retrieve stream.");
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [rk, retries]);

  const giveUp = () => {
    if (isLiveKey) { scheduleReconnect(); return; }
    fellBackRef.current = true;
    showStreamError("The video could not be played.");
  };
  useEffect(() => {
    const sub = player.addListener("statusChange", (status: VideoPlayerStatus) => {
      if (status === "error" && !fellBackRef.current) {
        const canRetryWithTs = String(rk || "").startsWith("iptv-live-") && !triedTransportStreamRef.current;
        if (canRetryWithTs) {
          triedTransportStreamRef.current = true;
          setPhase("loading");
          client.get(`/stream/${rk}`, {
            params: { direct: "false", external: "false", live_format: "ts" },
          }).then((response: { data: { url?: unknown } }) => {
            const { data } = response;
            if (data?.url && typeof data.url === "string") {
              setUrl(data.url);
              setPhase("in-app");
            } else {
              giveUp();
            }
          }).catch(() => {
            giveUp();
          });
          return;
        }
        giveUp();
      }
    });
    return () => sub.remove();
  }, [player, rk]);

  const retry = () => setRetries((r) => r + 1);

  // Stall watchdog + end-of-stream recovery for live channels.
  useEffect(() => {
    if (!isLiveKey || phase !== "in-app") return;
    let lastTime = -1;
    let lastChange = Date.now();
    const id = setInterval(() => {
      const t = player.currentTime || 0;
      if (t !== lastTime || !player.playing) { lastTime = t; lastChange = Date.now(); return; }
      if (Date.now() - lastChange > 25000) { lastChange = Date.now(); scheduleReconnect(); }
    }, 3000);
    const endSub = player.addListener("playToEnd", () => scheduleReconnect());
    return () => { clearInterval(id); endSub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveKey, phase, player]);

  // Channel surfing: D-pad up/down (or remote channel keys) switch to the
  // previous/next channel of the list the user came from.
  const isLive = String(rk || "").startsWith("iptv-live-");
  const surf = (dir: 1 | -1) => {
    const next = getAdjacentChannel(String(rk || ""), dir);
    if (!next) return;
    saveProgress();
    client.post("/me/live/recent", { key: next.key, title: next.title }).catch(() => {});
    router.setParams({ rk: next.key, title: next.title });
  };
  const surfRef = useRef(surf);
  surfRef.current = surf;
  useTVEventHandler((evt: any) => {
    if (!isLive || !evt || evt.eventKeyAction === 0) return;
    if (evt.eventType === "up" || evt.eventType === "channelUp") surfRef.current(-1);
    else if (evt.eventType === "down" || evt.eventType === "channelDown") surfRef.current(1);
  });

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
          Android TV paints its default white focus-highlight full-screen.
          IMPORTANT: only show controls on an actual onPress, NOT onFocus —
          when controls hide, this surface becomes the preferred focus
          target (below) so the OS auto-focuses it, which fired onFocus
          immediately and re-showed the controls right after hiding them,
          an infinite show/hide loop that made auto-hide look totally
          broken. Gaining focus programmatically must not count as a
          "wake up" gesture, only an explicit press does. */}
      {phase === "in-app" && (
        <Pressable
          testID="player-surface"
          focusable
          hasTVPreferredFocus={!controlsVisible}
          onPress={showControlsTemporarily}
          android_ripple={{ color: "transparent", borderless: true }}
          style={() => [StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}
        />
      )}

      <Pressable
        testID="player-back"
        onPress={() => { saveProgress(); router.back(); }}
        focusable
        hasTVPreferredFocus={phase !== "loading"}
        style={({ focused }) => [
          s.backBtn,
          { top: safeTop + 10, left: SAFE.left + 10 },
          focused && s.backBtnFocused,
        ]}
      >
        <Ionicons name="chevron-back" size={SIZES.iconMd} color="#fff" />
      </Pressable>

      {(phase === "in-app" ? controlsVisible : true) && (
        <LinearGradient
          colors={["rgba(5,3,15,0.85)", "transparent"]}
          style={[s.topScrim, { height: safeTop + vs(90) }]}
          pointerEvents="none"
        />
      )}

      <Text
        numberOfLines={2}
        style={[s.titleText, { top: safeTop + 12, left: ms(60) + SAFE.left, right: SAFE.right }]}
      >
        {title}
      </Text>

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
            {isLive && (
              <Pressable
                testID="player-ch-prev"
                focusable
                onFocus={showControlsTemporarily}
                onPress={() => surf(-1)}
                style={({ focused }) => [s.transportBtn, focused && s.actionBtnFocused]}
              >
                <Ionicons name="chevron-up" size={ms(22)} color="#fff" />
              </Pressable>
            )}
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
            {isLive && (
              <Pressable
                testID="player-ch-next"
                focusable
                onFocus={showControlsTemporarily}
                onPress={() => surf(1)}
                style={({ focused }) => [s.transportBtn, focused && s.actionBtnFocused]}
              >
                <Ionicons name="chevron-down" size={ms(22)} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {phase === "loading" && (
        <View style={s.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
          <Text style={s.statusTitle}>{isLiveKey && retries >= 2 ? "Reconnecting…" : "Resolving stream…"}</Text>
          {isLiveKey && retries >= 2 ? (
            <Text style={s.statusSub}>
              This channel isn't responding yet. Event and PPV channels (like FloSports) only stream while an event is live. Retrying automatically.
            </Text>
          ) : null}
        </View>
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
