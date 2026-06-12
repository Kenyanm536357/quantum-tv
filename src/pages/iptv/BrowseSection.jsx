import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '@/lib/use-store';
import { setState } from '@/lib/iptv-store';
import { parseM3U } from '@/lib/m3u-parser';
import { cleanName } from '@/lib/clean-name';
import { toggleBookmark, isBookmarked, addToHistory } from '@/lib/user-data';
import {
  Search, X, Play, Bookmark, BookmarkCheck, Loader2, Tv2, Film,
  Music, Globe, Zap, ChevronRight, RefreshCw, AlertCircle, Grid2X2, List
} from 'lucide-react';

// ─── Category icon mapping ────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  news: Globe, sports: Zap, movies: Film, music: Music, kids: Tv2,
  documentary: Film, religious: Globe, entertainment: Tv2,
};

function getCatIcon(name = '') {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Tv2;
}

// ─── Placeholder channel art ──────────────────────────────────────────────────
const THUMB_COLORS = [
  'from-purple-900 to-indigo-900',
  'from-cyan-900 to-blue-900',
  'from-rose-900 to-pink-900',
  'from-amber-900 to-orange-900',
  'from-emerald-900 to-teal-900',
  'from-violet-900 to-purple-900',
];

function colorFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return THUMB_COLORS[h % THUMB_COLORS.length];
}

