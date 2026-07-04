import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import TVTextInput from "../../src/TVTextInput";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "../../src/responsive";

type Channel = { key: string; title: string; number?: number | string; logo?: string; source?: "plex" | "iptv" };

const MAX_CHANNELS = 400; // Fire TV list perf cap; user can search to narrow.

export default function LiveTV() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await client.get("/livetv/channels")).data as { channels: Channel[] },
  });
  const [source, setSource] = useState<"all" | "plex" | "iptv">("all");
  const [q, setQ] = useState("");

  const { list, counts, overflow } = useMemo(() => {
    const all: Channel[] = data?.channels || [];
    const c = {
      all: all.length,
      plex: all.filter((x) => x.source === "plex").length,
      iptv: all.filter((x) => x.source === "iptv").length,
    };
    let filtered = all;
    if (source !== "all") filtered = filtered.filter((x) => x.source === source);
    const needle = q.trim().toLowerCase();
    if (needle) filtered = filtered.filter((x) => (x.title || "").toLowerCase().includes(needle));
    const overflow = Math.max(0, filtered.length - MAX_CHANNELS);
    return { list: filtered.slice(0, MAX_CHANNELS), counts: c, overflow };
  }, [data, source, q]);

  const chips: Array<{ id: "all" | "plex" | "iptv"; label: string; show: boolean }> = [
    { id: "all", label: `All (${counts.all.toLocaleString()})`, show: true },
    { id: "plex", label: `Plex (${counts.plex.toLocaleString()})`, show: counts.plex > 0 },
    { id: "iptv", label: `IPTV (${counts.iptv.toLocaleString()})`, show: counts.iptv > 0 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: SAFE.top }}>
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(12) }}>
        <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIVE</Text>
        <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>All Channels</Text>
        {counts.all > 0 && (
          <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 4 }}>
            {counts.all.toLocaleString()} channel{counts.all === 1 ? "" : "s"}
            {counts.plex > 0 && counts.iptv > 0 ? ` · ${counts.plex.toLocaleString()} Plex + ${counts.iptv.toLocaleString()} IPTV` : ""}
          </Text>
        )}
      </View>

      {counts.all > 0 && (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: SAFE.left, marginBottom: vs(10), flexWrap: "wrap" }}>
          {chips.filter((c) => c.show).map((c) => {
            const active = source === c.id;
            return (
              <Pressable
                key={c.id}
                testID={`live-source-${c.id}`}
                onPress={() => setSource(c.id)}
                focusable
                style={({ focused }) => [
                  {
                    paddingHorizontal: s(14), paddingVertical: vs(6),
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: focused ? colors.cyan : (active ? "rgba(103,232,249,0.4)" : "rgba(255,255,255,0.10)"),
                    backgroundColor: active ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.04)",
                  },
                ]}
              >
                <Text style={{ color: active ? "#fff" : colors.zinc400, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {counts.all > 30 && (
        <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(12) }}>
          <TextInput
            testID="live-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search channels…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{
              backgroundColor: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.10)", borderWidth: 1,
              color: "#fff", fontFamily: "Outfit_400Regular",
              paddingHorizontal: s(14), paddingVertical: vs(10),
              borderRadius: SIZES.radius, fontSize: SIZES.fontSmall,
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {isLoading && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}

      <FlatList
        contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40) }}
        data={list}
        keyExtractor={(it, i) => `${it.key}-${i}`}
        numColumns={GRID_COLS.channels}
        columnWrapperStyle={{ gap: SIZES.gap }}
        ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item, index }) => (
          <Pressable
            testID={`channel-${item.key}`}
            focusable
            hasTVPreferredFocus={index === 0}
            style={({ focused }) => [{ flex: 1, borderRadius: SIZES.radius }, focused && FOCUSED_CARD]}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.key), title: item.title } })}
          >
            <View style={{ height: IS_TV ? vs(180) : vs(160), borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
              {item.logo ? (
                <Image
                  source={{ uri: item.logo.startsWith("http") ? item.logo : `${BACKEND}${item.logo}` }}
                  style={[StyleSheet.absoluteFill, { padding: 20 }]}
                  resizeMode="contain"
                />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} />
              <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: colors.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                <Text style={{ color: "#fff", fontSize: SIZES.fontTiny, fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.5 }}>LIVE</Text>
              </View>
              <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
                <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody }} numberOfLines={1}>{item.title}</Text>
                {item.number ? <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 2 }}>Channel {item.number}</Text> : null}
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={() =>
          !isLoading && (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="radio-outline" size={ms(36)} color={colors.zinc500} />
              <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center", fontSize: SIZES.fontSmall }}>
                No channels match your filters.{"\n"}Try switching source or clearing the search.
              </Text>
            </View>
          )
        }
        ListFooterComponent={() =>
          overflow > 0 ? (
            <Text style={{ color: colors.zinc500, textAlign: "center", marginTop: vs(16), fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall }}>
              Showing {MAX_CHANNELS.toLocaleString()} of {(list.length + overflow).toLocaleString()} — search to narrow.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
