import { View, Text, ScrollView, Pressable, Image, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import client, { BACKEND, colors } from "../../src/api";
import { SAFE, SIZES, IS_TV, s, vs, FOCUSED_CARD } from "../../src/responsive";

type BrowseItem = {
  rating_key: string;
  title: string;
  year?: number;
  thumb?: string;
  art?: string;
  summary?: string;
  type?: string;
  number?: number | string;
  source?: string;
};

type BrowseRow = { id: string; title: string; kind: "poster" | "live"; items: BrowseItem[] };

// ---------- Card variants -----------------------------------------------
// Netflix-style poster (portrait 2:3 aspect)
function PosterCard({ item, onPress }: { item: BrowseItem; onPress: () => void }) {
  const w = IS_TV ? s(160) : s(115);
  const h = Math.round(w * 1.5);
  return (
    <Pressable
      testID={`media-${item.rating_key}`}
      onPress={onPress}
      focusable
      style={({ focused }) => [{ marginRight: SIZES.gap, borderRadius: SIZES.radius }, focused && FOCUSED_CARD]}
    >
      <View style={[styles.card, { width: w, height: h, borderRadius: SIZES.radius }]}>
        {item.thumb ? (
          <Image source={{ uri: item.thumb.startsWith("http") ? item.thumb : `${BACKEND}${item.thumb}` }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="film-outline" size={SIZES.iconLg} color={colors.zinc500} />
          </LinearGradient>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.cardShade} />
        <View style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
          <Text numberOfLines={2} style={{ color: "#fff", fontSize: SIZES.fontSmall, fontFamily: "Outfit_600SemiBold" }}>{item.title}</Text>
          {item.year ? <Text style={{ color: colors.zinc400, fontSize: SIZES.fontTiny, fontFamily: "Outfit_400Regular", marginTop: 1 }}>{item.year}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// 16:9 landscape channel logo card (Live TV row)
function ChannelCard({ item, onPress }: { item: BrowseItem; onPress: () => void }) {
  const w = IS_TV ? s(200) : s(150);
  const h = Math.round(w * 0.56);
  return (
    <Pressable
      testID={`media-${item.rating_key}`}
      onPress={onPress}
      focusable
      style={({ focused }) => [{ marginRight: SIZES.gap, borderRadius: SIZES.radius }, focused && FOCUSED_CARD]}
    >
      <View style={[styles.card, { width: w, height: h, borderRadius: SIZES.radius }]}>
        {item.thumb ? (
          <Image
            source={{ uri: item.thumb.startsWith("http") ? item.thumb : `${BACKEND}${item.thumb}` }}
            style={[StyleSheet.absoluteFill, { padding: s(14) }]}
            resizeMode="contain"
          />
        ) : (
          <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} />
        <View style={{ position: "absolute", top: 6, left: 6, backgroundColor: colors.red, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
          <Text style={{ color: "#fff", fontSize: SIZES.fontTiny, fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.2 }}>LIVE</Text>
        </View>
        <View style={{ position: "absolute", left: 8, right: 8, bottom: 6 }}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: SIZES.fontSmall, fontFamily: "Outfit_600SemiBold" }}>{item.title}</Text>
          {item.number ? <Text style={{ color: colors.zinc400, fontSize: SIZES.fontTiny, fontFamily: "Outfit_400Regular" }}>Ch {item.number}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Row({ row }: { row: BrowseRow }) {
  const router = useRouter();
  if (!row.items?.length) return null;
  return (
    <View style={{ marginTop: vs(18) }} testID={`row-${row.id}`}>
      <View style={{ paddingHorizontal: SAFE.left }}>
        <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2, letterSpacing: 0.3 }}>{row.title}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: vs(10) }}
        contentContainerStyle={{ paddingLeft: SAFE.left, paddingRight: SAFE.right, paddingVertical: vs(6) }}
      >
        {row.items.map((it) => {
          const go = () => router.push({ pathname: "/player/[rk]", params: { rk: String(it.rating_key), title: it.title } });
          return row.kind === "live"
            ? <ChannelCard key={String(it.rating_key)} item={it} onPress={go} />
            : <PosterCard key={String(it.rating_key)} item={it} onPress={go} />;
        })}
      </ScrollView>
    </View>
  );
}

// ---------- Hero -----------------------------------------------------------
function Hero({ item }: { item: BrowseItem }) {
  const router = useRouter();
  return (
    <View style={{ marginTop: vs(6), marginHorizontal: SAFE.left }}>
      <Pressable
        focusable
        hasTVPreferredFocus
        onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } })}
        style={({ focused }) => [
          { borderRadius: SIZES.radiusLg, overflow: "hidden" },
          focused && { ...FOCUSED_CARD, transform: [{ scale: 1.02 }] },
        ]}
      >
        <View style={[styles.heroWrap, { height: IS_TV ? vs(280) : vs(200), borderRadius: SIZES.radiusLg }]}>
          {item.art ? (
            <Image source={{ uri: item.art.startsWith("http") ? item.art : `${BACKEND}${item.art}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : item.thumb ? (
            <Image source={{ uri: item.thumb.startsWith("http") ? item.thumb : `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}
          <LinearGradient colors={["rgba(6,7,20,0.35)", "rgba(6,7,20,0.98)"]} style={StyleSheet.absoluteFill} />
          <View style={{ padding: s(18) }}>
            <View style={styles.featuredPill}>
              <Text style={{ color: "#fff", fontSize: SIZES.fontTiny, fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.6 }}>FEATURED</Text>
            </View>
            <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 10 }} numberOfLines={1}>{item.title}</Text>
            <Text style={{ color: colors.zinc300, fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular", marginTop: 4 }} numberOfLines={2}>{item.summary || "Tap to watch"}</Text>
            <View style={{ flexDirection: "row", marginTop: vs(12), alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: colors.cyan, paddingHorizontal: s(14), paddingVertical: vs(6), borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="play" size={SIZES.iconSm} color="#050614" />
                <Text style={{ color: "#050614", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontSmall }}>Play</Text>
              </View>
              {item.year ? <Text style={{ color: colors.zinc400, fontSize: SIZES.fontTiny, fontFamily: "Outfit_400Regular" }}>{item.year}</Text> : null}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// ---------- Screen ---------------------------------------------------------
export default function Browse() {
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["browse-rows"],
    queryFn: async () => (await client.get("/browse/rows?per_row=20")).data as { rows: BrowseRow[] },
  });
  const rows = data?.rows || [];
  const featured = rows.find((r) => r.id === "continue")?.items?.[0] || rows.find((r) => r.id === "recent")?.items?.[0] || rows.find((r) => r.kind === "poster")?.items?.[0];
  // Fallback featured: if only Live TV is populated (no Plex), use its top item
  const heroItem = featured || rows[0]?.items?.[0];

  const refresh = async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: SAFE.top + vs(10), paddingBottom: SIZES.tabBarH + vs(30) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.cyan} />}
    >
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(6) }}>
        <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontTiny }}>Welcome back</Text>
        <Text style={{ color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH1, marginTop: 2 }}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
      </View>

      {heroItem ? <Hero item={heroItem} /> : null}

      {isLoading && !data ? (
        <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />
      ) : rows.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: vs(60), paddingHorizontal: SAFE.left }}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.zinc500} />
          <Text style={{ color: colors.zinc400, marginTop: 10, textAlign: "center", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall }}>
            No content yet. Ask the admin to connect a Plex server or IPTV line.
          </Text>
        </View>
      ) : (
        rows.map((r) => <Row key={r.id} row={r} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, flex: 1 },
  card: { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  heroWrap: { overflow: "hidden", justifyContent: "flex-end" },
  featuredPill: { alignSelf: "flex-start", backgroundColor: "rgba(6,182,212,0.85)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
});
