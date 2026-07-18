import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import ImageWithFallback from "./ImageWithFallback";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "./api";
import BrandBackground from "./BrandBackground";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "./responsive";

export function ListScreen({ endpoint, title, removeLabel, removeFromList, emptyText }: any) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await client.get(endpoint)).data,
  });
  const remove = useMutation({
    mutationFn: async (rk: string) => removeFromList(rk),
    onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint] }),
  });

  const openItem = (item: any) => {
    // Shows must first show a season/episode picker.
    if ((item.type || "").toLowerCase() === "show") {
      router.push({ pathname: "/show/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    } else {
      router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    }
  };

  return (
    <BrandBackground>
      <View style={{ flex: 1, paddingTop: SAFE.top }}>
        <View style={{ paddingHorizontal: SAFE.left, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: vs(4) }}>
          <Image
            source={require("../assets/logo.png")}
            style={{ width: IS_TV ? ms(40) : ms(30), height: IS_TV ? ms(40) : ms(30), borderRadius: ms(8) }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>YOUR</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        {isLoading && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
        <FlatList
          contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40), paddingTop: vs(16) }}
          data={data?.items || []}
          keyExtractor={(it: any) => String(it.rating_key)}
          numColumns={GRID_COLS.posters}
          columnWrapperStyle={{ gap: SIZES.gap }}
          ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
          ListEmptyComponent={() => !isLoading && (
            <View style={{ alignItems: "center", marginTop: vs(60) }}>
              <Ionicons name="bookmark-outline" size={ms(40)} color={colors.zinc500} />
              <Text style={styles.empty}>{emptyText}</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <Pressable
              testID={`item-${item.rating_key}`}
              style={({ focused }) => [{ flex: 1, borderRadius: SIZES.radius }, focused && FOCUSED_CARD]}
              focusable
              hasTVPreferredFocus={index === 0}
              onPress={() => openItem(item)}
              onLongPress={() => remove.mutate(String(item.rating_key))}
            >
              <View style={styles.card}>
                {item.thumb ? (
                  <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={["#2A0F5A", "#0B0518"]} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient colors={["transparent", "rgba(11,5,24,0.9)"]} style={styles.shade} />
                <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.cTitle} numberOfLines={1}>{item.title}</Text>
                  {item.year ? <Text style={styles.cSub}>{item.year}</Text> : null}
                </View>
              </View>
              <Text style={styles.hint} numberOfLines={1}>Hold to {removeLabel}</Text>
            </Pressable>
          )}
        />
      </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontTiny, fontFamily: "Outfit_400Regular" },
  title: { color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  card: {
    height: IS_TV ? vs(220) : vs(170),
    borderRadius: SIZES.radius,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
  },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  cTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
  cSub: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 1 },
  hint: { color: colors.zinc500, fontSize: SIZES.fontTiny, marginTop: 4, fontFamily: "Outfit_400Regular", textAlign: "center" },
  empty: { color: colors.zinc400, marginTop: 14, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, textAlign: "center" },
});

export default ListScreen;
