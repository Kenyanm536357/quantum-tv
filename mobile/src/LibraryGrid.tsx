import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "./api";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms } from "./responsive";

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
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: SAFE.top }}>
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(16) }}>
        <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIBRARY</Text>
        <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>{label}</Text>
        {targetLib && <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 6, fontSize: SIZES.fontSmall }}>{items.data?.total ?? "—"} items in {targetLib.title}</Text>}
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
        keyExtractor={(it) => String(it.rating_key)}
        numColumns={GRID_COLS.posters}
        columnWrapperStyle={{ gap: SIZES.gap }}
        ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
        renderItem={({ item, index }) => (
          <Pressable
            testID={`grid-${item.rating_key}`}
            focusable
            hasTVPreferredFocus={index === 0}
            style={({ focused }) => [{ flex: 1 }, focused && { transform: [{ scale: 1.06 }] }]}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } })}
          >
            <View style={{ height: IS_TV ? vs(220) : vs(170), borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
              {item.thumb ? (
                <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} />
              <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall }} numberOfLines={1}>{item.title}</Text>
                {item.year ? <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 1 }}>{item.year}</Text> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

export default LibraryGrid;
