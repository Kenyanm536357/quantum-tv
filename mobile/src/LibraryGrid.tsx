import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useRouter } from "expo-router";
import client, { BACKEND, colors } from "./api";
import BrandBackground from "./BrandBackground";
import TVTextInput from "./TVTextInput";
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
  duration?: number;
  view_offset?: number;
  progress_pct?: number;
};

type SortOrder = "az" | "newest" | "oldest";

function releaseYear(item: LibItem): number | null {
  const match = String(item.year ?? "").match(/\b(\d{4})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return year > 0 ? year : null;
}

const LIBRARY_REFRESH_MS = 90 * 1000;
const LIBRARY_FETCH_LIMIT = 12000;

export function LibraryGrid({ type, label }: { type: "movie" | "show"; label: string }) {
  const { width: screenWidth } = useWindowDimensions();
  const isFocused = useIsFocused();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("az");

  // Parental gate — exclude adult content when disabled
  const { requiresPin } = useParentalGate();

  // Route to the correct IPTV endpoint depending on content type.
  // Pass exclude_adult=true when adult channels are disabled so the server
  // pre-filters by category (catches content the client keyword filter misses).
  const endpoint = type === "movie" ? "/iptv/vod/streams" : "/iptv/series/streams";
  const fetchUrl =
    type === "movie"
      ? `${endpoint}?exclude_adult=${requiresPin ? "true" : "false"}&limit=${LIBRARY_FETCH_LIMIT}&include_stream_url=false`
      : `${endpoint}?exclude_adult=${requiresPin ? "true" : "false"}&limit=${LIBRARY_FETCH_LIMIT}`;

  const { data, dataUpdatedAt, isLoading, isError, refetch } = useQuery({
    queryKey: ["iptv-grid", type, requiresPin],
    queryFn: async () => (await client.get(fetchUrl, { timeout: 60000 })).data as { items: LibItem[]; total: number },
    // Keep Movies/TV fresh for customers even when users stay on these tabs.
    staleTime: 5 * 60 * 1000,
    refetchInterval: isFocused ? LIBRARY_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(6000, 1000 * attempt),
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

  const watchlist = useQuery({
    queryKey: ["/me/watchlist"],
    queryFn: async () => (await client.get("/me/watchlist")).data as { items: LibItem[] },
  });
  const watchlistSet = useMemo(
    () => new Set((watchlist.data?.items || []).map((item) => String(item.rating_key))),
    [watchlist.data]
  );

  const continueWatching = useQuery({
    queryKey: ["continue-watching"],
    queryFn: async () => (await client.get("/continue-watching")).data as { items: LibItem[] },
    staleTime: 60_000,
    refetchInterval: isFocused ? 60_000 : false,
    refetchOnWindowFocus: true,
  });
  const progressByKey = useMemo(
    () => new Map((continueWatching.data?.items || []).map((item) => [String(item.rating_key), item])),
    [continueWatching.data]
  );

  useFocusEffect(useCallback(() => {
    void watchlist.refetch();
    void continueWatching.refetch();
    if (Date.now() - dataUpdatedAt > 5 * 60 * 1000) void refetch();
  }, [watchlist.refetch, continueWatching.refetch, dataUpdatedAt, refetch]));

  const toggleFav = useMutation({
    mutationFn: async (it: LibItem) => {
      const isFav = favSet.has(String(it.rating_key));
      if (isFav) return client.delete(`/me/favorites/${encodeURIComponent(it.rating_key)}`);
      return client.post(`/me/favorites`, { rating_key: String(it.rating_key) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favs"] });
      qc.invalidateQueries({ queryKey: ["/me/favorites"] });
    },
  });

  const toggleWatchlist = useMutation({
    mutationFn: async (it: LibItem) => {
      const ratingKey = String(it.rating_key);
      if (watchlistSet.has(ratingKey)) {
        return client.delete(`/me/watchlist/${encodeURIComponent(ratingKey)}`);
      }
      return client.post("/me/watchlist", { rating_key: ratingKey });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/me/watchlist"] }),
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

  // Keep sorting out of the keystroke path; searching only scans this ordered array.
  const sortedItems = useMemo(() => {
    const sorted = [...allItems];
    sorted.sort((a, b) => {
      if (sortOrder === "az") {
        return String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base", numeric: true });
      }
      const yearA = releaseYear(a);
      const yearB = releaseYear(b);
      // Keep entries with no release year at the end for either date order.
      if (yearA === null || yearB === null) {
        if (yearA === yearB) return String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base", numeric: true });
        return yearA === null ? 1 : -1;
      }
      const byYear = sortOrder === "newest" ? yearB - yearA : yearA - yearB;
      return byYear || String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base", numeric: true });
    });
    return sorted;
  }, [allItems, sortOrder]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? sortedItems.filter((item) => (item.title || "").toLowerCase().includes(query))
      : sortedItems;
  }, [sortedItems, search]);

  const columns = GRID_COLS.posters;
  const gridGap = SIZES.gap;
  const cardWidth = Math.max(96, (screenWidth - SAFE.left - SAFE.right - gridGap * (columns - 1)) / columns);
  const cardHeight = cardWidth * 1.5;

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
        <TVTextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${label.toLowerCase()}…`}
          placeholderTextColor={colors.zinc500}
          left={<Ionicons name="search-outline" size={ms(16)} color={colors.zinc500} />}
          right={
            search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} focusable={IS_TV}>
                <Ionicons name="close-circle" size={ms(16)} color={colors.zinc500} />
              </Pressable>
            ) : undefined
          }
          wrapperStyle={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: SIZES.radius, paddingHorizontal: 12, borderColor: "rgba(255,255,255,0.08)" }}
          style={{ color: "#fff", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontBody, paddingVertical: vs(8) }}
          autoCapitalize="none"
        />
      </View>

      {/* Sort controls apply after category and search filtering. */}
      <View style={[styles.sortRow, { paddingHorizontal: SAFE.left, paddingRight: SAFE.right }]}>
        <Text style={styles.sortCaption}>SORT</Text>
        {([
          ["az", "A–Z"],
          ["newest", "Newest"],
          ["oldest", "Oldest"],
        ] as const).map(([value, title]) => {
          const active = sortOrder === value;
          return (
            <Pressable
              key={value}
              testID={`sort-${value}`}
              focusable
              onPress={() => setSortOrder(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ focused }) => [
                styles.sortChip,
                active && styles.sortChipActive,
                focused && styles.sortChipFocused,
              ]}
            >
              <Text style={[styles.sortChipLabel, active && styles.sortChipLabelActive]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>

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
            {search ? "No results match your search." : `No ${label.toLowerCase()} available.`}
          </Text>
        </View>
      )}

      {/* Grid */}
      <FlatList
        key={`library-grid-${type}-${columns}`}
        contentContainerStyle={{ paddingLeft: SAFE.left, paddingRight: SAFE.right, paddingBottom: SIZES.tabBarH + vs(40) }}
        data={filtered}
        keyExtractor={(it: LibItem) => String(it.rating_key)}
        numColumns={columns}
        columnWrapperStyle={{ gap: SIZES.gap }}
        ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item, index }: { item: LibItem; index: number }) => {
          const isFav = favSet.has(String(item.rating_key));
          const isWatchlisted = watchlistSet.has(String(item.rating_key));
          const savedProgress = progressByKey.get(String(item.rating_key));
          const progressPct = Math.max(0, Math.min(100, Math.round(
            Number(savedProgress?.progress_pct || (savedProgress?.duration && savedProgress?.view_offset
              ? Number(savedProgress.view_offset) / Number(savedProgress.duration)
              : 0)) * 100
          )));
          const resumeMinutes = Math.floor(Number(savedProgress?.view_offset || 0) / 60_000);
          const hasResume = resumeMinutes > 0;
          return (
            <View style={{ width: cardWidth }}>
              <Pressable
                testID={`grid-${item.rating_key}`}
                focusable
                hasTVPreferredFocus={index === 0}
                style={{ width: cardWidth, borderRadius: SIZES.radius, backgroundColor: "transparent" }}
                onPress={() => openItem(item)}
                onLongPress={() => toggleFav.mutate(item)}
              >
                {({ focused }) => (
                  <View>
                    <View style={[
                      { width: cardWidth, height: cardHeight, borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 2, borderColor: "rgba(255,255,255,0.05)" },
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
                      {hasResume ? (
                        <>
                          <View style={styles.resumeBadge}>
                            <Text style={styles.resumeBadgeLabel}>RESUME · {progressPct > 0 ? `${progressPct}%` : `${resumeMinutes}m`}</Text>
                          </View>
                          {progressPct > 0 ? (
                            <View style={styles.progressTrack}>
                              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                            </View>
                          ) : null}
                        </>
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
              <Pressable
                testID={`watchlist-${item.rating_key}`}
                accessibilityRole="button"
                accessibilityLabel={isWatchlisted ? `Remove ${item.title} from Watchlist` : `Add ${item.title} to Watchlist`}
                accessibilityState={{ selected: isWatchlisted }}
                focusable
                onPress={() => toggleWatchlist.mutate(item)}
                style={({ focused }) => [styles.watchlistButton, focused && styles.watchlistButtonFocused]}
              >
                <Ionicons name={isWatchlisted ? "bookmark" : "bookmark-outline"} size={ms(17)} color={isWatchlisted ? colors.cyan : "#fff"} />
              </Pressable>
            </View>
          );
        }}
      />
    </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: vs(8),
  },
  sortCaption: {
    color: colors.zinc500,
    fontFamily: "Outfit_600SemiBold",
    fontSize: SIZES.fontTiny,
    letterSpacing: 1,
    marginRight: 2,
  },
  sortChip: {
    minHeight: vs(34),
    justifyContent: "center",
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  sortChipActive: { backgroundColor: "rgba(103,232,249,0.18)", borderColor: colors.cyan },
  sortChipFocused: { borderColor: colors.purple, backgroundColor: "rgba(139,92,246,0.24)" },
  sortChipLabel: { color: colors.zinc300, fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
  sortChipLabelActive: { color: colors.cyan, fontFamily: "Unbounded_700Bold" },
  watchlistButton: {
    position: "absolute",
    top: 40,
    right: 8,
    width: ms(34),
    height: ms(34),
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,6,20,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    zIndex: 2,
    elevation: 4,
  },
  watchlistButtonFocused: { borderColor: colors.cyan, backgroundColor: "rgba(6,182,212,0.3)" },
  resumeBadge: {
    position: "absolute",
    left: 8,
    bottom: 42,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(5,6,20,0.82)",
  },
  resumeBadgeLabel: { color: colors.cyan, fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontTiny },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressFill: { height: 4, backgroundColor: colors.cyan },
});

export default LibraryGrid;
