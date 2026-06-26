import { View, Text, ScrollView, Pressable, Image, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import client, { BACKEND, colors } from "../../src/api";

function MediaCard({ item, onPress, big = false }: any) {
  return (
    <Pressable testID={`media-${item.rating_key}`} onPress={onPress} style={{ marginRight: 14 }}>
      <View style={[styles.card, { width: big ? 280 : 140, height: big ? 160 : 210 }]}>
        {item.thumb ? (
          <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="film-outline" size={32} color={colors.zinc500} />
          </LinearGradient>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.cardShade} />
      </View>
      <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
      {item.year && <Text style={styles.cardSub}>{item.year}</Text>}
    </Pressable>
  );
}

function Section({ title, items, onSeeAll, big = false }: any) {
  const router = useRouter();
  if (!items?.length) return null;
  return (
    <View style={{ marginTop: 26 }}>
      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <Pressable onPress={onSeeAll}><Text style={styles.seeAll}>See all →</Text></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, paddingLeft: 20 }}>
        {items.map((it: any) => (
          <MediaCard key={it.rating_key} item={it} big={big}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(it.rating_key), title: it.title } })} />
        ))}
        <View style={{ width: 20 }} />
      </ScrollView>
    </View>
  );
}

export default function Browse() {
  const [refreshing, setRefreshing] = useState(false);
  const recent = useQuery({ queryKey: ["recent"], queryFn: async () => (await client.get("/recently-added?limit=20")).data });
  const onDeck = useQuery({ queryKey: ["ondeck"], queryFn: async () => (await client.get("/continue-watching?limit=20")).data });
  const channels = useQuery({ queryKey: ["chans"], queryFn: async () => (await client.get("/livetv/channels")).data });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([recent.refetch(), onDeck.refetch(), channels.refetch()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: 60, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />}
    >
      <View style={{ paddingHorizontal: 20, marginBottom: 6 }}>
        <Text style={styles.greeting}>Welcome back</Text>
        <Text style={styles.brand}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
      </View>

      {(onDeck.data?.items?.length || 0) > 0 && (
        <View style={{ marginTop: 18, marginHorizontal: 20 }}>
          <View style={styles.heroWrap}>
            {onDeck.data.items[0].art ? (
              <Image source={{ uri: `${BACKEND}${onDeck.data.items[0].art}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            <LinearGradient colors={["transparent", "rgba(6,7,20,0.95)"]} style={StyleSheet.absoluteFill} />
            <View style={{ padding: 22 }}>
              <View style={styles.livePill}><Text style={styles.liveTxt}>CONTINUE</Text></View>
              <Text style={styles.heroTitle} numberOfLines={1}>{onDeck.data.items[0].title}</Text>
              <Text style={styles.heroSub} numberOfLines={2}>{onDeck.data.items[0].summary || ""}</Text>
            </View>
          </View>
        </View>
      )}

      <Section title="Continue Watching" items={onDeck.data?.items} />
      <Section title="Recently Added" items={recent.data?.items} big />
      {(channels.data?.channels || []).length > 0 && (
        <View style={{ marginTop: 26 }}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>Live TV</Text>
            <Text style={styles.seeAll}>{channels.data.channels.length} channels</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, flex: 1 },
  greeting: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  brand: { color: colors.purple, fontSize: 32, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  sectionTitle: { color: "#fff", fontSize: 18, fontFamily: "Unbounded_700Bold", paddingHorizontal: 20 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 20 },
  seeAll: { color: colors.cyan, fontFamily: "Outfit_500Medium", fontSize: 13 },
  card: { borderRadius: 16, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  cardTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", marginTop: 8, fontSize: 13, maxWidth: 200 },
  cardSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: 11, marginTop: 2 },
  heroWrap: { height: 220, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", justifyContent: "flex-end" },
  livePill: { alignSelf: "flex-start", backgroundColor: colors.red, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  liveTxt: { color: "#fff", fontSize: 10, fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.5 },
  heroTitle: { color: "#fff", fontSize: 28, fontFamily: "Unbounded_800ExtraBold", marginTop: 10 },
  heroSub: { color: colors.zinc400, fontSize: 13, fontFamily: "Outfit_400Regular", marginTop: 4 },
});
