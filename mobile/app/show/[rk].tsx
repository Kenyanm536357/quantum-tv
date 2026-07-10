import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import { SAFE, SIZES, IS_TV, vs, ms, s, FOCUSED_CARD } from "../../src/responsive";

type MetaItem = {
  rating_key: string;
  title: string;
  summary?: string;
  year?: number;
  thumb?: string;
  art?: string;
  type?: string;
  index?: number;
  parent_index?: number;
  leaf_count?: number;
  duration?: number;
  view_offset?: number;
};

// A Plex show has two levels of children:
//   show -> seasons -> episodes
// We fetch seasons on mount, then lazily fetch episodes for whichever
// season the user has selected. This keeps the initial payload small
// even for shows with thousands of episodes.
export default function ShowDetail() {
  const { rk, title: paramTitle } = useLocalSearchParams<{ rk: string; title?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const meta = useQuery({
    queryKey: ["meta", rk],
    queryFn: async () => (await client.get(`/metadata/${rk}`)).data as MetaItem & { in_favorites?: boolean },
  });

  const seasons = useQuery({
    queryKey: ["show-seasons", rk],
    queryFn: async () => (await client.get(`/metadata/${rk}/children`)).data as { items: MetaItem[] },
  });

  const [selectedSeasonRk, setSelectedSeasonRk] = useState<string | null>(null);
  const activeSeasonRk = selectedSeasonRk || (seasons.data?.items?.[0]?.rating_key ? String(seasons.data.items[0].rating_key) : null);

  const episodes = useQuery({
    enabled: !!activeSeasonRk,
    queryKey: ["show-episodes", activeSeasonRk],
    queryFn: async () => (await client.get(`/metadata/${activeSeasonRk}/children`)).data as { items: MetaItem[] },
  });

  const isFav = !!meta.data?.in_favorites;
  const toggleFav = useMutation({
    mutationFn: async () => {
      if (isFav) return client.delete(`/me/favorites/${encodeURIComponent(String(rk))}`);
      return client.post(`/me/favorites`, { rating_key: String(rk) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meta", rk] });
      qc.invalidateQueries({ queryKey: ["favs"] });
    },
  });

  const displayTitle = meta.data?.title || paramTitle || "";
  const backdrop = meta.data?.art || meta.data?.thumb || null;

  const seasonList = useMemo(() => (seasons.data?.items || []), [seasons.data]);
  const episodeList = useMemo(() => (episodes.data?.items || []), [episodes.data]);
  const activeSeason = seasonList.find((s2) => String(s2.rating_key) === String(activeSeasonRk));

  const playEpisode = (ep: MetaItem) => {
    router.push({ pathname: "/player/[rk]", params: { rk: String(ep.rating_key), title: `${displayTitle} · ${ep.title}` } });
  };

  return (
    <BrandBackground headerGlow={false}>
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: vs(60) }}>
        {/* Hero backdrop */}
        <View style={{ height: IS_TV ? vs(320) : vs(240), position: "relative" }}>
          {backdrop ? (
            <Image
              source={{ uri: backdrop.startsWith("http") ? backdrop : `${BACKEND}${backdrop}` }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={["rgba(6,7,20,0.30)", "rgba(6,7,20,0.75)", "rgba(6,7,20,1)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ position: "absolute", top: SAFE.top, left: SAFE.left, right: SAFE.right }}>
            <Pressable
              testID="show-back"
              focusable
              onPress={() => router.back()}
              style={({ focused }) => [styles.backBtn, { borderColor: focused ? colors.cyan : "rgba(255,255,255,0.12)" }]}
            >
              <Ionicons name="chevron-back" size={ms(18)} color="#fff" />
              <Text style={{ color: "#fff", fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall, marginLeft: 4 }}>Back</Text>
            </Pressable>
          </View>
          <View style={{ position: "absolute", left: SAFE.left, right: SAFE.right, bottom: vs(14) }}>
            <Text style={styles.showKicker}>TV SERIES</Text>
            <Text style={styles.showTitle} numberOfLines={2}>{displayTitle}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
              {meta.data?.year ? <Text style={styles.showMeta}>{meta.data.year}</Text> : null}
              {meta.data?.leaf_count ? <Text style={styles.showMeta}>{meta.data.leaf_count} episode{meta.data.leaf_count === 1 ? "" : "s"}</Text> : null}
              {seasonList.length > 0 ? <Text style={styles.showMeta}>{seasonList.length} season{seasonList.length === 1 ? "" : "s"}</Text> : null}
            </View>
            {meta.data?.summary ? (
              <Text style={styles.showSummary} numberOfLines={3}>{meta.data.summary}</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: vs(12) }}>
              <Pressable
                testID="show-fav"
                focusable
                onPress={() => toggleFav.mutate()}
                style={({ focused }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: isFav ? "rgba(250,204,21,0.95)" : "rgba(255,255,255,0.08)",
                    borderColor: focused ? colors.cyan : (isFav ? "rgba(250,204,21,0.95)" : "rgba(255,255,255,0.15)"),
                  },
                ]}
              >
                <Ionicons name={isFav ? "star" : "star-outline"} size={ms(18)} color={isFav ? "#050614" : "#fff"} />
                <Text style={[styles.actionLabel, { color: isFav ? "#050614" : "#fff" }]}>
                  {isFav ? "Favorited" : "Favorite"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Season tabs */}
        {seasons.isLoading ? (
          <ActivityIndicator color={colors.cyan} style={{ marginTop: 20 }} />
        ) : seasonList.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={seasonList}
            keyExtractor={(it) => String(it.rating_key)}
            contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingVertical: vs(10), gap: 8 }}
            renderItem={({ item }) => {
              const active = String(item.rating_key) === String(activeSeasonRk);
              return (
                <Pressable
                  testID={`season-${item.rating_key}`}
                  focusable
                  onPress={() => setSelectedSeasonRk(String(item.rating_key))}
                  style={({ focused }) => [
                    styles.seasonTab,
                    {
                      borderColor: focused ? colors.cyan : (active ? "rgba(103,232,249,0.5)" : "rgba(255,255,255,0.10)"),
                      backgroundColor: active ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.04)",
                    },
                  ]}
                >
                  <Text style={{ color: active ? "#fff" : colors.zinc400, fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall }}>
                    {item.title || `Season ${item.index}`}
                  </Text>
                  {item.leaf_count ? (
                    <Text style={{ color: active ? "rgba(255,255,255,0.7)" : colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginLeft: 6 }}>
                      · {item.leaf_count} ep
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        ) : null}

        {/* Episode list */}
        <Text style={styles.epHeader}>
          {activeSeason?.title || "Episodes"}
        </Text>
        {episodes.isLoading ? (
          <ActivityIndicator color={colors.cyan} style={{ marginTop: 20 }} />
        ) : episodeList.length === 0 ? (
          <Text style={{ color: colors.zinc500, textAlign: "center", marginTop: vs(20), paddingHorizontal: SAFE.left, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall }}>
            No episodes found for this season.
          </Text>
        ) : (
          <View style={{ paddingHorizontal: SAFE.left, gap: vs(8) }}>
            {episodeList.map((ep, idx) => (
              <Pressable
                key={String(ep.rating_key)}
                testID={`episode-${ep.rating_key}`}
                focusable
                hasTVPreferredFocus={idx === 0}
                onPress={() => playEpisode(ep)}
                style={({ focused }) => [
                  styles.epRow,
                  focused && FOCUSED_CARD,
                  focused && { borderColor: colors.cyan, borderWidth: 2 },
                ]}
              >
                <View style={styles.epThumb}>
                  {ep.thumb ? (
                    <Image
                      source={{ uri: ep.thumb.startsWith("http") ? ep.thumb : `${BACKEND}${ep.thumb}` }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
                  )}
                  <View style={styles.epPlayBadge}>
                    <Ionicons name="play" size={ms(16)} color="#050614" />
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.epTitle} numberOfLines={1}>
                    {ep.index ? `${ep.index}. ` : ""}{ep.title}
                  </Text>
                  {ep.duration ? (
                    <Text style={styles.epMeta}>{Math.round(ep.duration / 60000)} min</Text>
                  ) : null}
                  {ep.summary ? (
                    <Text style={styles.epSummary} numberOfLines={2}>{ep.summary}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 2,
    backgroundColor: "rgba(6,7,20,0.6)",
    alignSelf: "flex-start",
  },
  showKicker: { color: colors.zinc400, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny },
  showTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontTitle, marginTop: 2 },
  showMeta: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall },
  showSummary: { color: colors.zinc300 || "#D4D4D8", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 6 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: s(14), paddingVertical: vs(8),
    borderRadius: 999, borderWidth: 2,
  },
  actionLabel: { fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontSmall },
  seasonTab: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: s(14), paddingVertical: vs(6),
    borderRadius: 999, borderWidth: 2,
  },
  epHeader: {
    color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2,
    marginTop: vs(6), marginBottom: vs(8), paddingHorizontal: SAFE.left,
  },
  epRow: {
    flexDirection: "row", alignItems: "center",
    padding: 10, borderRadius: SIZES.radius,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.05)",
  },
  epThumb: {
    width: IS_TV ? s(150) : s(110),
    height: IS_TV ? vs(84) : vs(62),
    borderRadius: SIZES.radiusSm,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
    position: "relative",
  },
  epPlayBadge: {
    position: "absolute", top: "50%", left: "50%",
    marginTop: -14, marginLeft: -14,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.cyan, alignItems: "center", justifyContent: "center",
  },
  epTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontBody },
  epMeta: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 2 },
  epSummary: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 4 },
});
