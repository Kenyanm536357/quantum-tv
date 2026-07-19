import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator, Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import { SAFE, SIZES, IS_TV, vs, ms, s, SCREEN_W } from "../../src/responsive";

// ============================================================
// Live TV — Cable-guide-style EPG grid
// ------------------------------------------------------------
// Matches the classic TV-guide reference:
//   • Hero panel at top shows the currently-focused program
//   • Time header (30-min slots) below the hero
//   • Vertical "now" indicator line drawn through all rows
//   • Channel rows: heart + channel # + logo on the left,
//     program blocks sized proportionally to their duration on the right
//   • D-pad up/down changes row, left/right walks programs on the row
// EPG data is fetched lazily per channel via /api/livetv/epg (react-query,
// 5-min stale time) so we don't hammer the provider on a 5,000-channel list.
// ============================================================
type Channel = {
  key: string;
  title: string;
  original_title?: string;
  number?: number | string;
  logo?: string;
  source?: "plex" | "iptv";
  category_id?: string | number;
  category_name?: string;
  country?: string;
  genre?: string;
};

type Program = {
  title: string;
  description?: string;
  start_ts?: number | null;
  end_ts?: number | null;
  start?: string | null;
  end?: string | null;
};

const MAX_CHANNELS = 400;
const SLOT_MIN = 30;             // minutes per time slot
const VISIBLE_SLOTS = 4;         // slots visible in the timeline area
const NUM_BUFFER_TIMEOUT_MS = 2200;

// Timeline layout — everything is derived from SLOT_W so the "NOW" line
// and program blocks land at consistent pixel positions.
const LEFT_COL_W = IS_TV ? s(160) : s(120);
const TIMELINE_W = SCREEN_W - LEFT_COL_W - SAFE.left - SAFE.right;
const SLOT_W = Math.max(120, Math.floor(TIMELINE_W / VISIBLE_SLOTS));
const ROW_H = IS_TV ? vs(58) : vs(46);
const HEADER_H = IS_TV ? vs(38) : vs(30);
const HERO_H = IS_TV ? vs(170) : vs(130);
const PX_PER_MIN = SLOT_W / SLOT_MIN;

