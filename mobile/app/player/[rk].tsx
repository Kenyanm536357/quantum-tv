import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import client, { colors } from "../../src/api";

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
      <Pressable testID="player-back" onPress={() => router.back()} style={s.back}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>
      <Text numberOfLines={1} style={s.title}>{title}</Text>

      {!url && !error && (
        <View style={s.center}><ActivityIndicator color={colors.cyan} /><Text style={s.loading}>Preparing stream…</Text></View>
      )}
      {error && (
        <View style={s.center}><Ionicons name="alert-circle" size={42} color="#fca5a5" /><Text style={s.err}>{error}</Text></View>
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
  back: { position: "absolute", top: 50, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  title: { position: "absolute", top: 56, left: 70, right: 20, zIndex: 10, color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: 16 },
  video: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { color: colors.zinc400, marginTop: 12, fontFamily: "Outfit_400Regular" },
  err: { color: "#fca5a5", marginTop: 12, fontFamily: "Outfit_400Regular", textAlign: "center", paddingHorizontal: 30 },
});
