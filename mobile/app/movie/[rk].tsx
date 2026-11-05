import React, { useMemo } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import client, { BACKEND, colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import { SAFE, SIZES, IS_TV, ms, s, vs } from "../../src/responsive";
import { useSafeTopInset } from "../../src/useSafeTopInset";

type MovieMeta = {
  rating_key: string;
  title?: string;
  type?: string;
  thumb?: string | null;
  art?: string | null;
  year?: string | number | null;
  summary?: string | null;
  audience_rating?: string | number | null;
  genre?: string | null;
  director?: string | null;
  cast?: string[];
  duration_seconds?: number | string | null;
  in_favorites?: boolean;
  in_watchlist?: boolean;
};

type Progress = { position_ms?: number; duration_ms?: number; resumable?: boolean; progress_pct?: number };

function imageUrl(path?: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${BACKEND}${path}`;
}

function durationLabel(value?: number | string | null) {
  const seconds = Number(value || 0);
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}

export default function MoviePreview() {
  useWindowDimensions();
  const safeTop = useSafeTopInset();
  const { rk, title: routeTitle } = useLocalSearchParams<{ rk: string; title?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const ratingKey = String(rk || "");

  const meta = useQuery({
    queryKey: ["movie-meta", ratingKey],
    enabled: !!ratingKey,
    queryFn: async () => (await client.get(`/metadata/${encodeURIComponent(ratingKey)}`)).data as MovieMeta,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const progress = useQuery({
    queryKey: ["progress", ratingKey],
    enabled: !!ratingKey,
    queryFn: async () => (await client.get(`/me/progress/${encodeURIComponent(ratingKey)}`)).data as Progress,
    staleTime: 30_000,
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => meta.data?.in_favorites
      ? client.delete(`/me/favorites/${encodeURIComponent(ratingKey)}`)
      : client.post("/me/favorites", { rating_key: ratingKey, title: meta.data?.title || routeTitle, type: "movie", thumb: meta.data?.thumb || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movie-meta", ratingKey] });
      qc.invalidateQueries({ queryKey: ["meta", ratingKey] });
      qc.invalidateQueries({ queryKey: ["favs"] });
      qc.invalidateQueries({ queryKey: ["/me/favorites"] });
    },
  });
  const watchlistMutation = useMutation({
    mutationFn: async () => meta.data?.in_watchlist
      ? client.delete(`/me/watchlist/${encodeURIComponent(ratingKey)}`)
      : client.post("/me/watchlist", { rating_key: ratingKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movie-meta", ratingKey] });
      qc.invalidateQueries({ queryKey: ["meta", ratingKey] });
      qc.invalidateQueries({ queryKey: ["/me/watchlist"] });
    },
  });

  const movie = meta.data;
  const title = movie?.title || String(routeTitle || "Movie");
  const hero = imageUrl(movie?.art || movie?.thumb);
  const poster = imageUrl(movie?.thumb);
  const canResume = progress.data?.resumable === true;
  const playLabel = canResume ? "Resume watching" : "Play movie";
  const detailChips = useMemo(() => [
    movie?.year ? String(movie.year).slice(0, 4) : null,
    movie?.audience_rating ? `Rating ${movie.audience_rating}` : null,
    durationLabel(movie?.duration_seconds),
    movie?.genre || null,
  ].filter(Boolean) as string[], [movie?.year, movie?.audience_rating, movie?.duration_seconds, movie?.genre]);

  const startPlayback = () => router.push({ pathname: "/player/[rk]", params: { rk: ratingKey, title } });

  return (
    <BrandBackground headerGlow={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: SIZES.tabBarH + vs(32) }}>
        <View style={[styles.hero, { height: IS_TV ? vs(350) : vs(315) }]}>
          {hero ? <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />}
          <LinearGradient colors={["rgba(5,6,20,0.12)", "rgba(5,6,20,0.78)", "#070914"]} locations={[0, 0.53, 1]} style={StyleSheet.absoluteFill} />
          <Pressable testID="movie-back" focusable onPress={() => router.back()} style={({ focused }) => [styles.backButton, { top: safeTop + vs(8), left: SAFE.left }, focused && styles.focused]}>
            <Ionicons name="chevron-back" size={ms(20)} color="#fff" />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
          <View style={styles.heroContent}>
            {meta.isLoading ? <ActivityIndicator color={colors.cyan} /> : null}
            <Text style={styles.kicker}>MOVIE</Text>
            <Text testID="movie-title" style={styles.title} numberOfLines={3}>{title}</Text>
            <View style={styles.chips}>
              {detailChips.map((chip) => <Text key={chip} style={styles.chip}>{chip}</Text>)}
            </View>
            <View style={styles.actions}>
              <Pressable testID="movie-play" focusable hasTVPreferredFocus onPress={startPlayback} style={({ focused }) => [styles.playButton, focused && styles.playFocused]}>
                <Ionicons name="play" size={ms(19)} color="#071018" />
                <Text style={styles.playText}>{playLabel}</Text>
              </Pressable>
              <Pressable testID="movie-watchlist" focusable onPress={() => watchlistMutation.mutate()} style={({ focused }) => [styles.iconButton, focused && styles.focused]}>
                <Ionicons name={movie?.in_watchlist ? "bookmark" : "bookmark-outline"} size={ms(20)} color={movie?.in_watchlist ? colors.cyan : "#fff"} />
                <Text style={styles.actionLabel}>{movie?.in_watchlist ? "In watchlist" : "Watchlist"}</Text>
              </Pressable>
              <Pressable testID="movie-favorite" focusable onPress={() => favoriteMutation.mutate()} style={({ focused }) => [styles.iconButton, focused && styles.focused]}>
                <Ionicons name={movie?.in_favorites ? "heart" : "heart-outline"} size={ms(20)} color={movie?.in_favorites ? "#fb7185" : "#fff"} />
                <Text style={styles.actionLabel}>{movie?.in_favorites ? "Favorited" : "Favorite"}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {progress.data?.resumable ? (
            <View style={styles.resumeTrack}>
              <View style={[styles.resumeFill, { width: `${Math.min(100, Math.max(3, Number(progress.data.progress_pct || 0)))}%` }]} />
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>About this movie</Text>
          {movie?.summary ? <Text style={styles.description}>{movie.summary}</Text> : <Text style={styles.muted}>{meta.isLoading ? "Loading movie details…" : "Description unavailable from the provider."}</Text>}
          {movie?.director ? <Text style={styles.credits}><Text style={styles.creditLabel}>Director  </Text>{movie.director}</Text> : null}
          {movie?.cast?.length ? (
            <View style={styles.castSection}>
              <Text style={styles.sectionTitle}>Cast</Text>
              <Text style={styles.cast}>{movie.cast.slice(0, 20).join("  ·  ")}</Text>
            </View>
          ) : null}
          {meta.isError ? <Text style={styles.muted}>Some movie details could not be loaded. You can still try playback.</Text> : null}
        </View>
      </ScrollView>
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  hero: { position: "relative", justifyContent: "flex-end", overflow: "hidden", backgroundColor: "#090b18" },
  heroFallback: { backgroundColor: "#101526" },
  backButton: { position: "absolute", zIndex: 5, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: ms(12), paddingVertical: vs(9), borderRadius: 6, backgroundColor: "rgba(5,6,20,0.68)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  backLabel: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
  heroContent: { paddingHorizontal: SAFE.left + ms(6), paddingRight: SAFE.right + ms(6), paddingBottom: vs(20), maxWidth: IS_TV ? s(1000) : undefined },
  kicker: { color: colors.cyan, fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontTiny, marginBottom: vs(6) },
  title: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontTitle, lineHeight: SIZES.fontTitle * 1.25, maxWidth: s(900) },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: ms(8), marginTop: vs(9) },
  chip: { color: "#e4e9f4", fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall, paddingHorizontal: ms(9), paddingVertical: vs(4), borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)" },
  actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: ms(9), marginTop: vs(15) },
  playButton: { minHeight: vs(44), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ms(8), paddingHorizontal: ms(20), borderRadius: 5, backgroundColor: colors.cyan },
  playFocused: { backgroundColor: "#fff", borderWidth: 2, borderColor: colors.cyan },
  playText: { color: "#071018", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontSmall },
  iconButton: { minHeight: vs(44), flexDirection: "row", alignItems: "center", gap: ms(7), paddingHorizontal: ms(12), borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.08)" },
  actionLabel: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
  focused: { borderColor: colors.cyan, borderWidth: 2 },
  body: { paddingHorizontal: SAFE.left + ms(6), paddingTop: vs(22), paddingRight: SAFE.right + ms(6), maxWidth: IS_TV ? s(1100) : undefined },
  resumeTrack: { height: 4, width: "100%", maxWidth: s(480), backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 2, overflow: "hidden", marginBottom: vs(20) },
  resumeFill: { height: "100%", backgroundColor: colors.cyan },
  sectionTitle: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2, marginBottom: vs(9) },
  description: { color: "#d8deeb", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontBody, lineHeight: SIZES.fontBody * 1.55, maxWidth: s(900) },
  muted: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, lineHeight: SIZES.fontSmall * 1.5, marginTop: vs(5), maxWidth: s(900) },
  credits: { color: "#d8deeb", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: vs(14) },
  creditLabel: { color: colors.zinc400, fontFamily: "Outfit_600SemiBold" },
  castSection: { marginTop: vs(24), marginBottom: vs(24) },
  cast: { color: "#d8deeb", fontFamily: "Outfit_400Regular", fontSize: SIZES.fontBody, lineHeight: SIZES.fontBody * 1.5, maxWidth: s(900) },
});
