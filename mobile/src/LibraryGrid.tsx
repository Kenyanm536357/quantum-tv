import { useMemo } from "react";
import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "./api";
import BrandBackground from "./BrandBackground";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "./responsive";

type LibItem = {
  rating_key: string;
  title: string;
  year?: number;
  thumb?: string;
  type?: string;
  leaf_count?: number;
  viewed_leaf_count?: number;
};

export function LibraryGrid({ type, label }: { type: "movie" | "show"; label: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const libs = useQuery({ queryKey: ["libs"], queryFn: async () => (await client.get("/libraries")).data });
  const targetLib = (libs.data?.libraries || []).find((l: any) => l.type === type);

  const items = useQuery({
    enabled: !!targetLib,
    queryKey: ["libitems", targetLib?.key],
    queryFn: async () => (await client.get(`/libraries/${targetLib.key}/items?limit=200`)).data,
  });

  // User's saved favorites, so we can render the gold star badge on cards.
  const favs = useQuery({
    queryKey: ["favs"],
    queryFn: async () => (await client.get("/me/favorites")).data as { items: Array<{ rating_key: string }> },
  });
  const favSet = useMemo(
    () => new Set((favs.data?.items || []).map((f) => String(f.rating_key))),
    [favs.data]
  );

  const toggleFav = useMutation({
    mutationFn: async (it: LibItem) => {
      const isFav = favSet.has(String(it.rating_key));
      if (isFav) return client.delete(`/me/favorites/${encodeURIComponent(it.rating_key)}`);
      return client.post(`/me/favorites`, { rating_key: String(it.rating_key) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favs"] }),
  });

  const openItem = (it: LibItem) => {
    // Shows must first show a season/episode picker, NOT play straight through.
    if ((it.type || "").toLowerCase() === "show") {
      router.push({ pathname: "/show/[rk]", params: { rk: String(it.rating_key), title: it.title } });
    } else {
      router.push({ pathname: "/player/[rk]", params: { rk: String(it.rating_key), title: it.title } });
    }
  };

  return (
    <BrandBackground>
    <View style={{ flex: 1, paddingTop: SAFE.top }}>
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(16), flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image
          source={require("../assets/logo.png")}
          style={{ width: IS_TV ? ms(40) : ms(30), height: IS_TV ? ms(40) : ms(30), borderRadius: ms(8) }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIBRARY</Text>
          <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>{label}</Text>
          {targetLib && <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 6, fontSize: SIZES.fontSmall }}>{items.data?.total ?? "—"} items in {targetLib.title}</Text>}
        </View>
      </View>
      {(libs.isLoading || items.isLoading) && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
      {!libs.isLoading && !targetLib && (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Ionicons name="alert-circle-outline" size={ms(36)} color={colors.zinc500} />
          <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center", fontSize: SIZES.fontSmall }}>
            No {label.toLowerCase()} library found on your Plex server.
          </Text>
        </View>
      )}
      <FlatList
        contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40) }}
        data={items.data?.items || []}
        keyExtractor={(it: LibItem) => String(it.rating_key)}
        numColumns={GRID_COLS.posters}
        columnWrapperStyle={{ gap: SIZES.gap }}
        ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
        renderItem={({ item, index }: { item: LibItem; index: number }) => {
          const isFav = favSet.has(String(item.rating_key));
          return (
            <Pressable
              testID={`grid-${item.rating_key}`}
              focusable
              hasTVPreferredFocus={index === 0}
              style={({ focused }) => [
                { flex: 1, borderRadius: SIZES.radius },
                focused && FOCUSED_CARD,
              ]}
              onPress={() => openItem(item)}
              onLongPress={() => toggleFav.mutate(item)}
            >
              <View style={{ height: IS_TV ? vs(220) : vs(170), borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
                {item.thumb ? (
                  <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} />
                {isFav ? (
                  <View style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(250,204,21,0.95)", borderRadius: 999, width: ms(22), height: ms(22), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="star" size={ms(13)} color="#050614" />
                  </View>
                ) : null}
                {(item.type || "").toLowerCase() === "show" ? (
                  <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: "rgba(6,182,212,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: "#050614", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontTiny, letterSpacing: 1 }}>
                      {item.leaf_count ? `${item.leaf_count} EP` : "SHOW"}
                    </Text>
                  </View>
                ) : null}
                <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall }} numberOfLines={1}>{item.title}</Text>
                  {item.year ? <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 1 }}>{item.year}</Text> : null}
                </View>
              </View>
              {IS_TV ? (
                <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 4, textAlign: "center" }}>
                  Hold to {isFav ? "unfavorite" : "favorite"}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
    </BrandBackground>
  );
}

export default LibraryGrid;
