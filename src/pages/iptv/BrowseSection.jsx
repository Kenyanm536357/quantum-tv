import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '@/lib/use-store';
import { setState } from '@/lib/iptv-store';
import { parseM3U } from '@/lib/m3u-parser';
import { cleanName } from '@/lib/clean-name';
import { toggleBookmark, isBookmarked, addToHistory } from '@/lib/user-data';
import {
  Search, X, Play, Bookmark, BookmarkCheck, Loader2, Tv2, Film,
  Music, Globe, Zap, ChevronLeft, ChevronRight, Grid2X2, List, Radio
} from 'lucide-react';

// ── Hardcoded source: YOUR quantum-tv repo M3U ────────────────────────────────
const QUANTUM_M3U_URL = 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u';

// ── Category icons ────────────────────────────────────────────────────────────
const CAT_ICONS = { news: Globe, sports: Zap, movies: Film, music: Music, kids: Tv2, documentary: Film, entertainment: Tv2, religious: Globe };
function getCatIcon(name = '') {
  const l = name.toLowerCase();
  for (const [k, I] of Object.entries(CAT_ICONS)) if (l.includes(k)) return I;
  return Radio;
}

// ── Gradient fallbacks ────────────────────────────────────────────────────────
const GRADIENTS = [
  ['#1a0533','#6d28d9'], ['#0c1a2e','#0ea5e9'], ['#1a0a00','#ea580c'],
  ['#0a1a0a','#16a34a'], ['#1a001a','#db2777'], ['#1a1000','#ca8a04'],
];
function gradientFor(name = '') {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// ── Channel logo / fallback ───────────────────────────────────────────────────
function ChannelLogo({ src, name, size = 'md' }) {
  const [ok, setOk] = useState(!!src);
  const [g1, g2] = gradientFor(name);
  const Icon = getCatIcon(name);
  const sz = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const iSz = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';

  if (ok && src) return (
    <img src={src} alt={name} className={`${sz} object-contain rounded`}
      onError={() => setOk(false)} />
  );
  return (
    <div className={`${sz} rounded flex items-center justify-center flex-shrink-0`}
      style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
      <Icon className={`${iSz} text-white/40`} />
    </div>
  );
}

// ── Channel card (used in horizontal shelves) ─────────────────────────────────
function ChannelCard({ stream, credentials, onPlay }) {
  const [bm, setBm] = useState(() => credentials ? isBookmarked(credentials, stream) : false);
  const name = cleanName(stream.name);
  const [g1, g2] = gradientFor(name);
  const Icon = getCatIcon(stream.category_name || name);
  const [imgOk, setImgOk] = useState(!!stream.stream_icon);

  return (
    <div
      onClick={() => onPlay(stream)}
      className="group relative flex-shrink-0 w-48 rounded-xl overflow-hidden cursor-pointer border border-white/6 hover:border-white/20 transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl"
      style={{ background: '#0d1220' }}
    >
      {/* Thumb */}
      <div className="relative aspect-video w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${g1}cc, ${g2}cc)` }}>
        {imgOk && stream.stream_icon ? (
          <img src={stream.stream_icon} alt={name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={() => setImgOk(false)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-12 h-12 text-white/15" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </div>
        </div>
        {/* LIVE dot */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-bold text-white tracking-wider">LIVE</span>
        </div>
        {/* Bookmark */}
        <button
          onClick={e => { e.stopPropagation(); if (credentials) { toggleBookmark(credentials, stream, 'live'); setBm(b => !b); } }}
          className="absolute top-2 right-2 w-6 h-6 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          {bm ? <BookmarkCheck className="w-3 h-3 text-cyan-400" /> : <Bookmark className="w-3 h-3 text-white" />}
        </button>
      </div>
      {/* Name */}
      <div className="flex items-center gap-2 px-2.5 py-2.5">
        <ChannelLogo src={stream.stream_icon} name={name} size="sm" />
        <p className="text-[11px] font-semibold text-white/75 truncate leading-tight">{name}</p>
      </div>
    </div>
  );
}

// ── Channel row (list view) ───────────────────────────────────────────────────
function ChannelRow({ stream, credentials, onPlay, index }) {
  const [bm, setBm] = useState(() => credentials ? isBookmarked(credentials, stream) : false);
  const name = cleanName(stream.name);

  return (
    <div onClick={() => onPlay(stream)}
      className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/4 transition-colors cursor-pointer border border-transparent hover:border-white/6">
      <span className="text-sm text-white/20 w-5 text-right flex-shrink-0 tabular-nums">{index + 1}</span>
      <ChannelLogo src={stream.stream_icon} name={name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/85 truncate">{name}</p>
        {stream.category_name && <p className="text-xs text-white/30 truncate mt-0.5">{cleanName(stream.category_name)}</p>}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); if (credentials) { toggleBookmark(credentials, stream, 'live'); setBm(b => !b); } }}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-cyan-400 hover:bg-white/5 transition-colors">
          {bm ? <BookmarkCheck className="w-4 h-4 text-cyan-400" /> : <Bookmark className="w-4 h-4" />}
        </button>
        <button className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors">
          <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
        </button>
      </div>
    </div>
  );
}

// ── Horizontal scrollable shelf ───────────────────────────────────────────────
function Shelf({ title, icon: Icon, streams, credentials, onPlay, onViewAll }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  if (!streams?.length) return null;

  return (
    <section className="mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
          <h2 className="text-[15px] font-bold text-white">{title}</h2>
          <span className="text-xs text-white/25 ml-1">{streams.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onViewAll} className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors mr-2">
            See all →
          </button>
          <button onClick={() => scroll(-1)} className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scroll row */}
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {streams.slice(0, 30).map(s => (
          <ChannelCard key={s.stream_id} stream={s} credentials={credentials} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}

// ── Hero banner (featured channel) ───────────────────────────────────────────
function HeroBanner({ stream, onPlay }) {
  if (!stream) return null;
  const name = cleanName(stream.name);
  const [g1, g2] = gradientFor(name);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-8 flex-shrink-0"
      style={{ minHeight: 220, background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
      {stream.stream_icon && (
        <img src={stream.stream_icon} alt={name}
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          onError={e => e.target.style.display = 'none'} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="relative flex flex-col justify-end h-full p-6 sm:p-8" style={{ minHeight: 220 }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600/80 text-[10px] font-bold text-white tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live Now
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-3 drop-shadow-lg max-w-lg">{name}</h1>
        <button onClick={() => onPlay(stream)}
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all w-fit shadow-xl">
          <Play className="w-4 h-4 fill-black" /> Watch Now
        </button>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen({ channelCount, categoryCount, phase }) {
  const [displayCount, setDisplayCount] = useState(0);
  const [displayCats, setDisplayCats] = useState(0);

  // Animate the numbers counting up
  useEffect(() => {
    if (channelCount === 0) return;
    const target = channelCount;
    const start = displayCount;
    const steps = 40;
    const increment = Math.max(1, Math.ceil((target - start) / steps));
    let current = start;
    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      setDisplayCount(current);
      if (current >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [channelCount]);

  useEffect(() => {
    if (categoryCount === 0) return;
    const target = categoryCount;
    let current = displayCats;
    const timer = setInterval(() => {
      current = Math.min(current + 1, target);
      setDisplayCats(current);
      if (current >= target) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [categoryCount]);

  const phases = [
    { label: 'Connecting to server…', icon: '📡' },
    { label: 'Parsing playlist…',     icon: '📋' },
    { label: 'Loading channels…',     icon: '📺' },
  ];
  const p = phases[Math.min(phase, phases.length - 1)];

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 px-6">
      {/* Logo pulse */}
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shadow-xl">
          <Tv2 className="w-10 h-10 text-cyan-400" />
        </div>
        <div className="absolute -inset-2 rounded-2xl border border-cyan-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        <div className="absolute -inset-4 rounded-3xl border border-cyan-500/8 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl font-black text-white tracking-tight mb-1">
          Quantum<span className="text-cyan-400">TV</span>
        </h1>
        <p className="text-white/40 text-sm">{p.icon} {p.label}</p>
      </div>

      {/* Channel / category counters */}
      <div className="flex gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-black text-cyan-400 tabular-nums leading-none" style={{ textShadow: '0 0 30px rgba(34,211,238,0.4)' }}>
            {displayCats > 0 ? displayCats : <Loader2 className="w-8 h-8 animate-spin" />}
          </span>
          <span className="text-[11px] text-white/35 font-medium uppercase tracking-widest">Categories</span>
        </div>
        <div className="w-px bg-white/8 self-stretch" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-black text-white tabular-nums leading-none">
            {displayCount > 0 ? displayCount.toLocaleString() : <Loader2 className="w-8 h-8 animate-spin text-white/30" />}
          </span>
          <span className="text-[11px] text-white/35 font-medium uppercase tracking-widest">Channels</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="h-1 bg-white/6 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-300"
            style={{ width: phase === 0 ? '15%' : phase === 1 ? '55%' : channelCount > 0 ? '90%' : '70%' }}
          />
        </div>
        <p className="text-center text-[10px] text-white/20 mt-2">Please wait…</p>
      </div>
    </div>
  );
}

// ── Category detail view ──────────────────────────────────────────────────────
function CategoryView({ category, streams, credentials, onPlay, onBack, viewMode, onViewModeChange }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? streams.filter(s => cleanName(s.name).toLowerCase().includes(search.toLowerCase()))
    : streams;
  const Icon = getCatIcon(category.category_name);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 flex-shrink-0 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <Icon className="w-4 h-4 text-cyan-400" />
        <h2 className="text-base font-bold text-white">{cleanName(category.category_name)}</h2>
        <span className="text-xs text-white/30">{streams.length} channels</span>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-all" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {/* View toggle */}
        <div className="flex items-center bg-white/5 border border-white/8 rounded-xl p-0.5">
          <button onClick={() => onViewModeChange('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/35 hover:text-white'}`}><Grid2X2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onViewModeChange('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/35 hover:text-white'}`}><List className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Grid or list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(s => <ChannelCard key={s.stream_id} stream={s} credentials={credentials} onPlay={onPlay} />)}
          </div>
        ) : (
          <div>
            {filtered.map((s, i) => <ChannelRow key={s.stream_id} stream={s} credentials={credentials} onPlay={onPlay} index={i} />)}
          </div>
        )}
        {filtered.length === 0 && <p className="text-center text-white/25 py-16 text-sm">No channels found.</p>}
      </div>
    </div>
  );
}

// ── Main BrowseSection ────────────────────────────────────────────────────────
const CACHE_KEY = 'qtv_browse_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export default function BrowseSection() {
  const { credentials } = useStore();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [loadPhase, setLoadPhase] = useState(0);
  const [loadChannelCount, setLoadChannelCount] = useState(0);
  const [loadCatCount, setLoadCatCount] = useState(0);

  // Load from cache or fetch
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setLoadChannelCount(data.streams.length);
          setLoadCatCount(data.categories.length);
          setPlaylist(data);
          setLoading(false);
          return;
        }
      } catch (_) {}
    }
    fetchPlaylist();
  }, []);

  const fetchPlaylist = async () => {
    setLoading(true);
    setError(null);
    setLoadPhase(0);
    setLoadChannelCount(0);
    setLoadCatCount(0);
    try {
      setLoadPhase(0); // connecting
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(QUANTUM_M3U_URL)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(30000) });
      const json = await res.json();
      if (!json.contents?.includes('#EXTINF')) throw new Error('Invalid playlist data');
      setLoadPhase(1); // parsing
      await new Promise(r => setTimeout(r, 200)); // let UI update
      const parsed = parseM3U(json.contents);
      setLoadCatCount(parsed.categories.length);
      setLoadPhase(2); // loading channels
      await new Promise(r => setTimeout(r, 150));
      setLoadChannelCount(parsed.streams.length);
      await new Promise(r => setTimeout(r, 600)); // show final count briefly
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: parsed, ts: Date.now() }));
      setPlaylist(parsed);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const playStream = useCallback((stream) => {
    const src = stream.direct_url || stream.url;
    setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
    if (credentials) addToHistory(credentials, stream, 'live');
  }, [credentials]);

  const catStreamMap = useMemo(() => {
    if (!playlist) return {};
    const map = {};
    for (const s of playlist.streams) {
      if (!map[s.category_id]) map[s.category_id] = [];
      map[s.category_id].push(s);
    }
    return map;
  }, [playlist]);

  // Global search results
  const searchResults = useMemo(() => {
    if (!globalSearch || !playlist) return [];
    const q = globalSearch.toLowerCase();
    return playlist.streams.filter(s => cleanName(s.name).toLowerCase().includes(q)).slice(0, 100);
  }, [globalSearch, playlist]);

  if (loading) return <LoadingScreen channelCount={loadChannelCount} categoryCount={loadCatCount} phase={loadPhase} />;

  if (error) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
      <Tv2 className="w-12 h-12 text-white/15" />
      <p className="text-white/50 text-sm text-center">{error}</p>
      <button onClick={fetchPlaylist} className="px-5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 transition-colors">
        Try Again
      </button>
    </div>
  );

  // ── Category drill-down ──
  if (selectedCat) {
    return (
      <div className="h-full overflow-hidden p-4 sm:p-6">
        <CategoryView
          category={selectedCat}
          streams={catStreamMap[selectedCat.category_id] || []}
          credentials={credentials}
          onPlay={playStream}
          onBack={() => setSelectedCat(null)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
    );
  }

  // ── Home view ──
  const hero = playlist.streams.find(s => s.stream_icon) || playlist.streams[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top search bar ── */}
      <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 pb-3 flex-shrink-0">
        <h1 className="text-base font-black text-white tracking-tight hidden sm:block">
          Quantum<span className="text-cyan-400">TV</span>
        </h1>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search all channels…"
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/10 transition-all"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-white/25 flex-shrink-0 hidden md:block">
          {playlist.streams.length.toLocaleString()} channels
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pb-6">

        {/* Global search results */}
        {globalSearch ? (
          <div className="pt-2">
            <p className="text-xs text-white/35 mb-4">{searchResults.length} results for "<span className="text-white/60">{globalSearch}</span>"</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {searchResults.map(s => <ChannelCard key={s.stream_id} stream={s} credentials={credentials} onPlay={playStream} />)}
            </div>
            {searchResults.length === 0 && <p className="text-center text-white/25 py-16 text-sm">No channels found.</p>}
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="pt-2">
              <HeroBanner stream={hero} onPlay={playStream} />
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-4 flex-shrink-0 mb-6" style={{ scrollbarWidth: 'none' }}>
              {playlist.categories.map(cat => {
                const Icon = getCatIcon(cat.category_name);
                const count = catStreamMap[cat.category_id]?.length ?? 0;
                if (!count) return null;
                return (
                  <button key={cat.category_id} onClick={() => setSelectedCat(cat)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/5 border border-white/8 text-white/55 hover:text-white hover:border-white/20 hover:bg-white/8 transition-all whitespace-nowrap">
                    <Icon className="w-3 h-3" />
                    {cleanName(cat.category_name)}
                    <span className="text-[9px] text-white/25 ml-0.5">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Category shelves — only show top 6 to avoid clutter */}
            {playlist.categories.slice(0, 6).map(cat => (
              <Shelf
                key={cat.category_id}
                title={cleanName(cat.category_name)}
                icon={getCatIcon(cat.category_name)}
                streams={catStreamMap[cat.category_id] || []}
                credentials={credentials}
                onPlay={playStream}
                onViewAll={() => setSelectedCat(cat)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}