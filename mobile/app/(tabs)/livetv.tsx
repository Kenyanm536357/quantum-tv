import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator,
  useTVEventHandler, TVFocusGuideView, Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import TVTextInput from "../../src/TVTextInput";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "../../src/responsive";

type Channel = {
  key: string;
  title: string;
  number?: number | string;
  logo?: string;
  source?: "plex" | "iptv";
};

const MAX_CHANNELS = 400; // Fire TV list perf cap; user can search to narrow.
const NUM_BUFFER_TIMEOUT_MS = 2200; // clear the typed channel-number buffer if user pauses

// Extract digit (0-9) from a react-native-tvos event. The event's eventType is
// a string; standard remotes fire "up"/"down"/etc., but USB keyboards and
// keypad remotes send numeric key codes here. Android keycodes 7-15 map to
// digits 0-9, but some builds pass the literal digit string. Cover both.
function digitFromTvEvent(evt: { eventType?: string; eventKeyAction?: string | number }): number | null {
  if (!evt || !evt.eventType) return null;
  if (evt.eventKeyAction === 1 || evt.eventKeyAction === "up") return null; // only fire on keydown
  const et = String(evt.eventType);
  if (/^[0-9]$/.test(et)) return parseInt(et, 10);
  const m = et.match(/(?:^|_|digit|num)(\d)$/i);
  if (m) return parseInt(m[1], 10);
  const asInt = parseInt(et, 10);
  if (asInt >= 7 && asInt <= 16) return asInt - 7; // KEYCODE_0..9
  return null;
}

