import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator,
  TVFocusGuideView, Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import TVTextInput from "../../src/TVTextInput";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms, s, FOCUSED_CARD } from "../../src/responsive";

type Channel = {
  key: string;
  title: string;
  number?: number | string;
  logo?: string;
  source?: "plex" | "iptv";
  category_id?: string | number;
  category_name?: string;
  country?: string;
  genre?: string;
};

type LiveCategory = { category_id: string; category_name: string };

const MAX_CHANNELS = 400; // Fire TV list perf cap; user can search to narrow.
const NUM_BUFFER_TIMEOUT_MS = 2200; // clear the typed channel-number buffer if user pauses

// Parse a raw IPTV category name (e.g. "US| USA - Sports HD", "UK - News",
// "Kids Movies") into a coarse country + genre. The heuristic is lossy but
// gives us clean, browseable chips. Anything unrecognized falls into "Other".
const COUNTRY_MAP: Array<[RegExp, string]> = [
  [/\b(US|USA|UNITED\s*STATES|U\.S\.)\b/i, "USA"],
  [/\b(UK|UNITED\s*KINGDOM|GB|GREAT\s*BRITAIN|BRITAIN|BRIT)\b/i, "UK"],
  [/\b(CA|CAN|CANADA)\b/i, "Canada"],
  [/\b(AU|AUS|AUSTRALIA)\b/i, "Australia"],
  [/\b(MX|MEX|MEXICO)\b/i, "Mexico"],
  [/\b(IN|IND|INDIA)\b/i, "India"],
  [/\b(FR|FRA|FRANCE|FRENCH)\b/i, "France"],
  [/\b(DE|GER|GERMAN(?:Y)?|DEUTSCH)\b/i, "Germany"],
  [/\b(ES|SPAIN|SPANISH|ESPAN|LATINO)\b/i, "Spanish"],
  [/\b(IT|ITA|ITALY|ITALIAN)\b/i, "Italy"],
  [/\b(BR|BRA|BRAZIL|BRASIL)\b/i, "Brazil"],
  [/\b(PT|PORT|PORTUGAL)\b/i, "Portugal"],
  [/\b(NL|NETH|NETHERLANDS|DUTCH)\b/i, "Netherlands"],
  [/\b(AR|ARAB|ARABIC|MENA)\b/i, "Arabic"],
  [/\b(JP|JAP|JAPAN|JAPANESE)\b/i, "Japan"],
  [/\b(CN|CHI|CHINA|CHINESE)\b/i, "China"],
  [/\b(KR|KOR|KOREA(?:N)?)\b/i, "Korea"],
  [/\b(IE|IRE|IRELAND|IRISH)\b/i, "Ireland"],
  [/\b(RU|RUS|RUSSIA(?:N)?)\b/i, "Russia"],
  [/\b(TR|TUR|TURK(?:EY|ISH)?)\b/i, "Turkey"],
];
const GENRE_MAP: Array<[RegExp, string]> = [
  [/\b(SPORT(?:S)?|ESPN|NFL|NBA|MLB|NHL|SOCCER|FOOTBALL|GOLF|RACING|FIGHT|UFC|BOXING|WWE|WRESTLING)\b/i, "Sports"],
  [/\b(NEWS|CNN|FOX(?:\s*NEWS)?|MSNBC|CNBC|BBC|BLOOMBERG|NEWSMAX)\b/i, "News"],
  [/\b(KIDS|CHILDREN|CARTOON|DISNEY|NICK(?:ELODEON)?)\b/i, "Kids"],
  [/\b(MOVIE(?:S)?|CINEMA|FILM)\b/i, "Movies"],
  [/\b(MUSIC|MTV|VEVO)\b/i, "Music"],
  [/\b(DOC(?:UMENTARY|UMENTARIES)?|NAT\s*GEO|DISCOVERY|HISTORY|SCIENCE)\b/i, "Documentary"],
  [/\b(RELIGION|CHURCH|GOSPEL|CHRIST|FAITH|CATHOLIC|MUSLIM|ISLAM)\b/i, "Religion"],
  [/\b(ENT(?:ERTAINMENT)?|LIFESTYLE|REALITY|VARIETY)\b/i, "Entertainment"],
  [/\b(24\/?7|247)\b/i, "24/7"],
  [/\b(PPV|PAY\s*PER\s*VIEW|EVENT(?:S)?)\b/i, "PPV / Events"],
  [/\b(ADULT|XXX|EROTIC)\b/i, "Adult"],
];
function classifyCategory(name: string): { country: string; genre: string } {
  const upper = (name || "").toUpperCase();
  let country = "Other";
  for (const [re, label] of COUNTRY_MAP) { if (re.test(upper)) { country = label; break; } }
  let genre = "General";
  for (const [re, label] of GENRE_MAP) { if (re.test(upper)) { genre = label; break; } }
  return { country, genre };
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

  const [country, setCountry] = useState<string>("All");
  const [genre, setGenre] = useState<string>("All");
  const [q, setQ] = useState("");

  const openChannel = useCallback((ch: Channel) => {
    recordRecent.mutate(ch);
    router.push({ pathname: "/player/[rk]", params: { rk: String(ch.key), title: ch.title } });
  }, [recordRecent, router]);

  const { list, counts, overflow, countries, genres } = useMemo(() => {
    const all: Channel[] = data?.channels || [];
    // Build the country + genre chip lists from what's actually in the data,
    // sorted by count desc so USA/Sports/etc. surface first.
    const countryCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    for (const c of all) {
      const co = c.country || "Other";
      const ge = c.genre || "General";
      countryCounts.set(co, (countryCounts.get(co) || 0) + 1);
      genreCounts.set(ge, (genreCounts.get(ge) || 0) + 1);
    }
    const countries = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]);
    const genres = Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1]);
    let filtered = all;
    if (country !== "All") filtered = filtered.filter((x) => (x.country || "Other") === country);
    if (genre !== "All") filtered = filtered.filter((x) => (x.genre || "General") === genre);
    const needle = q.trim().toLowerCase();
    if (needle) filtered = filtered.filter((x) => (x.title || "").toLowerCase().includes(needle));
    const overflow = Math.max(0, filtered.length - MAX_CHANNELS);
    const c = { all: all.length };
    return { list: filtered.slice(0, MAX_CHANNELS), counts: c, overflow, countries, genres };
  }, [data, country, genre, q]);

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
    setJumpBuf((prev) => (prev + String(d)).slice(-4));
    clearJumpTimer();
    jumpTimer.current = setTimeout(() => setJumpBuf(""), NUM_BUFFER_TIMEOUT_MS);
  }, []);

  const eraseDigit = useCallback(() => {
    setJumpBuf((prev) => prev.slice(0, -1));
    clearJumpTimer();
    jumpTimer.current = setTimeout(() => setJumpBuf(""), NUM_BUFFER_TIMEOUT_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => clearJumpTimer(), []);

  const favItems = favQ.data?.items || [];
  const recentItems = recentQ.data?.items || [];
  const showStrips = !q.trim() && country === "All" && genre === "All";

  // Snapshot the initial "did we show strips at mount time?" so that
  // hasTVPreferredFocus doesn't re-fire on subsequent renders (which
  // would trap focus on the first grid card).
  const initialShowStripsRef = useRef(showStrips);

  return (
    <BrandBackground>
    <View style={{ flex: 1, paddingTop: SAFE.top }}>
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(12), flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: IS_TV ? ms(40) : ms(30), height: IS_TV ? ms(40) : ms(30), borderRadius: ms(8) }}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIVE</Text>
            <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>All Channels</Text>
            {counts.all > 0 && (
              <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 4 }}>
                {list.length.toLocaleString()} of {counts.all.toLocaleString()} channel{counts.all === 1 ? "" : "s"}
              </Text>
            )}
          </View>
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

      {/* Country + Genre filters — two horizontal-scroll chip rows so the
          user can quickly narrow ~5000 channels down to something manageable. */}
      {countries.length > 1 && (
        <FilterChipRow
          testIDBase="live-country"
          label="Country"
          value={country}
          items={countries}
          onChange={setCountry}
        />
      )}
      {genres.length > 1 && (
        <FilterChipRow
          testIDBase="live-genre"
          label="Genre"
          value={genre}
          items={genres}
          onChange={setGenre}
        />
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
                No channels match your filters.{"\n"}Try switching country or genre, or clear the search.
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
    </BrandBackground>
  );
}