function formatTime(ts?: number | null): string {
  if (!ts) return "";
  try {
    const d = new Date(ts * 1000);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "p" : "a";
    h = h % 12; if (h === 0) h = 12;
    return m === 0 ? `${h}:00${ampm}` : `${h}:${m.toString().padStart(2, "0")}${ampm}`;
  } catch { return ""; }
}
function formatDayShort(ts?: number): string {
  try {
    const d = ts ? new Date(ts * 1000) : new Date();
    return d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" });
  } catch { return ""; }
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

  const openChannel = useCallback((ch: Channel) => {
    recordRecent.mutate(ch);
    router.push({ pathname: "/player/[rk]", params: { rk: String(ch.key), title: ch.title } });
  }, [recordRecent, router]);

  // Small ephemeral toast shown when a channel is favorited/unfavorited via hold-to-favorite.
  const [favToast, setFavToast] = useState<{ title: string; on: boolean } | null>(null);
  const favToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleToggleFav = useCallback((ch: Channel) => {
    const willBeFav = !favKeys.has(String(ch.key));
    toggleFav.mutate(ch);
    setFavToast({ title: ch.title || "Channel", on: willBeFav });
    if (favToastTimer.current) clearTimeout(favToastTimer.current);
    favToastTimer.current = setTimeout(() => setFavToast(null), 1800);
  }, [favKeys, toggleFav]);
  useEffect(() => () => { if (favToastTimer.current) clearTimeout(favToastTimer.current); }, []);

  // ---- Filters + search ----
  const [country, setCountry] = useState<string>("All");
  const [genre, setGenre] = useState<string>("All");
  const [filterOpen, setFilterOpen] = useState(false);

  const { list, counts, countries, genres } = useMemo(() => {
    const all: Channel[] = data?.channels || [];
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
    return { list: filtered.slice(0, MAX_CHANNELS), counts: { all: all.length }, countries, genres };
  }, [data, country, genre]);

  // ---- Time slots (updates every minute) ----
  // Anchor at the last :00 or :30 boundary; render VISIBLE_SLOTS slots
  // starting there. The "now" line is offset from that anchor.
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(t);
  }, []);
  const timelineStart = useMemo(() => {
    const half = SLOT_MIN * 60;
    return Math.floor(nowSec / half) * half;
  }, [nowSec]);
  const slotStarts = useMemo(
    () => Array.from({ length: VISIBLE_SLOTS + 1 }, (_, i) => timelineStart + i * SLOT_MIN * 60),
    [timelineStart]
  );
  const timelineEnd = slotStarts[slotStarts.length - 1];
  const nowX = Math.round(((nowSec - timelineStart) / 60) * PX_PER_MIN);

  // ---- Focused program (updates the hero panel) ----
  const [focused, setFocused] = useState<{ channel: Channel; program: Program | null } | null>(null);
  const focusedChannel = focused?.channel ?? null;
  const focusedProgram = focused?.program ?? null;

  // ---- Channel-number quick jump ----
  const [jumpBuf, setJumpBuf] = useState("");
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [numpadOpen, setNumpadOpen] = useState(false);
  const clearJumpTimer = () => { if (jumpTimer.current) { clearTimeout(jumpTimer.current); jumpTimer.current = null; } };
  const commitJump = useCallback((buf: string) => {
    if (!buf) return;
    const target = parseInt(buf, 10);
    if (isNaN(target)) return;
    const all = data?.channels || [];
    const hit = all.find((c) => Number(c.number) === target);
    if (hit) { setJumpBuf(""); clearJumpTimer(); openChannel(hit); }
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
  useEffect(() => () => clearJumpTimer(), []);

  const activeFilterCount = (country !== "All" ? 1 : 0) + (genre !== "All" ? 1 : 0);

  return (
    <BrandBackground headerGlow={false}>
      <View style={{ flex: 1, paddingTop: SAFE.top }}>
        {/* Top nav strip — slim, matches reference (no big header taking room). */}
        <View style={styles.topNav}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: ms(30), height: ms(30), borderRadius: 6 }}
            resizeMode="contain"
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.topNavDay}>{formatDayShort(nowSec)}</Text>
            <Text style={styles.topNavCount}>
              {list.length.toLocaleString()} of {counts.all.toLocaleString()} channels
              {activeFilterCount ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""}` : ""}
            </Text>
          </View>
          <Pressable
            testID="live-filter-btn"
            focusable
            onPress={() => setFilterOpen(true)}
            style={({ focused }) => [styles.topNavBtn, focused && { borderColor: colors.cyan }]}
          >
            <Ionicons name="options-outline" size={ms(16)} color="#fff" />
            <Text style={styles.topNavBtnTxt}>Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}</Text>
          </Pressable>
          <Pressable
            testID="live-jump-btn"
            focusable
            onPress={() => setNumpadOpen(true)}
            style={({ focused }) => [styles.topNavBtn, focused && { borderColor: colors.cyan }]}
          >
            <Ionicons name="keypad-outline" size={ms(16)} color="#fff" />
            <Text style={styles.topNavBtnTxt}>Jump</Text>
          </Pressable>
        </View>

        {/* Hero — currently-focused program preview */}
        <HeroPanel channel={focusedChannel} program={focusedProgram} />

        {/* Time header */}
        <View style={styles.timeHeader}>
          <View style={{ width: LEFT_COL_W, paddingLeft: SAFE.left, justifyContent: "center" }}>
            <Text style={styles.timeHeaderDay}>{formatDayShort(nowSec)}</Text>
          </View>
          {slotStarts.slice(0, VISIBLE_SLOTS).map((ts, i) => (
            <View key={i} style={{ width: SLOT_W, paddingLeft: 6, justifyContent: "center" }}>
              <Text style={styles.timeHeaderSlot}>{formatTime(ts)}</Text>
            </View>
          ))}
        </View>

        {/* Guide grid */}
        {isLoading ? (
          <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 60, paddingHorizontal: SAFE.left }}>
            <Ionicons name="tv-outline" size={ms(36)} color={colors.zinc500} />
            <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center", fontSize: SIZES.fontSmall }}>
              No channels match your filters.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, position: "relative" }}>
            <FlatList
              data={list}
              keyExtractor={(it, i) => `guide-${it.key}-${i}`}
              initialNumToRender={12}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews
              getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
              contentContainerStyle={{ paddingBottom: SIZES.tabBarH + vs(20) }}
              renderItem={({ item, index }) => (
                <GuideRow
                  channel={item}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  isFav={favKeys.has(String(item.key))}
                  onOpen={openChannel}
                  onToggleFav={handleToggleFav}
                  onFocusProgram={(p) => setFocused({ channel: item, program: p })}
                  onFocusChannel={() => setFocused((f) => ({ channel: item, program: f?.program ?? null }))}
                  hasPreferredFocus={index === 0}
                />
              )}
            />
            {/* Vertical "now" indicator drawn over the entire visible timeline area. */}
            {nowX >= 0 && nowX <= TIMELINE_W ? (
              <View pointerEvents="none" style={[styles.nowLine, { left: LEFT_COL_W + nowX }]}>
                <View style={styles.nowLineHead} />
              </View>
            ) : null}
          </View>
        )}

        {/* Channel-number typing overlay */}
        {jumpBuf.length > 0 && !numpadOpen && (
          <View pointerEvents="none" style={styles.jumpBanner}>
            <Ionicons name="keypad-outline" size={ms(18)} color="#fff" />
            <Text style={styles.jumpBannerLabel}>Ch</Text>
            <Text style={styles.jumpBannerNum}>{jumpBuf}</Text>
          </View>
        )}

        {/* Hold-to-favorite feedback toast */}
        {favToast ? (
          <View pointerEvents="none" style={styles.favToast} testID="fav-toast">
            <View style={[styles.favToastDot, { backgroundColor: favToast.on ? colors.magenta : "rgba(255,255,255,0.15)" }]}>
              <Ionicons name={favToast.on ? "heart" : "heart-dislike-outline"} size={ms(14)} color="#fff" />
            </View>
            <View>
              <Text style={styles.favToastLabel}>{favToast.on ? "ADDED TO FAVORITES" : "REMOVED FROM FAVORITES"}</Text>
              <Text style={styles.favToastTitle} numberOfLines={1}>{favToast.title}</Text>
            </View>
          </View>
        ) : null}

        <NumpadOverlay
          open={numpadOpen}
          buffer={jumpBuf}
          onClose={() => setNumpadOpen(false)}
          onDigit={pressDigit}
          onErase={eraseDigit}
          onGo={() => { setNumpadOpen(false); commitJump(jumpBuf); }}
          onClear={() => setJumpBuf("")}
        />

        <FilterModal
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          country={country} setCountry={setCountry}
          genre={genre} setGenre={setGenre}
          countries={countries} genres={genres}
        />
      </View>
    </BrandBackground>
  );
}

// ---- Hero preview panel (focused program) ------------------------------
function HeroPanel({ channel, program }: { channel: Channel | null; program: Program | null }) {
  if (!channel && !program) {
    return (
      <View style={[styles.hero, { alignItems: "flex-start", justifyContent: "flex-end" }]}>
        <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginBottom: 6 }}>
          Focus a channel to preview what's on
        </Text>
      </View>
    );
  }
  const times =
    program?.start_ts && program?.end_ts
      ? `${formatTime(program.start_ts)} – ${formatTime(program.end_ts)}`
      : "";
  return (
    <View style={styles.hero}>
      {channel?.logo ? (
        <Image
          source={{ uri: channel.logo.startsWith("http") ? channel.logo : `${BACKEND}${channel.logo}` }}
          style={styles.heroLogo}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.heroLogoPlaceholder}>
          <Text style={{ color: colors.zinc500, fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH2 }}>
            {(channel?.title || "?").slice(0, 1)}
          </Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {program?.title || channel?.title || "—"}
        </Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {[channel?.number ? `Ch ${channel.number}` : null, channel?.title, times]
            .filter(Boolean).join("  |  ")}
        </Text>
        {program?.description ? (
          <Text style={styles.heroDesc} numberOfLines={3}>{program.description}</Text>
        ) : (
          <Text style={[styles.heroDesc, { color: colors.zinc500 }]} numberOfLines={2}>
            {channel?.source === "iptv" ? "No guide data available for this channel." : "Plex Live — press Select to tune in."}
          </Text>
        )}
      </View>
    </View>
  );
}

// ---- One channel row in the guide grid --------------------------------
function GuideRow({
  channel, timelineStart, timelineEnd, isFav,
  onOpen, onToggleFav, onFocusProgram, onFocusChannel, hasPreferredFocus,
}: {
  channel: Channel;
  timelineStart: number;
  timelineEnd: number;
  isFav: boolean;
  onOpen: (c: Channel) => void;
  onToggleFav: (c: Channel) => void;
  onFocusProgram: (p: Program | null) => void;
  onFocusChannel: () => void;
  hasPreferredFocus?: boolean;
}) {
  const isIptv = channel.source === "iptv";
  const epgQ = useQuery({
    enabled: isIptv,
    queryKey: ["epg", channel.key],
    queryFn: async () => (await client.get(`/livetv/epg?channel_key=${encodeURIComponent(channel.key)}&limit=8`)).data as { programs: Program[] },
    staleTime: 5 * 60 * 1000,
  });

  // Programs that overlap the visible timeline window
  const visiblePrograms = useMemo(() => {
    const raw = epgQ.data?.programs || [];
    return raw.filter((p) => {
      if (!p.start_ts || !p.end_ts) return false;
      return p.end_ts > timelineStart && p.start_ts < timelineEnd;
    });
  }, [epgQ.data, timelineStart, timelineEnd]);

  return (
    <View style={styles.row}>
      {/* Left column: channel # (top), logo (below); heart badge only when fav */}
      <View style={styles.leftCol}>
        <View style={styles.channelStack}>
          <Text style={styles.channelNum} numberOfLines={1}>
            {channel.number ?? "—"}
          </Text>
          <View style={styles.channelLogoBox}>
            {channel.logo ? (
              <Image
                source={{ uri: channel.logo.startsWith("http") ? channel.logo : `${BACKEND}${channel.logo}` }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.channelInitial} numberOfLines={1}>{channel.title.slice(0, 4)}</Text>
            )}
            {isFav ? (
              <View style={styles.favBadge} pointerEvents="none">
                <Ionicons name="heart" size={ms(10)} color="#fff" />
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Right: program blocks OR a "select to tune" placeholder */}
      <View style={styles.timeline}>
        {isIptv && visiblePrograms.length === 0 ? (
          <NoDataBlock
            channel={channel}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            isLoading={epgQ.isLoading}
            onOpen={onOpen}
            onToggleFav={onToggleFav}
            onFocus={() => { onFocusChannel(); onFocusProgram(null); }}
            hasPreferredFocus={hasPreferredFocus}
          />
        ) : !isIptv ? (
          <NoDataBlock
            channel={channel}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            isLoading={false}
            onOpen={onOpen}
            onToggleFav={onToggleFav}
            onFocus={() => { onFocusChannel(); onFocusProgram(null); }}
            hasPreferredFocus={hasPreferredFocus}
            plexLabel
          />
        ) : (
          visiblePrograms.map((p, i) => (
            <ProgramBlock
              key={`${channel.key}-${p.start_ts}-${i}`}
              program={p}
              channel={channel}
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              onOpen={onOpen}
              onToggleFav={onToggleFav}
              onFocus={() => onFocusProgram(p)}
              hasPreferredFocus={hasPreferredFocus && i === 0}
            />
          ))
        )}
      </View>
    </View>
  );
}

// ---- A single program block on a row ----------------------------------
function ProgramBlock({
  program, channel, timelineStart, timelineEnd, onOpen, onToggleFav, onFocus, hasPreferredFocus,
}: {
  program: Program; channel: Channel;
  timelineStart: number; timelineEnd: number;
  onOpen: (c: Channel) => void; onToggleFav: (c: Channel) => void;
  onFocus: () => void; hasPreferredFocus?: boolean;
}) {
  // Clip the block to the visible window and translate to pixels.
  const startClamped = Math.max(program.start_ts || 0, timelineStart);
  const endClamped = Math.min(program.end_ts || 0, timelineEnd);
  const offsetMin = (startClamped - timelineStart) / 60;
  const durMin = Math.max(1, (endClamped - startClamped) / 60);
  const left = Math.round(offsetMin * PX_PER_MIN);
  const width = Math.max(60, Math.round(durMin * PX_PER_MIN));

  return (
    <Pressable
      testID={`prog-${channel.key}-${program.start_ts}`}
      focusable
      hasTVPreferredFocus={!!hasPreferredFocus}
      onPress={() => onOpen(channel)}
      onLongPress={() => onToggleFav(channel)}
      onFocus={onFocus}
      style={({ focused }) => [
        styles.progBlock,
        { left, width },
        focused && styles.progBlockFocused,
      ]}
    >
      <Text style={styles.progTitle} numberOfLines={1}>{program.title || "No info"}</Text>
    </Pressable>
  );
}

// Placeholder block used when a channel has no EPG (or is Plex Live).
function NoDataBlock({
  channel, timelineStart, timelineEnd, isLoading, onOpen, onToggleFav, onFocus, hasPreferredFocus, plexLabel,
}: {
  channel: Channel;
  timelineStart: number; timelineEnd: number;
  isLoading: boolean;
  onOpen: (c: Channel) => void;
  onToggleFav: (c: Channel) => void;
  onFocus: () => void;
  hasPreferredFocus?: boolean;
  plexLabel?: boolean;
}) {
  const width = Math.round(((timelineEnd - timelineStart) / 60) * PX_PER_MIN);
  return (
    <Pressable
      focusable
      hasTVPreferredFocus={!!hasPreferredFocus}
      onPress={() => onOpen(channel)}
      onLongPress={() => onToggleFav(channel)}
      onFocus={onFocus}
      style={({ focused }) => [
        styles.progBlock, { left: 0, width },
        styles.progBlockEmpty,
        focused && styles.progBlockFocused,
      ]}
    >
      <Text style={[styles.progTitle, { color: colors.zinc500 }]} numberOfLines={1}>
        {isLoading ? "Loading guide…" : plexLabel ? "Plex Live — Select to tune in" : "No guide data"}
      </Text>
    </Pressable>
  );
}

// ---- Filter modal (D-pad friendly) ------------------------------------
function FilterModal({
  open, onClose, country, setCountry, genre, setGenre, countries, genres,
}: {
  open: boolean;
  onClose: () => void;
  country: string; setCountry: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  countries: Array<[string, number]>;
  genres: Array<[string, number]>;
}) {
  const totalCountry = countries.reduce((n, [, c]) => n + c, 0);
  const totalGenre = genres.reduce((n, [, c]) => n + c, 0);
  const countryOpts: Array<[string, number]> = [["All", totalCountry], ...countries];
  const genreOpts: Array<[string, number]> = [["All", totalGenre], ...genres];
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={styles.modalTitle}>Filter Channels</Text>
            <Pressable testID="filter-close" focusable hasTVPreferredFocus onPress={onClose} style={({ focused }) => [styles.modalCloseBtn, focused && { borderColor: colors.cyan }]}>
              <Ionicons name="close" size={ms(16)} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.modalSection}>COUNTRY</Text>
          <View style={styles.modalChips}>
            {countryOpts.slice(0, 24).map(([label, n]) => (
              <FilterChip key={`c-${label}`} active={country === label} label={label} count={n} onPress={() => setCountry(label)} testID={`filter-country-${label}`} />
            ))}
          </View>
          <Text style={[styles.modalSection, { marginTop: 12 }]}>GENRE</Text>
          <View style={styles.modalChips}>
            {genreOpts.slice(0, 24).map(([label, n]) => (
              <FilterChip key={`g-${label}`} active={genre === label} label={label} count={n} onPress={() => setGenre(label)} testID={`filter-genre-${label}`} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
function FilterChip({ label, count, active, onPress, testID }: { label: string; count: number; active: boolean; onPress: () => void; testID?: string; }) {
  return (
    <Pressable
      testID={testID}
      focusable
      onPress={onPress}
      style={({ focused }) => [
        styles.modalChip,
        active && { backgroundColor: "rgba(139,92,246,0.30)", borderColor: "rgba(103,232,249,0.6)" },
        focused && { borderColor: colors.cyan, transform: [{ scale: 1.03 }] },
      ]}
    >
      <Text style={{ color: active ? "#fff" : colors.zinc300, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall }}>
        {label} <Text style={{ color: active ? "rgba(255,255,255,0.7)" : colors.zinc500 }}>({count.toLocaleString()})</Text>
      </Text>
    </Pressable>
  );
}

// ---- Channel-number numpad overlay (unchanged from prior version) ----
function NumpadOverlay({
  open, buffer, onClose, onDigit, onErase, onGo, onClear,
}: {
  open: boolean; buffer: string;
  onClose: () => void; onDigit: (d: number) => void;
  onErase: () => void; onGo: () => void; onClear: () => void;
}) {
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.numpadCard}>
          <Text style={styles.modalTitle}>Jump to Channel</Text>
          <Text style={styles.numpadHint}>Enter a channel number and press Go.</Text>
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
  label: string; testID?: string; onPress: () => void; accent?: boolean; hasTVPreferredFocus?: boolean; key?: React.Key;
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
  // ---- Top nav bar (above hero) ----
  topNav: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: SAFE.left, paddingRight: SAFE.right,
    paddingBottom: vs(6),
  },
  topNavDay: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2, letterSpacing: 0.3 },
  topNavCount: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 1 },
  topNavBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: s(12), paddingVertical: vs(7),
    borderRadius: 999, borderWidth: 2,
    borderColor: "rgba(103,232,249,0.30)",
    backgroundColor: "rgba(139,92,246,0.16)",
  },
  topNavBtnTxt: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },

  // ---- Hero (focused-program preview) ----
  hero: {
    height: HERO_H,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SAFE.left, paddingRight: SAFE.right,
    paddingVertical: vs(10),
    borderBottomWidth: 1, borderBottomColor: "rgba(139,92,246,0.20)",
    backgroundColor: "rgba(11,5,24,0.6)",
  },
  heroLogo: {
    width: IS_TV ? s(130) : s(90),
    height: IS_TV ? vs(88) : vs(64),
    borderRadius: 12,
    backgroundColor: "rgba(28,10,56,0.6)",
    padding: 8,
  },
  heroLogoPlaceholder: {
    width: IS_TV ? s(130) : s(90),
    height: IS_TV ? vs(88) : vs(64),
    borderRadius: 12,
    backgroundColor: "rgba(28,10,56,0.6)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(139,92,246,0.30)",
  },
  heroTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH1, lineHeight: SIZES.fontH1 * 1.15 },
  heroMeta: { color: colors.zinc400, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall, marginTop: 4 },
  heroDesc: { color: colors.zinc300, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 6, lineHeight: SIZES.fontSmall * 1.35 },

  // ---- Time header ----
  timeHeader: {
    height: HEADER_H,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139,92,246,0.15)",
    backgroundColor: "rgba(11,5,24,0.35)",
  },
  timeHeaderDay: { color: colors.zinc400, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontTiny, textTransform: "uppercase", letterSpacing: 1 },
  timeHeaderSlot: { color: colors.zinc300, fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },

  // ---- Row ----
  row: {
    height: ROW_H,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139,92,246,0.10)",
  },
  leftCol: {
    width: LEFT_COL_W,
    paddingLeft: SAFE.left,
    flexDirection: "row", alignItems: "center",
    borderRightWidth: 1, borderRightColor: "rgba(139,92,246,0.15)",
    paddingRight: 8,
  },
  channelStack: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  channelNum: {
    color: colors.zinc300,
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(11),
    letterSpacing: 0.4,
    width: ms(34),
    textAlign: "right",
  },
  channelLogoBox: {
    flex: 1, height: ROW_H - vs(14), borderRadius: 6,
    backgroundColor: "rgba(28,10,56,0.55)",
    alignItems: "center", justifyContent: "center",
    padding: 4,
    position: "relative",
    overflow: "hidden",
  },
  favBadge: {
    position: "absolute",
    top: 2, right: 2,
    width: ms(16), height: ms(16),
    borderRadius: 999,
    backgroundColor: colors.magenta,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.magenta, shadowOpacity: 0.6, shadowRadius: 3,
    elevation: 3,
  },
  channelInitial: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontTiny, textAlign: "center" },
  timeline: {
    flex: 1,
    height: ROW_H,
    position: "relative",
  },
  progBlock: {
    position: "absolute", top: 4, bottom: 4,
    borderRadius: 6, borderWidth: 2, borderColor: "transparent",
    backgroundColor: "rgba(28,10,56,0.65)",
    paddingHorizontal: 10, justifyContent: "center",
    marginRight: 2,
  },
  progBlockEmpty: { backgroundColor: "rgba(28,10,56,0.35)" },
  progBlockFocused: {
    backgroundColor: "#2563EB",
    borderColor: "#67E8F9",
    shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  progTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontSmall },

  // ---- Vertical "now" indicator line ----
  nowLine: {
    position: "absolute", top: 0, bottom: 0, width: 2,
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan, shadowOpacity: 0.9, shadowRadius: 6, elevation: 8,
  },
  nowLineHead: {
    position: "absolute", top: -2, left: -5,
    width: 12, height: 8, borderRadius: 3,
    backgroundColor: colors.cyan,
  },

  // ---- Jump banner + numpad ----
  jumpBanner: {
    position: "absolute", top: SAFE.top + vs(60), alignSelf: "center",
    backgroundColor: "rgba(6,7,20,0.94)", borderColor: colors.cyan, borderWidth: 2,
    borderRadius: 999, paddingHorizontal: s(20), paddingVertical: vs(8),
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  jumpBannerLabel: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, letterSpacing: 1.5, textTransform: "uppercase" },
  jumpBannerNum: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(28), letterSpacing: 2 },

  // ---- Hold-to-favorite feedback toast ----
  favToast: {
    position: "absolute",
    bottom: SIZES.tabBarH + vs(24),
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(6,7,20,0.96)",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.magenta,
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    shadowColor: colors.magenta,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: "80%",
  },
  favToastDot: {
    width: ms(26), height: ms(26), borderRadius: 999,
    alignItems: "center", justifyContent: "center",
  },
  favToastLabel: {
    color: colors.zinc400,
    fontFamily: "Outfit_500Medium",
    fontSize: ms(9),
    letterSpacing: 1.5,
  },
  favToastTitle: {
    color: "#fff",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(13),
    marginTop: 1,
  },

  // ---- Filter modal ----
  modalBackdrop: { flex: 1, backgroundColor: "rgba(6,7,20,0.85)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: {
    width: IS_TV ? s(760) : s(340),
    maxHeight: "88%",
    backgroundColor: "#0B0518", borderRadius: 20, padding: s(20),
    borderWidth: 1, borderColor: "rgba(139,92,246,0.30)",
  },
  modalTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH1 },
  modalCloseBtn: {
    width: ms(30), height: ms(30), borderRadius: 999,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  modalSection: { color: colors.zinc400, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, marginBottom: 6 },
  modalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalChip: {
    paddingHorizontal: s(12), paddingVertical: vs(6),
    borderRadius: 999, borderWidth: 2,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  numpadCard: {
    width: IS_TV ? s(430) : s(310),
    backgroundColor: "#0B0518", borderRadius: 20, padding: s(20),
    borderWidth: 1, borderColor: "rgba(139,92,246,0.30)",
  },
  numpadHint: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 4 },
  numpadDisplay: {
    marginTop: vs(12), backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, paddingVertical: vs(14), alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  numpadDisplayNum: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(36), letterSpacing: 4 },
  numpadGrid: { marginTop: vs(14), flexDirection: "row", flexWrap: "wrap", gap: s(8) },
  numKey: {
    width: "31%", aspectRatio: 1.6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.08)",
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
