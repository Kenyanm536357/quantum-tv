import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator, TextInput, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "./api";
import BrandBackground from "./BrandBackground";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "./responsive";
import { useParentalGate, isAdultCategory } from "./useParentalGate";

type LibItem = {
  rating_key: string;
  title: string;
  year?: string | number;
  thumb?: string;
  type?: string;
  category_id?: string;
  category_name?: string;
  leaf_count?: number;
};

export function LibraryGrid({ type, label }: { type: "movie" | "show"; label: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Parental gate — exclude adult content when disabled
  const { requiresPin } = useParentalGate();

  // Route to the correct IPTV endpoint depending on content type.
  // Pass exclude_adult=true when adult channels are disabled so the server
  // pre-filters by category (catches content the client keyword filter misses).
  const endpoint = type === "movie" ? "/iptv/vod/streams" : "/iptv/series/streams";
  const fetchUrl = `${endpoint}?exclude_adult=${requiresPin ? "true" : "false"}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["iptv-grid", type, requiresPin],
    queryFn: async () => (await client.get(fetchUrl)).data as { items: LibItem[]; total: number },
    staleTime: 5 * 60 * 1000,
  });

  // User's saved favorites for the gold-star badge
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
    if ((it.type || "").toLowerCase() === "show") {
      router.push({ pathname: "/show/[rk]", params: { rk: String(it.rating_key), title: it.title } });
    } else {
      router.push({ pathname: "/player/[rk]", params: { rk: String(it.rating_key), title: it.title } });
    }
  };

  // Apply client-side adult filter as a second pass (keyword-based)
  const allItems: LibItem[] = useMemo(() => {
    const raw = data?.items || [];
    if (!requiresPin) return raw;
    return raw.filter((it) => !isAdultCategory(undefined, it.category_name, it.title));
  }, [data, requiresPin]);

  // Derive unique categories from loaded items for filter chips (use category_name if available)
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const cats: string[] = ["All"];
    for (const it of allItems) {
      // Prefer human-readable category_name; fall back to category_id
      const c = String(it.category_name || it.category_id || "").trim();
      if (c && !seen.has(c)) { seen.add(c); cats.push(c); }
    }
    return cats;
  }, [allItems]);

  // Apply category + search filters
  const filtered = useMemo(() => {
    let list = allItems;
    if (activeCategory !== "All") {
      list = list.filter((it) => {
        const cat = String(it.category_name || it.category_id || "").trim();
        return cat === activeCategory;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) => (it.title || "").toLowerCase().includes(q));
    }
    return list;
  }, [allItems, activeCategory, search]);

  return (
    <BrandBackground>
    <View style={{ flex: 1, paddingTop: SAFE.top }}>
      {/* Header */}
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(10), flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image
          source={require("../assets/logo.png")}
          style={{ width: IS_TV ? ms(40) : ms(30), height: IS_TV ? ms(40) : ms(30), borderRadius: ms(8) }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIBRARY</Text>
          <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>{label}</Text>
          {data && (
            <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 4, fontSize: SIZES.fontSmall }}>
              {filtered.length !== allItems.length
                ? `${filtered.length} of ${allItems.length} titles`
                : `${allItems.length} titles`}
            </Text>
          )}
        </View>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(8) }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: SIZES.radius, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Ionicons name="search-outline" size={ms(16)} color={colors.zinc500} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${label.toLowerCase()}…`}
            placeholderTextColor={colors.zinc500}
            style={{ flex: 1, color: "#fff", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontBody, paddingVertical: vs(8) }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} focusable>
              <Ionicons name="close-circle" size={ms(16)} color={colors.zinc500} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category chips */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: vs(8), gap: 8 }}
        >
          {categories.map((cat) => (
            <Pressable
              key={cat}
              focusable
              onPress={() => setActiveCategory(cat)}
              style={({ focused }) => [
                styles.chip,
                activeCategory === cat && styles.chipActive,
                focused && styles.chipFocused,
              ]}
            >
              <Text style={[styles.chipLabel, activeCategory === cat && styles.chipLabelActive]}>
                {cat === "All" ? "All" : cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Loading / error states */}
      {isLoading && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
      {isError && (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Ionicons name="alert-circle-outline" size={ms(36)} color={colors.zinc500} />
          <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center", fontSize: SIZES.fontSmall }}>
            Could not load {label.toLowerCase()}. Check your IPTV connection.
          </Text>
          <Pressable focusable onPress={() => refetch()} style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.cyan, borderRadius: 8 }}>
            <Text style={{ color: "#050614", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontSmall }}>Retry</Text>
          </Pressable>
        </View>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <View style={{ alignItems: "center", padding: 40 }}>
          <Ionicons name="film-outline" size={ms(36)} color={colors.zinc500} />
          <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center", fontSize: SIZES.fontSmall }}>
            {search || activeCategory !== "All" ? "No results match your search." : `No ${label.toLowerCase()} available.`}
          </Text>
        </View>
      )}

      {/* Grid */}
      <FlatList
        contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40) }}
        data={filtered}
        keyExtractor={(it: LibItem) => String(it.rating_key)}
        numColumns={GRID_COLS.posters}
        columnWrapperStyle={{ gap: SIZES.gap }}
        ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item, index }: { item: LibItem; index: number }) => {
          const isFav = favSet.has(String(item.rating_key));
          return (
            <Pressable
              testID={`grid-${item.rating_key}`}
              focusable
              hasTVPreferredFocus={index === 0}
              style={{ flex: 1, borderRadius: SIZES.radius, backgroundColor: "transparent" }}
              onPress={() => openItem(item)}
              onLongPress={() => toggleFav.mutate(item)}
            >
              {({ focused }) => (
                <View>
                  <View style={[
                    { height: IS_TV ? vs(220) : vs(170), borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 2, borderColor: "rgba(255,255,255,0.05)" },
                    focused && { borderColor: colors.cyan, transform: [{ scale: 1.04 }], shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 20, elevation: 12 },
                  ]}>
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
                        <Text style={{ color: "#050614", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontTiny, letterSpacing: 1 }}>SHOW</Text>
                      </View>
                    ) : null}
                    <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall }} numberOfLines={1}>{item.title}</Text>
                      {item.year ? <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 1 }}>{item.year}</Text> : null}
                    </View>
                  </View>
                  {IS_TV ? (
                    <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 4, textAlign: "center", opacity: focused ? 0.9 : 0.4 }}>
                      Hold to {isFav ? "unfavorite" : "favorite"}
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: s(14),
    paddingVertical: vs(6),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  chipActive: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  chipFocused: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
    shadowColor: colors.purple,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  chipLabel: {
    color: "#fff",
    fontFamily: "Outfit_500Medium",
    fontSize: SIZES.fontSmall,
  },
  chipLabelActive: {
    color: "#050614",
    fontFamily: "Unbounded_700Bold",
  },
});

export default LibraryGrid;
