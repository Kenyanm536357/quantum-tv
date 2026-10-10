import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Image, ScrollView } from "react-native";
import ImageWithFallback from "../../src/ImageWithFallback";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import TVTextInput from "../../src/TVTextInput";
import { IS_TV, SAFE, SIZES, vs, ms, s as scale } from "../../src/responsive";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useParentalGate, isAdultCategory } from "../../src/useParentalGate";

type MediaType = "all" | "movie" | "show" | "live";

const MEDIA_FILTERS: Array<{ value: MediaType; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "show", label: "TV Shows" },
  { value: "live", label: "Live" },
];

export default function Search() {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(SAFE.top, insets.top + vs(8));
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("all");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const { data, isFetching, isError, refetch } = useQuery({
    enabled: debouncedQ.length >= 2,
    queryKey: ["search", mediaType, debouncedQ],
    queryFn: async () => (await client.get(`/search?q=${encodeURIComponent(debouncedQ)}&media_type=${mediaType}&limit=100`)).data,
    staleTime: 30_000,
  });
  const { requiresPin } = useParentalGate();

  const allItems: any[] = data?.items || [];
  // When parental lock is active, hide adult content from search results
  const items = requiresPin
    ? allItems.filter((item) => !isAdultCategory(item.genre, item.category_name ?? item.category, item.title))
    : allItems;
  const searched = debouncedQ.length >= 2 && debouncedQ === q.trim();
  const foundCount = items.length;

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
      <View style={{ flex: 1, paddingTop: safeTop + vs(10) }}>
        <View style={{ paddingHorizontal: SAFE.left, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: IS_TV ? ms(40) : ms(30), height: IS_TV ? ms(40) : ms(30), borderRadius: ms(8) }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>MOVIES · TV · LIVE</Text>
            <Text style={styles.title}>Master Search</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: SAFE.left, marginTop: vs(14) }}>
          <TVTextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search titles, channels, genres..."
            placeholderTextColor={colors.zinc500}
            left={<Ionicons name="search" size={ms(18)} color={colors.zinc500} />}
            right={q ? (
              <Pressable
                testID="master-search-clear"
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQ("")}
                style={{ padding: 8 }}
              >
                <Ionicons name="close-circle" size={ms(18)} color={colors.zinc400} />
              </Pressable>
            ) : null}
            wrapperStyle={styles.searchBox}
            style={styles.searchInput}
            autoCapitalize="none"
            hasTVPreferredFocus={IS_TV}
            returnKeyType="search"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {MEDIA_FILTERS.map((filter) => {
            const selected = mediaType === filter.value;
            return (
              <Pressable
                key={filter.value}
                testID={`master-search-filter-${filter.value}`}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${filter.label}`}
                accessibilityState={{ selected }}
                onPress={() => setMediaType(filter.value)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {!q.trim() ? (
          <Pressable
            testID="master-search-sports-live"
            accessibilityRole="button"
            accessibilityLabel="Find live sports channels"
            onPress={() => {
              setMediaType("live");
              setQ("sports");
            }}
            style={styles.sportsShortcut}
          >
            <Ionicons name="football-outline" size={ms(18)} color={colors.cyan} />
            <Text style={styles.sportsShortcutText}>Sports Live</Text>
            <Ionicons name="arrow-forward" size={ms(15)} color={colors.zinc500} />
          </Pressable>
        ) : null}
        {searched && !isFetching && !isError ? (
          <View style={{ paddingHorizontal: SAFE.left, marginTop: vs(8) }}>
            <Text style={styles.resultMeta}>
              {foundCount} {foundCount === 1 ? "match" : "matches"} in {MEDIA_FILTERS.find((filter) => filter.value === mediaType)?.label}
            </Text>
          </View>
        ) : null}
        {(isFetching || (q.trim().length >= 2 && debouncedQ !== q.trim())) && <ActivityIndicator color={colors.cyan} style={{ marginTop: 24 }} />}
        {isError ? (
          <View style={styles.errorNotice}>
            <Text style={styles.errorText}>Search could not load right now.</Text>
            <Pressable testID="master-search-retry" onPress={() => void refetch()} style={styles.retryButton}>
              <Ionicons name="refresh" size={ms(15)} color="#050614" />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        <FlatList
          contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40), paddingTop: vs(20) }}
          data={items}
          keyExtractor={(it) => String(it.rating_key)}
          ListEmptyComponent={() => (
            searched && !isFetching && !isError ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="search-outline" size={ms(30)} color={colors.zinc500} />
                <Text style={styles.emptyTxt}>We could not find anything for "{q.trim()}".</Text>
              </View>
            ) : !q.trim() ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="compass-outline" size={ms(30)} color={colors.zinc500} />
                <Text style={styles.emptyTxt}>Search the full catalog</Text>
              </View>
            ) : null
          )}
          renderItem={({ item }) => {
            const itemType = item.type === "live" ? "LIVE TV" : item.type === "show" ? "TV SHOW" : "MOVIE";
            const detail = [item.year, item.genre || item.category_name].filter(Boolean).join(" · ");
            return (
            <Pressable
              testID={`result-${item.rating_key}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${itemType}${detail ? `, ${detail}` : ""}`}
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
                <Text style={styles.rowSub} numberOfLines={1}>{itemType}{detail ? ` · ${detail}` : ""}</Text>
              </View>
              <Ionicons name={item.type === "live" ? "play-circle-outline" : "chevron-forward"} size={ms(18)} color={colors.zinc500} />
            </Pressable>
            );
          }}
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
  filterScroll: { maxHeight: vs(44), marginTop: vs(12) },
  filterContent: { paddingHorizontal: SAFE.left, gap: 8, alignItems: "center" },
  filterChip: {
    minHeight: vs(36), justifyContent: "center", paddingHorizontal: scale(14),
    borderRadius: SIZES.radius, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  filterChipSelected: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  filterChipText: { color: colors.zinc300, fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
  filterChipTextSelected: { color: "#050614" },
  sportsShortcut: {
    alignSelf: "flex-start", marginHorizontal: SAFE.left, marginTop: vs(12),
    minHeight: vs(40), flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: scale(12), borderWidth: 1, borderColor: "rgba(6,182,212,0.35)",
    borderRadius: SIZES.radius, backgroundColor: "rgba(6,182,212,0.08)",
  },
  sportsShortcutText: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
  resultMeta: {
    color: colors.zinc400,
    fontFamily: "Outfit_400Regular",
    fontSize: SIZES.fontSmall,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: vs(10), paddingHorizontal: 10,
    borderRadius: SIZES.radius, marginBottom: vs(6),
    borderWidth: 2, borderColor: "transparent",
  },
  thumb: { width: scale(60), height: vs(80), borderRadius: 8, overflow: "hidden", backgroundColor: "#1C0A38" },
  rowTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontBody },
  rowSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 2, textTransform: "capitalize" },
  emptyWrap: {
    marginTop: vs(36),
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTxt: {
    color: colors.zinc400,
    fontFamily: "Outfit_400Regular",
    fontSize: SIZES.fontSmall,
    textAlign: "center",
  },
  errorNotice: { paddingHorizontal: SAFE.left, marginTop: vs(20), alignItems: "center", gap: vs(10) },
  errorText: { color: colors.zinc300, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall },
  retryButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.cyan, borderRadius: SIZES.radius, paddingHorizontal: scale(14), paddingVertical: vs(8) },
  retryText: { color: "#050614", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
});
