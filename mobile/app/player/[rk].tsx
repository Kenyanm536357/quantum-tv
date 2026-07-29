import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import client, { colors } from "../../src/api";
import { SAFE, SIZES, ms, IS_TV } from "../../src/responsive";

export default function Player() {
  const { rk, title } = useLocalSearchParams<{ rk: string; title: string }>();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsHideTimer = useRef<NodeJS.Timeout | null>(null);

  // expo-video: useVideoPlayer is reactive — when `url` changes, the player
  // is updated with the new source. We start with null (no playback) and
  // swap to the real URL once the backend tells us where to stream from.
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });

  // Resolve the stream URL from the backend. `direct=true` first tries a
  // raw MP4 (no transcode, lowest latency, biggest device-compat surface);
  // backend transparently falls back to HLS if direct isn't possible.
  useEffect(() => {
    let cancelled = false;
    setUrl(null); 
    setError(null);
    setIsPlaying(false);
    setShowControls(true);

    (async () => {
      try {
        const { data } = await client.get(`/stream/${rk}?direct=true`);
        // Validate URL before setting it
        if (!cancelled && data?.url && typeof data.url === 'string' && data.url.length > 0) {
          setUrl(data.url);
        } else if (!cancelled) {
          setError("Invalid stream URL received from server.");
        }
      } catch (e: any) {
        if (!cancelled) {
          const errorMsg = e?.response?.data?.detail || e?.message || "Could not start stream.";
          setError(errorMsg);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [rk, retries]);

  // Surface native player errors (codec unsupported, network drop, …)
  useEffect(() => {
    const sub = player.addListener("statusChange", (status: string, _oldStatus: string, error: any) => {
      if (status === "error") {
        const msg = error?.message || "Playback error";
        setError(msg);
        setIsPlaying(false);
        setShowControls(true); // Show controls so user can retry
      } else if (status === "playing") {
        // Clear any previous errors when playback succeeds
        setError(null);
        setIsPlaying(true);
        // Auto-hide controls after 3 seconds when playing
        if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
        controlsHideTimer.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      } else if (status === "paused" || status === "idle") {
        setIsPlaying(false);
        if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
        setShowControls(true);
      }
    });
    return () => sub.remove();
  }, [player]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
    };
  }, []);

  const retry = () => { setError(null); setRetries((r) => r + 1); };

  const handleVideoTap = () => {
    setShowControls(true);
    if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
    controlsHideTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <View style={s.root}>
      {showControls && (
        <Pressable
          testID="player-back"
          onPress={() => router.back()}
          focusable
          hasTVPreferredFocus={!error}
          style={({ focused }) => [s.backBtn, { top: SAFE.top + 10, left: SAFE.left + 6, width: ms(46), height: ms(46), borderColor: focused ? colors.cyan : "transparent" }]}
        >
          <Ionicons name="chevron-back" size={SIZES.iconMd} color="#fff" />
        </Pressable>
      )}
      {showControls && (
        <Text numberOfLines={1} style={[s.title, { fontSize: SIZES.fontBody, top: SAFE.top + 16, left: ms(70) + SAFE.left, right: SAFE.right }]}>{title}</Text>
      )}

      {!url && !error && (
        <View style={s.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
          <Text style={[s.loading, { fontSize: SIZES.fontSmall }]}>Preparing stream…</Text>
        </View>
      )}

      {error && (
        <View style={s.center}>
          <Ionicons name="alert-circle" size={ms(42)} color="#fca5a5" />
          <Text style={[s.err, { fontSize: SIZES.fontSmall }]}>{error}</Text>
          <Pressable
            testID="player-retry"
            onPress={retry}
            focusable
            hasTVPreferredFocus
            style={({ focused }) => [s.retry, { borderColor: focused ? colors.cyan : "rgba(255,255,255,0.12)" }]}
          >
            <Ionicons name="refresh" size={ms(18)} color="#fff" />
            <Text style={[s.retryText, { fontSize: SIZES.fontSmall }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      {url && !error && (
        <Pressable 
          style={s.video}
          onPress={handleVideoTap}
        >
          <VideoView
            player={player}
            style={s.video}
            contentFit="contain"
            allowsFullscreen
            allowsPictureInPicture={!IS_TV}
            nativeControls
            // Fire TV: D-pad center triggers play/pause via the native controls.
            // Long-press left/right scrubs. We keep nativeControls=true so that
            // the OS-level remote handlers attach automatically.
          />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  backBtn: { position: "absolute", zIndex: 10, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 2 },
  title: { position: "absolute", zIndex: 10, color: "#fff", fontFamily: "Unbounded_700Bold" },
  video: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  loading: { color: colors.zinc400, marginTop: 12, fontFamily: "Outfit_400Regular" },
  err: { color: "#fca5a5", marginTop: 12, fontFamily: "Outfit_400Regular", textAlign: "center" },
  retry: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  retryText: { color: "#fff", fontFamily: "Outfit_600SemiBold" },
});