export default function LiveTV() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await client.get("/livetv/channels")).data as { channels: Channel[] },
  });
  const favQ = useQuery({
    queryKey: ["live-favorites"],
    queryFn: async () => (await client.get("/me/live/favorites")).data as { items: Channel[] },
  });
  const recentQ = useQuery({
    queryKey: ["live-recent"],
    queryFn: async () => (await client.get("/me/live/recent")).data as { items: Channel[] },
  });

  const favKeys = useMemo(
    () => new Set((favQ.data?.items || []).map((c) => String(c.key))),
    [favQ.data]
  );

  const toggleFav = useMutation({
    mutationFn: async (ch: Channel) => {
      const isFav = favKeys.has(String(ch.key));
      if (isFav) return client.delete(`/me/live/favorites/${encodeURIComponent(ch.key)}`);
      return client.post(`/me/live/favorites`, {
        key: String(ch.key), title: ch.title || "", logo: ch.logo || null,
        number: ch.number ?? null, source: ch.source || null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-favorites"] }),
  });

  const recordRecent = useMutation({
    mutationFn: async (ch: Channel) =>
      client.post(`/me/live/recent`, {
        key: String(ch.key), title: ch.title || "", logo: ch.logo || null,
        number: ch.number ?? null, source: ch.source || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-recent"] }),
  });

  const [source, setSource] = useState<"all" | "plex" | "iptv">("all");
  const [q, setQ] = useState("");

  const openChannel = useCallback((ch: Channel) => {
    recordRecent.mutate(ch);
    router.push({ pathname: "/player/[rk]", params: { rk: String(ch.key), title: ch.title } });
  }, [recordRecent, router]);

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

  // -------- Channel-number quick-jump --------
  // Buffer the typed digits so a user can type e.g. "1", "2", "3" quickly to
  // jump to channel 123. Auto-clears after NUM_BUFFER_TIMEOUT_MS of inactivity.
  const [jumpBuf, setJumpBuf] = useState("");
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [numpadOpen, setNumpadOpen] = useState(false);

  const clearJumpTimer = () => {
    if (jumpTimer.current) {
      clearTimeout(jumpTimer.current);
      jumpTimer.current = null;
    }
  };
  const scheduleJumpClear = () => {
    clearJumpTimer();
    jumpTimer.current = setTimeout(() => setJumpBuf(""), NUM_BUFFER_TIMEOUT_MS);
  };

  const commitJump = useCallback((buf: string) => {
    if (!buf) return;
    const target = parseInt(buf, 10);
    if (isNaN(target)) return;
    const all = data?.channels || [];
    // Prefer exact channel-number match
    const hit = all.find((c) => Number(c.number) === target);
    if (hit) {
      setJumpBuf("");
      clearJumpTimer();
      openChannel(hit);
    }
  }, [data, openChannel]);

  const pressDigit = useCallback((d: number) => {
    setJumpBuf((prev) => {
      const next = (prev + String(d)).slice(-4); // channel numbers are rarely >4 digits
      // Auto-tune when the buffer would only ever match one channel: if there's
      // exactly one channel whose number starts with `next`, wait a beat for
      // more input; if the user's clearly typed a full number, we still wait
      // for the timeout to fire commitJump. Simpler: always schedule.
      return next;
    });
    scheduleJumpClear();
  }, []);

  const eraseDigit = useCallback(() => {
    setJumpBuf((prev) => prev.slice(0, -1));
    scheduleJumpClear();
  }, []);

  // TV remote listener — attempts to catch digit key events from external
  // keyboards / 3rd-party remotes that DO send numeric keycodes on Fire TV.
  const onTvEvent = useCallback((evt: any) => {
    const d = digitFromTvEvent(evt);
    if (d !== null) {
      pressDigit(d);
    }
  }, [pressDigit]);
  useTVEventHandler(onTvEvent);

  // Commit the buffered jump ~1.6s after the last digit — gives the user a
  // brief window to add another digit before we auto-tune.
  useEffect(() => {
    if (!jumpBuf) return;
    const t = setTimeout(() => commitJump(jumpBuf), 1600);
    return () => clearTimeout(t);
  }, [jumpBuf, commitJump]);

  // Cleanup on unmount
  useEffect(() => () => clearJumpTimer(), []);

  const favItems = favQ.data?.items || [];
  const recentItems = recentQ.data?.items || [];
  const showStrips = !q.trim() && source === "all";

  // Snapshot the initial "did we show strips at mount time?" so that
  // hasTVPreferredFocus doesn't re-fire on subsequent renders (which
  // would trap focus on the first grid card).
  const initialShowStripsRef = useRef(showStrips);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: SAFE.top }}>
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(12), flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIVE</Text>
          <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>All Channels</Text>
          {counts.all > 0 && (
            <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 4 }}>
              {counts.all.toLocaleString()} channel{counts.all === 1 ? "" : "s"}
              {counts.plex > 0 && counts.iptv > 0 ? ` · ${counts.plex.toLocaleString()} Plex + ${counts.iptv.toLocaleString()} IPTV` : ""}
            </Text>
          )}
        </View>
        <Pressable
          testID="live-jump-btn"
          focusable
          onPress={() => setNumpadOpen(true)}
          style={({ focused }) => [
            {
              paddingHorizontal: s(14), paddingVertical: vs(8), borderRadius: 999,
              flexDirection: "row", alignItems: "center", gap: 6,
              borderWidth: 2, borderColor: focused ? colors.cyan : "rgba(103,232,249,0.35)",
              backgroundColor: "rgba(139,92,246,0.20)",
            },
          ]}
        >
          <Ionicons name="keypad-outline" size={ms(16)} color="#fff" />
          <Text style={{ color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall }}>Jump</Text>
        </Pressable>
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
          <TVTextInput
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
        ListHeaderComponent={
          showStrips ? (
            <View>
              <ChannelStrip
                testIDBase="live-favorites"
                title="⭐ Favorites"
                subtitle={favItems.length ? `${favItems.length} pinned` : undefined}
                items={favItems}
                favKeys={favKeys}
                onOpen={openChannel}
                onToggleFav={(c) => toggleFav.mutate(c)}
              />
              <ChannelStrip
                testIDBase="live-recent"
                title="Recently Watched"
                subtitle={recentItems.length ? `Last ${recentItems.length} tuned` : undefined}
                items={recentItems}
                favKeys={favKeys}
                onOpen={openChannel}
                onToggleFav={(c) => toggleFav.mutate(c)}
              />
              {(favItems.length > 0 || recentItems.length > 0) && (
                <Text style={{ color: colors.zinc400, fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2, letterSpacing: 0.3, marginTop: vs(10), marginBottom: vs(8) }}>
                  All Channels
                </Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <ChannelCard
            item={item}
            index={index}
            isFav={favKeys.has(String(item.key))}
            onOpen={openChannel}
            onToggleFav={(c) => toggleFav.mutate(c)}
            hasPreferredFocus={!initialShowStripsRef.current && index === 0}
          />
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

      {/* Floating channel-number typing overlay (visible while user is typing) */}
      {jumpBuf.length > 0 && !numpadOpen && (
        <View pointerEvents="none" style={styles.jumpBanner}>
          <Ionicons name="keypad-outline" size={ms(18)} color="#fff" />
          <Text style={styles.jumpBannerLabel}>Ch</Text>
          <Text style={styles.jumpBannerNum}>{jumpBuf}</Text>
        </View>
      )}

      {/* On-screen numpad — for the vanilla Fire TV remote (no digit keys) */}
      <NumpadOverlay
        open={numpadOpen}
        buffer={jumpBuf}
        onClose={() => setNumpadOpen(false)}
        onDigit={pressDigit}
        onErase={eraseDigit}
        onGo={() => { setNumpadOpen(false); commitJump(jumpBuf); }}
        onClear={() => setJumpBuf("")}
      />
    </View>
  );
}

// ---- Channel card (grid + strip) ----------------------------------------
function ChannelCard({
  item, index, isFav, onOpen, onToggleFav, hasPreferredFocus, width,
}: {
  item: Channel; index: number; isFav: boolean;
  onOpen: (c: Channel) => void; onToggleFav: (c: Channel) => void;
  hasPreferredFocus?: boolean; width?: number;
}) {
  const cardH = width ? Math.round(width * 0.56) : (IS_TV ? vs(180) : vs(160));
  return (
    <Pressable
      testID={`channel-${item.key}`}
      focusable
      hasTVPreferredFocus={!!hasPreferredFocus}
      style={({ focused }) => [
        width ? { width, marginRight: SIZES.gap } : { flex: 1 },
        { borderRadius: SIZES.radius },
        focused && FOCUSED_CARD,
      ]}
      onPress={() => onOpen(item)}
      onLongPress={() => onToggleFav(item)}
    >
      <View style={{ height: cardH, borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
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
        {isFav && (
          <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(250,204,21,0.95)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="star" size={ms(11)} color="#050614" />
          </View>
        )}
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody }} numberOfLines={1}>{item.title}</Text>
          {item.number ? <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 2 }}>Channel {item.number}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ---- Horizontal channel strip (Favorites, Recent) ------------------------
function ChannelStrip({
  testIDBase, title, subtitle, items, favKeys, onOpen, onToggleFav,
}: {
  testIDBase: string;
  title: string;
  subtitle?: string;
  items: Channel[];
  favKeys: Set<string>;
  onOpen: (c: Channel) => void;
  onToggleFav: (c: Channel) => void;
}) {
  if (!items?.length) return null;
  const cardW = IS_TV ? s(220) : s(170);
  return (
    <TVFocusGuideView style={{ marginTop: vs(6), marginBottom: vs(10) }} trapFocusUp={false} trapFocusDown={false} testID={`${testIDBase}-row`}>
      <View style={{ marginBottom: vs(6) }}>
        <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2, letterSpacing: 0.3 }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(it, i) => `${testIDBase}-${it.key}-${i}`}
        renderItem={({ item, index }) => (
          <ChannelCard
            item={item}
            index={index}
            isFav={favKeys.has(String(item.key))}
            onOpen={onOpen}
            onToggleFav={onToggleFav}
            width={cardW}
          />
        )}
        contentContainerStyle={{ paddingVertical: vs(4) }}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />
    </TVFocusGuideView>
  );
}

// ---- Numpad overlay (D-pad friendly) -------------------------------------
function NumpadOverlay({
  open, buffer, onClose, onDigit, onErase, onGo, onClear,
}: {
  open: boolean;
  buffer: string;
  onClose: () => void;
  onDigit: (d: number) => void;
  onErase: () => void;
  onGo: () => void;
  onClear: () => void;
}) {
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View style={styles.numpadBackdrop}>
        <View style={styles.numpadCard}>
          <Text style={styles.numpadTitle}>Jump to Channel</Text>
          <Text style={styles.numpadHint}>Enter a channel number and press Go — or tap ✕ to close.</Text>
          <View style={styles.numpadDisplay}>
            <Text style={styles.numpadDisplayNum} testID="numpad-buffer">{buffer || "—"}</Text>
          </View>
          <View style={styles.numpadGrid}>
            {[1,2,3,4,5,6,7,8,9].map((d) => (
              <NumKey key={d} label={String(d)} testID={`numpad-${d}`} onPress={() => onDigit(d)} hasTVPreferredFocus={d === 5} />
            ))}
            <NumKey label="⌫" testID="numpad-erase" onPress={onErase} />
            <NumKey label="0" testID="numpad-0" onPress={() => onDigit(0)} />
            <NumKey label="Go" testID="numpad-go" onPress={onGo} accent />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: vs(12) }}>
            <Pressable testID="numpad-clear" focusable onPress={onClear} style={({ focused }) => [styles.numpadSecondaryBtn, focused && { borderColor: colors.cyan }]}>
              <Text style={styles.numpadSecondaryLabel}>Clear</Text>
            </Pressable>
            <Pressable testID="numpad-close" focusable onPress={onClose} style={({ focused }) => [styles.numpadSecondaryBtn, focused && { borderColor: colors.cyan }]}>
              <Text style={styles.numpadSecondaryLabel}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NumKey({ label, testID, onPress, accent, hasTVPreferredFocus }: {
  label: string; testID?: string; onPress: () => void; accent?: boolean; hasTVPreferredFocus?: boolean;
  key?: React.Key;
}) {
  return (
    <Pressable
      testID={testID}
      focusable
      hasTVPreferredFocus={!!hasTVPreferredFocus}
      onPress={onPress}
      style={({ focused }) => [
        styles.numKey,
        accent && { backgroundColor: colors.cyan },
        focused && { borderColor: colors.cyan, transform: [{ scale: 1.04 }], borderWidth: 3 },
      ]}
    >
      <Text style={[styles.numKeyLabel, accent && { color: "#050614" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  jumpBanner: {
    position: "absolute", top: SAFE.top + vs(18), alignSelf: "center",
    backgroundColor: "rgba(6,7,20,0.92)", borderColor: colors.cyan, borderWidth: 2,
    borderRadius: 999, paddingHorizontal: s(20), paddingVertical: vs(8),
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 20, elevation: 20,
  },
  jumpBannerLabel: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, letterSpacing: 1.5, textTransform: "uppercase" },
  jumpBannerNum: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(28), letterSpacing: 2 },

  numpadBackdrop: { flex: 1, backgroundColor: "rgba(6,7,20,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  numpadCard: {
    width: IS_TV ? s(430) : s(310),
    backgroundColor: "#0D0E23", borderRadius: SIZES.radiusLg, padding: s(20),
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  numpadTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH1 },
  numpadHint: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 4 },
  numpadDisplay: {
    marginTop: vs(12), backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: SIZES.radius, paddingVertical: vs(14), alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  numpadDisplayNum: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(36), letterSpacing: 4 },
  numpadGrid: {
    marginTop: vs(14),
    flexDirection: "row", flexWrap: "wrap", gap: s(8),
  },
  numKey: {
    width: "31%", aspectRatio: 1.6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: SIZES.radius, borderWidth: 2, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  numKeyLabel: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(24) },
  numpadSecondaryBtn: {
    flex: 1, borderRadius: 999, paddingVertical: vs(10),
    borderWidth: 2, borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  numpadSecondaryLabel: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },
});
