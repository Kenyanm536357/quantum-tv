import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import client, { colors } from "../../src/api";
import { SAFE, SIZES, ms } from "../../src/responsive";

export default function Player() {
  const { rk, title } = useLocalSearchParams<{ rk: string; title: string }>();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useVideoPlayer(url ?? "", (p) => { p.loop = false; p.play(); });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.get(`/stream/${rk}?direct=true`);
        setUrl(data.url);
      } catch (e: any) { setError(e?.response?.data?.detail || "Could not start stream."); }
    })();
  }, [rk]);

  return (
    <View style={s.root}>
      <Pressable
        testID="player-back"
        onPress={() => router.back()}
        focusable
        hasTVPreferredFocus
        style={({ focused }) => [{ position: "absolute", top: SAFE.top + 10, left: SAFE.left + 6, zIndex: 10, width: ms(46), height: ms(46), borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 2, borderColor: focused ? colors.cyan : "transparent" }]}
      >
        <Ionicons name="chevron-back" size={SIZES.iconMd} color="#fff" />
      </Pressable>
      <Text numberOfLines={1} style={[s.title, { fontSize: SIZES.fontBody, top: SAFE.top + 16, left: ms(70) + SAFE.left, right: SAFE.right }]}>{title}</Text>

      {!url && !error && (
        <View style={s.center}><ActivityIndicator color={colors.cyan} size="large" /><Text style={[s.loading, { fontSize: SIZES.fontSmall }]}>Preparing stream…</Text></View>
      )}
      {error && (
        <View style={s.center}><Ionicons name="alert-circle" size={ms(42)} color="#fca5a5" /><Text style={[s.err, { fontSize: SIZES.fontSmall }]}>{error}</Text></View>
      )}
      {url && (
        <VideoView
          player={player}
          style={s.video}
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  title: { position: "absolute", zIndex: 10, color: "#fff", fontFamily: "Unbounded_700Bold" },
  video: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { color: colors.zinc400, marginTop: 12, fontFamily: "Outfit_400Regular" },
  err: { color: "#fca5a5", marginTop: 12, fontFamily: "Outfit_400Regular", textAlign: "center", paddingHorizontal: 30 },
});
