import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Image } from "react-native";
import ImageWithFallback from "../../src/ImageWithFallback";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import TVTextInput from "../../src/TVTextInput";
import { IS_TV, SAFE, SIZES, vs, ms, s as scale } from "../../src/responsive";
import { useParentalGate, isAdultCategory } from "../../src/useParentalGate";

export default function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    enabled: q.length >= 2,
    queryKey: ["search", q],
    queryFn: async () => (await client.get(`/search?q=${encodeURIComponent(q)}`)).data,
  });
  const { requiresPin } = useParentalGate();

  const allItems: any[] = data?.items || [];
  // When parental lock is active, hide adult content from search results
  const items = requiresPin
    ? allItems.filter((item) => !isAdultCategory(item.genre, item.category_name ?? item.category))
    : allItems;

  const openItem = (item: any) => {
    const isShow = (item.type || "").toLowerCase() === "show";
    if (isShow) {
      router.push({ pathname: "/show/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    } else {
      router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    }
  };

  return (
    <BrandBackground>
      <View style={{ flex: 1, paddingTop: SAFE.top + vs(10) }}>
        <View style={{ paddingHorizontal: SAFE.left, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: IS_TV ? ms(40) : ms(30), height: IS_TV ? ms(40) : ms(30), borderRadius: ms(8) }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>FIND</Text>
            <Text style={styles.title}>Search</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: SAFE.left, marginTop: vs(14) }}>
          <TVTextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search movies, shows, channels…"
            placeholderTextColor={colors.zinc500}
            left={<Ionicons name="search" size={ms(18)} color={colors.zinc500} />}
            wrapperStyle={styles.searchBox}
            style={styles.searchInput}
            autoCapitalize="none"
            hasTVPreferredFocus={IS_TV}
            returnKeyType="search"
          />
        </View>
        {isFetching && <ActivityIndicator color={colors.cyan} style={{ marginTop: 24 }} />}
        <FlatList
          contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40), paddingTop: vs(20) }}
          data={items}
          keyExtractor={(it) => String(it.rating_key)}
          renderItem={({ item }) => (
            <Pressable
              testID={`result-${item.rating_key}`}
              focusable
              onPress={() => openItem(item)}
              style={({ focused }) => [
                styles.row,
                focused && { backgroundColor: "rgba(139,92,246,0.14)", borderColor: colors.cyan, borderWidth: 2 },
              ]}
            >
              <View style={styles.thumb}>
                {item.thumb ? (
                  <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <LinearGradient colors={["#2A0F5A", "#0B0518"]} style={StyleSheet.absoluteFill} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{item.type} {item.year ? `· ${item.year}` : ""}</Text>
              </View>
              <Ionicons name="chevron-forward" size={ms(18)} color={colors.zinc500} />
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
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: SIZES.radius,
    paddingHorizontal: scale(14), paddingVertical: vs(12),
    borderWidth: 1, borderColor: "rgba(139,92,246,0.30)",
  },
  searchInput: { flex: 1, color: "#fff", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontBody },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: vs(10), paddingHorizontal: 10,
    borderRadius: SIZES.radius, marginBottom: vs(6),
    borderWidth: 2, borderColor: "transparent",
  },
  thumb: { width: scale(60), height: vs(80), borderRadius: 8, overflow: "hidden", backgroundColor: "#1C0A38" },
  rowTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontBody },
  rowSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 2, textTransform: "capitalize" },
});
