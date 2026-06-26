import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";

export function LibraryGrid({ type, label }: { type: "movie" | "show"; label: string }) {
  const router = useRouter();
  const libs = useQuery({ queryKey: ["libs"], queryFn: async () => (await client.get("/libraries")).data });
  const targetLib = (libs.data?.libraries || []).find((l: any) => l.type === type);
  const items = useQuery({
    enabled: !!targetLib,
    queryKey: ["libitems", targetLib?.key],
    queryFn: async () => (await client.get(`/libraries/${targetLib.key}/items?limit=200`)).data,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <Text style={s.kicker}>LIBRARY</Text>
        <Text style={s.title}>{label}</Text>
        {targetLib && <Text style={s.sub}>{items.data?.total ?? "—"} items in {targetLib.title}</Text>}
      </View>
      {(libs.isLoading || items.isLoading) && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
      {!libs.isLoading && !targetLib && (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.zinc500} />
          <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center" }}>
            No {label.toLowerCase()} library found on your Plex server.
          </Text>
        </View>
      )}
      <FlatList
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        data={items.data?.items || []}
        keyExtractor={(it) => String(it.rating_key)}
        numColumns={3}
        columnWrapperStyle={{ gap: 10 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <Pressable
            testID={`grid-${item.rating_key}`}
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } })}
          >
            <View style={s.card}>
              {item.thumb ? (
                <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={s.shade} />
              <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                <Text style={s.cTitle} numberOfLines={1}>{item.title}</Text>
                {item.year ? <Text style={s.cSub}>{item.year}</Text> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: 11, fontFamily: "Outfit_400Regular" },
  title: { color: "#fff", fontSize: 28, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  sub: { color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 6, fontSize: 12 },
  card: { height: 170, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  cTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: 12 },
  cSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: 10, marginTop: 1 },
});

export default LibraryGrid;
