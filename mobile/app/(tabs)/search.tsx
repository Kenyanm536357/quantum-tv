import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";

export default function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    enabled: q.length >= 2,
    queryKey: ["search", q],
    queryFn: async () => (await client.get(`/search?q=${encodeURIComponent(q)}`)).data,
  });
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={s.kicker}>FIND</Text>
        <Text style={s.title}>Search</Text>
        <View style={s.searchBox}>
          <Ionicons name="search" size={18} color={colors.zinc500} />
          <TextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search movies, shows, channels…"
            placeholderTextColor={colors.zinc500}
            style={s.searchInput}
            autoCapitalize="none"
          />
        </View>
      </View>
      {isFetching && <ActivityIndicator color={colors.cyan} style={{ marginTop: 24 }} />}
      <FlatList
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        data={data?.items || []}
        keyExtractor={(it) => String(it.rating_key)}
        renderItem={({ item }) => (
          <Pressable
            testID={`result-${item.rating_key}`}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } })}
            style={s.row}
          >
            <View style={s.thumb}>
              {item.thumb ? (
                <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.rowSub} numberOfLines={1}>{item.type} {item.year ? `· ${item.year}` : ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.zinc500} />
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: 11, fontFamily: "Outfit_400Regular" },
  title: { color: "#fff", fontSize: 28, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  searchInput: { flex: 1, color: "#fff", fontFamily: "Outfit_400Regular", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomColor: "rgba(255,255,255,0.06)", borderBottomWidth: 1 },
  thumb: { width: 60, height: 80, borderRadius: 8, overflow: "hidden", backgroundColor: "#0D0E23" },
  rowTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: 14 },
  rowSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
});