// ─── Stream Card (grid) ───────────────────────────────────────────────────────
function StreamCard({ stream, credentials, onPlay }) {
  const [imgOk, setImgOk] = useState(!!stream.stream_icon);
  const [bm, setBm] = useState(() => credentials ? isBookmarked(credentials, stream) : false);
  const color = colorFor(stream.name);
  const name = cleanName(stream.name);
  const CatIcon = getCatIcon(stream.category_name || '');

  const handlePlay = () => {
    onPlay(stream);
    if (credentials) addToHistory(credentials, stream, 'live');
  };

  return (
    <div className="group relative rounded-xl overflow-hidden bg-[#0d1220] border border-white/6 hover:border-primary/40 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer"
      onClick={handlePlay}>
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden">
        {imgOk && stream.stream_icon ? (
          <img
            src={stream.stream_icon}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${color} flex items-center justify-center`}>
            <CatIcon className="w-10 h-10 text-white/20" />
          </div>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </div>
        </div>
        {/* LIVE badge */}
        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-[9px] font-bold text-white uppercase tracking-wider">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> Live
        </span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {stream.stream_icon && imgOk ? (
          <img src={stream.stream_icon} alt="" className="w-6 h-6 rounded object-contain bg-white/5 flex-shrink-0"
            onError={e => e.target.style.display = 'none'} />
        ) : (
          <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
            <Tv2 className="w-3 h-3 text-white/30" />
          </div>
        )}
        <p className="text-[11px] font-semibold text-white/80 truncate flex-1">{name}</p>
        <button
          onClick={e => { e.stopPropagation(); if (credentials) { toggleBookmark(credentials, stream, 'live'); setBm(b => !b); } }}
          className="text-white/30 hover:text-primary transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
          {bm ? <BookmarkCheck className="w-3.5 h-3.5 text-primary" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Stream Row (list) ────────────────────────────────────────────────────────
function StreamRow({ stream, credentials, onPlay }) {
  const [imgOk, setImgOk] = useState(!!stream.stream_icon);
  const [bm, setBm] = useState(() => credentials ? isBookmarked(credentials, stream) : false);
  const name = cleanName(stream.name);

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/8"
      onClick={() => onPlay(stream)}>
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {imgOk && stream.stream_icon ? (
          <img src={stream.stream_icon} alt="" className="w-full h-full object-contain" onError={() => setImgOk(false)} />
        ) : (
          <Tv2 className="w-4 h-4 text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/85 truncate">{name}</p>
        {stream.category_name && (
          <p className="text-[11px] text-white/35 truncate">{cleanName(stream.category_name)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); if (credentials) { toggleBookmark(credentials, stream, 'live'); setBm(b => !b); } }}
          className="text-white/30 hover:text-primary transition-colors">
          {bm ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
        </button>
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Play className="w-3.5 h-3.5 text-primary fill-primary" />
        </div>
      </div>
    </div>
  );
}

// ─── Category Shelf (horizontal scroll row) ───────────────────────────────────
function CategoryShelf({ category, streams, credentials, onPlay }) {
  const CatIcon = getCatIcon(category.category_name);
  if (!streams.length) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <CatIcon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-white">{cleanName(category.category_name)}</h3>
        <span className="text-[11px] text-white/30 ml-1">{streams.length}</span>
        <ChevronRight className="w-3.5 h-3.5 text-white/30 ml-auto" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {streams.slice(0, 20).map(s => (
          <div key={s.stream_id} className="flex-shrink-0 w-44">
            <StreamCard stream={{ ...s, category_name: category.category_name }} credentials={credentials} onPlay={onPlay} />
          </div>
        ))}
      </div>
    </div>
  );
}

// The one source of truth — your quantum-tv repo's M3U index
const QUANTUM_M3U = 'https://raw.githubusercontent.com/quantumtviptv/quantum-tv/main/index.m3u';

// ─── Main BrowseSection ───────────────────────────────────────────────────────
export default function BrowseSection() {
  const { credentials } = useStore();

  const [playlist, setPlaylist] = useState(() => {
    const raw = localStorage.getItem('browse_m3u');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const loadM3U = useCallback(async (url) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setSearch('');
    setSelectedCat(null);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(30000) });
      const json = await res.json();
      const text = json.contents;
      if (!text || !text.includes('#EXTINF')) throw new Error('Invalid M3U response');
      const parsed = parseM3U(text);
      localStorage.setItem('browse_m3u', JSON.stringify(parsed));
      setPlaylist(parsed);
    } catch (e) {
      setError(e.message || 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on first visit
  useEffect(() => {
    if (!playlist && !loading) loadM3U(QUANTUM_M3U);
  }, []);

  const playStream = useCallback((stream) => {
    const src = stream.direct_url || stream.url;
    setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
  }, []);

  // Filter logic
  const filteredStreams = useMemo(() => {
    if (!playlist) return [];
    let streams = playlist.streams;
    if (selectedCat) streams = streams.filter(s => s.category_id === selectedCat.category_id);
    if (search) {
      const q = search.toLowerCase();
      streams = streams.filter(s => cleanName(s.name).toLowerCase().includes(q));
    }
    return streams;
  }, [playlist, selectedCat, search]);

  const categoryStreamMap = useMemo(() => {
    if (!playlist) return {};
    const map = {};
    for (const s of playlist.streams) {
      if (!map[s.category_id]) map[s.category_id] = [];
      map[s.category_id].push(s);
    }
    return map;
  }, [playlist]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-white/40">Loading channels…</p>
      </div>
    );
  }

  // ── Error ──
  if (error && !playlist) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-white/50">{error}</p>
        <button onClick={() => loadM3U(QUANTUM_M3U)}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/25 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // ── Browse view ──
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Topbar ── */}
      <div className="flex items-center gap-3 flex-wrap pb-4 flex-shrink-0">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Tv2 className="w-4 h-4 text-primary" />
          Browse
          {playlist && <span className="text-xs text-white/30 font-normal">{playlist.streams.length.toLocaleString()} channels</span>}
        </h2>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels…"
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white/5 border border-white/8 rounded-xl p-0.5 flex-shrink-0">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white'}`}>
            <Grid2X2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-white/40 hover:text-white'}`}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>


      </div>

      {/* ── Category pills ── */}
      {!search && (
        <div className="flex gap-2 overflow-x-auto pb-3 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setSelectedCat(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              !selectedCat ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white/50 border-white/8 hover:text-white'
            }`}>
            All
          </button>
          {playlist?.categories.map(cat => {
            const CatIcon = getCatIcon(cat.category_name);
            const isActive = selectedCat?.category_id === cat.category_id;
            return (
              <button key={cat.category_id} onClick={() => setSelectedCat(isActive ? null : cat)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  isActive ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white/50 border-white/8 hover:text-white'
                }`}>
                <CatIcon className="w-3 h-3" />
                {cleanName(cat.category_name)}
                <span className={`text-[9px] ${isActive ? 'text-black/60' : 'text-white/25'}`}>
                  {categoryStreamMap[cat.category_id]?.length ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Search results */}
        {search && (
          <div>
            <p className="text-xs text-white/35 mb-3">{filteredStreams.length} results for "{search}"</p>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredStreams.map(s => (
                  <StreamCard key={s.stream_id} stream={s} credentials={credentials} onPlay={playStream} />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStreams.map(s => (
                  <StreamRow key={s.stream_id} stream={s} credentials={credentials} onPlay={playStream} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category filtered */}
        {!search && selectedCat && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              {React.createElement(getCatIcon(selectedCat.category_name), { className: 'w-4 h-4 text-primary' })}
              <h3 className="text-sm font-bold text-white">{cleanName(selectedCat.category_name)}</h3>
              <span className="text-xs text-white/30">{filteredStreams.length} channels</span>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredStreams.map(s => (
                  <StreamCard key={s.stream_id} stream={s} credentials={credentials} onPlay={playStream} />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStreams.map(s => (
                  <StreamRow key={s.stream_id} stream={s} credentials={credentials} onPlay={playStream} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Default — category shelves (Netflix style) */}
        {!search && !selectedCat && (
          <div>
            {playlist?.categories.map(cat => (
              <CategoryShelf
                key={cat.category_id}
                category={cat}
                streams={categoryStreamMap[cat.category_id] || []}
                credentials={credentials}
                onPlay={playStream}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}