// ---- Filter chip row (horizontal scroll, D-pad friendly) ---------------
// Renders an "All" chip plus one chip per distinct value found in the
// data (sorted by count desc, so USA/Sports surface first).
function FilterChipRow({
  testIDBase, label, value, items, onChange,
}: {
  testIDBase: string;
  label: string;
  value: string;
  items: Array<[string, number]>; // [label, count] pairs
  onChange: (v: string) => void;
}) {
  const total = items.reduce((sum, [, n]) => sum + n, 0);
  const chips = [["All", total] as [string, number], ...items];
  return (
    <View style={{ marginBottom: vs(8) }} testID={`${testIDBase}-row`}>
      <Text style={{ color: colors.zinc500, letterSpacing: 1.5, textTransform: "uppercase", fontSize: SIZES.fontTiny, fontFamily: "Outfit_400Regular", paddingHorizontal: SAFE.left, marginBottom: 4 }}>
        {label}
      </Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={chips}
        keyExtractor={(c, i) => `${testIDBase}-${c[0]}-${i}`}
        contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingRight: SAFE.right, gap: 8, paddingVertical: 4 }}
        renderItem={({ item }) => {
          const [name, count] = item;
          const active = value === name;
          return (
            <Pressable
              testID={`${testIDBase}-${name}`}
              onPress={() => onChange(name)}
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
              <Text style={{ color: active ? "#fff" : colors.zinc400, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall }}>
                {name} <Text style={{ color: active ? "rgba(255,255,255,0.7)" : colors.zinc500 }}>({count.toLocaleString()})</Text>
              </Text>
            </Pressable>
          );
        }}
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
