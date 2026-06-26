import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";

export default function LiveTV() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await client.get("/livetv/channels")).data,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <Text style={s.kicker}>LIVE</Text>
        <Text style={s.title}>All Channels</Text>
      </View>
      {isLoading && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
      <FlatList
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        data={data?.channels || []}
        keyExtractor={(it, i) => `${it.key}-${i}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <Pressable
            testID={`channel-${item.key}`}
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.key), title: item.title } })}
          >
            <View style={s.card}>
              {item.logo ? (
                <Image source={{ uri: item.logo.startsWith("http") ? item.logo : `${BACKEND}${item.logo}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={s.shade} />
              <View style={s.livePill}><Text style={s.liveTxt}>LIVE</Text></View>
              <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                {item.number ? <Text style={s.cardSub}>Channel {item.number}</Text> : null}
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={() =>
          !isLoading && (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="radio-outline" size={36} color={colors.zinc500} />
              <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center" }}>
                No Live TV channels found.{"\n"}Plex DVR or Plex's free live TV must be set up on your server.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: 11, fontFamily: "Outfit_400Regular" },
  title: { color: "#fff", fontSize: 28, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  card: { height: 160, borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  livePill: { position: "absolute", top: 10, left: 10, backgroundColor: colors.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  liveTxt: { color: "#fff", fontSize: 9, fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.5 },
  cardTitle: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: 14 },
  cardSub: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: 11, marginTop: 2 },
});
