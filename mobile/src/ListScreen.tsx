import { useRef } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, Image, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useChannelScroll } from "./useChannelScroll";
import { useParentalGate, isAdultCategory } from "./useParentalGate";
import { setChannelContext } from "./channelContext";
import ImageWithFallback from "./ImageWithFallback";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "./api";
import BrandBackground from "./BrandBackground";
import { useSafeTopInset } from "./useSafeTopInset";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "./responsive";

export function ListScreen({ endpoint, additionalEndpoints = [], title, removeLabel, removeFromList, emptyText }: any) {
  const { width: screenWidth } = useWindowDimensions();
  const safeTop = useSafeTopInset();
  const router = useRouter();
  const qc = useQueryClient();
  const isFocused = useIsFocused();
  const listRef = useRef<FlatList<any>>(null);
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => {
      const responses = await Promise.all([endpoint, ...additionalEndpoints].map((url: string) => client.get(url)));
      const items = responses.flatMap((response: any, index: number) => {
        const rows = response.data?.items || [];
        if (index === 0) return rows;
        return rows.map((item: any) => ({
          ...item,
          rating_key: String(item.rating_key || item.key),
          type: "live",
          thumb: item.thumb || item.logo || null,
          favorite_source: "live",
        }));
      });
      return { items: Array.from(new Map(items.map((item: any) => [String(item.rating_key), item])).values()) };
    },
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    // Poll every 5s while visible so new favorites/watchlist items appear without restarting.
    refetchInterval: isFocused ? 5000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
  const remove = useMutation({
    mutationFn: async (item: any) => removeFromList(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [endpoint] });
      additionalEndpoints.forEach((url: string) => qc.invalidateQueries({ queryKey: [url] }));
    },
  });

  const columns = GRID_COLS.posters;
  const gridGap = SIZES.gap;
  const cardWidth = Math.max(96, (screenWidth - SAFE.left - SAFE.right - gridGap * (columns - 1)) / columns);
  const cardHeight = cardWidth * 1.5;

  const { requiresPin } = useParentalGate();
  const visibleItems = (data?.items || []).filter(
    (it: any) => !requiresPin || !isAdultCategory(it.genre, it.category_name, it.title),
  );
  const itemCount = visibleItems.length;
  const { preferIndex, onItemFocus } = useChannelScroll({
    enabled: isFocused,
    count: itemCount,
    step: columns * 2,
    scrollToIndex: (index) => listRef.current?.scrollToIndex({ index: Math.floor(index / columns) * columns, viewPosition: 0.3, animated: false }),
  });

  const openItem = (item: any) => {
    setChannelContext(
      visibleItems
        .filter((it: any) => it.favorite_source === "live")
        .map((it: any) => ({ key: String(it.rating_key), title: it.title })),
    );
    // Shows must first show a season/episode picker.
    if ((item.type || "").toLowerCase() === "show") {
      router.push({ pathname: "/show/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    } else if ((item.type || "").toLowerCase() === "movie") {
      router.push({ pathname: "/movie/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    } else {
      router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } });
    }
  };

  return (
    <BrandBackground>
      <View style={{ flex: 1, paddingTop: safeTop }}>
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
          ref={listRef}
          onScrollToIndexFailed={(info) => listRef.current?.scrollToOffset({ offset: info.averageItemLength * Math.floor(info.index / columns), animated: false })}
          contentContainerStyle={{ paddingLeft: SAFE.left, paddingRight: SAFE.right, paddingBottom: SIZES.tabBarH + vs(40), paddingTop: vs(16) }}
          data={visibleItems}
          keyExtractor={(it: any) => String(it.rating_key || it.key)}
          numColumns={columns}
          key={`list-grid-${columns}`}
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
              style={({ focused }) => [{ width: cardWidth, borderRadius: SIZES.radius }, focused && FOCUSED_CARD]}
              focusable
              hasTVPreferredFocus={index === preferIndex}
              onFocus={() => onItemFocus(index)}
              onPress={() => openItem(item)}
              onLongPress={() => remove.mutate(item)}
            >
              <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
                {item.thumb ? (
                  <Image source={{ uri: item.thumb.startsWith("http") ? item.thumb : `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
