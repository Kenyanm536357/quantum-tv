import { View, Text, ScrollView, Pressable, Image, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import client, { BACKEND, colors } from "../../src/api";
import { SAFE, SIZES, IS_TV, s, vs, ms } from "../../src/responsive";

function MediaCard({ item, onPress, big = false }: any) {
  const w = big ? (IS_TV ? s(380) : s(280)) : (IS_TV ? s(200) : s(140));
  const h = big ? (IS_TV ? vs(220) : vs(160)) : (IS_TV ? vs(280) : vs(210));
  return (
    <Pressable
      testID={`media-${item.rating_key}`}
      onPress={onPress}
      focusable
      style={({ focused }) => [{ marginRight: SIZES.gap }, focused && { transform: [{ scale: 1.05 }] }]}
    >
      <View style={[styles.card, { width: w, height: h, borderColor: "rgba(255,255,255,0.05)", borderRadius: SIZES.radius }]}>
        {item.thumb ? (
          <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="film-outline" size={SIZES.iconLg} color={colors.zinc500} />
          </LinearGradient>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.cardShade} />
      </View>
      <Text numberOfLines={1} style={[styles.cardTitle, { fontSize: SIZES.fontBody, marginTop: vs(8) }]}>{item.title}</Text>
      {item.year && <Text style={[styles.cardSub, { fontSize: SIZES.fontTiny }]}>{item.year}</Text>}
    </Pressable>
  );
}

function Section({ title, items, big = false }: any) {
  const router = useRouter();
  if (!items?.length) return null;
  return (
    <View style={{ marginTop: vs(26) }}>
      <View style={[styles.rowHeader, { paddingHorizontal: SAFE.left }]}>
        <Text style={[styles.sectionTitle, { fontSize: SIZES.fontH1 }]}>{title}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: vs(14) }} contentContainerStyle={{ paddingLeft: SAFE.left, paddingRight: SAFE.right }}>
        {items.map((it: any) => (
          <MediaCard key={it.rating_key} item={it} big={big}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(it.rating_key), title: it.title } })} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function Browse() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const recent = useQuery({ queryKey: ["recent"], queryFn: async () => (await client.get("/recently-added?limit=20")).data });
  const onDeck = useQuery({ queryKey: ["ondeck"], queryFn: async () => (await client.get("/continue-watching?limit=20")).data });

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([recent.refetch(), onDeck.refetch()]);
    setRefreshing(false);
  };

  const featured = onDeck.data?.items?.[0] || recent.data?.items?.[0];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: SAFE.top + vs(20), paddingBottom: SIZES.tabBarH + vs(40) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />}
    >
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(8) }}>
        <Text style={[styles.greeting, { fontSize: SIZES.fontSmall }]}>Welcome back</Text>
        <Text style={[styles.brand, { fontSize: SIZES.fontTitle }]}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
      </View>

      {featured && (
        <View style={{ marginTop: vs(18), marginHorizontal: SAFE.left }}>
          <Pressable
            focusable
            hasTVPreferredFocus
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(featured.rating_key), title: featured.title } })}
            style={({ focused }) => [{ borderRadius: SIZES.radiusLg, overflow: "hidden", borderWidth: 2, borderColor: focused ? colors.cyan : "transparent" }]}>
            <View style={[styles.heroWrap, { height: IS_TV ? vs(300) : vs(220), borderRadius: SIZES.radiusLg }]}>
              {featured.art ? (
                <Image source={{ uri: `${BACKEND}${featured.art}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : null}
              <LinearGradient colors={["transparent", "rgba(6,7,20,0.95)"]} style={StyleSheet.absoluteFill} />
              <View style={{ padding: s(22) }}>
                <View style={styles.livePill}><Text style={[styles.liveTxt, { fontSize: SIZES.fontTiny }]}>FEATURED</Text></View>
                <Text style={[styles.heroTitle, { fontSize: SIZES.fontTitle * 1.1 }]} numberOfLines={1}>{featured.title}</Text>
                <Text style={[styles.heroSub, { fontSize: SIZES.fontSmall }]} numberOfLines={2}>{featured.summary || ""}</Text>
              </View>
            </View>
          </Pressable>
        </View>
      )}

      <Section title="Continue Watching" items={onDeck.data?.items} />
      <Section title="Recently Added" items={recent.data?.items} big />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, flex: 1 },
  greeting: { color: colors.zinc400, fontFamily: "Outfit_400Regular", letterSpacing: 2, textTransform: "uppercase" },
  brand: { color: colors.purple, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  sectionTitle: { color: "#fff", fontFamily: "Unbounded_700Bold" },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1 },
  cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  cardTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold" },
  cardSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular" },
  heroWrap: { overflow: "hidden", justifyContent: "flex-end" },
  livePill: { alignSelf: "flex-start", backgroundColor: colors.red, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  liveTxt: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.5 },
  heroTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", marginTop: 10 },
  heroSub: { color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 4 },
});
