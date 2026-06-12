import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { setState } from '@/lib/iptv-store';
import { useM3UPlaylist } from '@/lib/use-m3u-playlist.js';
import { cleanName } from '@/lib/clean-name';
import {
  Search, X, Play, Loader2, Tv2, Film,
  Music, Globe, Zap, ChevronLeft, ChevronRight, Radio,
  Flame, Star, Clock, Grid3X3, List, TrendingUp, Clapperboard
} from 'lucide-react';

// ── Category icons ─────────────────────────────────────────────────────────────
const CAT_ICONS = {
  news: Globe, sports: Zap, movie: Film, film: Film, cinema: Film,
  music: Music, kids: Tv2, documentary: Film, entertainment: Tv2,
  religious: Globe, series: Clapperboard, show: Clapperboard,
  animation: Clapperboard, cartoon: Clapperboard,
};
function getCatIcon(name = '') {
  const l = name.toLowerCase();
  for (const [k, I] of Object.entries(CAT_ICONS)) if (l.includes(k)) return I;
  return Radio;
}

// ── Gradient palette ──────────────────────────────────────────────────────────
const GRADIENTS = [
  ['#0f0c29','#302b63'],['#1a0533','#6d28d9'],['#0c1a2e','#0ea5e9'],
  ['#1a0a00','#ea580c'],['#0a1a0a','#16a34a'],['#1a001a','#db2777'],
  ['#1a1000','#ca8a04'],['#001a1a','#0891b2'],['#1a000a','#be123c'],
];
function gradientFor(name = '') {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// ── Channel thumbnail ──────────────────────────────────────────────────────────
function Thumb({ src, name, aspect = 'video', size = 'md' }) {
  const [ok, setOk] = useState(!!src);
  const [g1, g2] = gradientFor(name);
  const Icon = getCatIcon(name);
  const isPortrait = aspect === 'portrait';
  const cls = isPortrait ? 'aspect-[2/3]' : 'aspect-video';

  return (
    <div className={`w-full ${cls} relative overflow-hidden`}
      style={{ background: `linear-gradient(135deg, ${g1}dd, ${g2}dd)` }}>
      {ok && src
        ? <img src={src} alt={name} className="w-full h-full object-cover"
            onError={() => setOk(false)} />
        : <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-8 h-8 text-white/15" />
          </div>
      }
    </div>
  );
}

// ── Stream card (horizontal shelf) ───────────────────────────────────────────
function StreamCard({ stream, onPlay, aspect = 'video' }) {
  const name = cleanName(stream.name);
  return (
    <div onClick={() => onPlay(stream)}
      className="group flex-shrink-0 cursor-pointer rounded-xl overflow-hidden border border-white/6 hover:border-white/25 transition-all duration-200 hover:scale-[1.04] hover:shadow-2xl"
      style={{ width: aspect === 'portrait' ? 130 : 190, background: '#0d1220' }}>
      <div className="relative overflow-hidden">
        <Thumb src={stream.stream_icon} name={name} aspect={aspect} />
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="w-4 h-4 text-black fill-black ml-0.5" />
          </div>
        </div>
        {/* LIVE dot */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] font-bold text-white tracking-wider">LIVE</span>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[10px] font-semibold text-white/75 truncate leading-tight">{name}</p>
      </div>
    </div>
  );
}

// ── Horizontal shelf ──────────────────────────────────────────────────────────
function Shelf({ title, icon: Icon, color = 'text-cyan-400', streams, onPlay, onViewAll, aspect = 'video' }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 210, behavior: 'smooth' });
  if (!streams?.length) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${color}`} />}
          <h2 className="text-sm font-black text-white tracking-tight">{title}</h2>
          <span className="text-[10px] text-white/20 ml-1 font-normal">{streams.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onViewAll && (
            <button onClick={onViewAll}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors mr-2">
              See all →
            </button>
          )}
          <button onClick={() => scroll(-1)}
            className="w-6 h-6 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => scroll(1)}
            className="w-6 h-6 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {streams.slice(0, 40).map(s => (
          <StreamCard key={s.stream_id || s.url} stream={s} onPlay={onPlay} aspect={aspect} />
        ))}
      </div>
    </section>
  );
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function HeroBanner({ stream, onPlay }) {
  if (!stream) return null;
  const name = cleanName(stream.name);
  const [g1, g2] = gradientFor(name);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden mb-8 flex-shrink-0"
      style={{ minHeight: 240, background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
      {stream.stream_icon && (
        <img src={stream.stream_icon} alt={name}
          className="absolute inset-0 w-full h-full object-cover opacity-25"
          onError={e => e.target.style.display = 'none'} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="relative flex flex-col justify-end h-full p-6 sm:p-10" style={{ minHeight: 240 }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 text-[10px] font-bold text-white tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live Now
          </span>
          <span className="text-[10px] text-white/40 font-medium">Featured Channel</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white mb-4 drop-shadow-lg max-w-xl leading-tight">{name}</h1>
        <button onClick={() => onPlay(stream)}
          className="inline-flex items-center gap-2.5 px-7 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all w-fit shadow-xl">
          <Play className="w-4 h-4 fill-black" /> Watch Now
        </button>
      </div>
    </div>
  );
}

// ── Category pill row ─────────────────────────────────────────────────────────
function CategoryPills({ categories, catStreamMap, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-3 mb-6 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
      {categories.map(cat => {
        const Icon = getCatIcon(cat.category_name);
        const count = catStreamMap[cat.category_id]?.length ?? 0;
        if (!count) return null;
        return (
          <button key={cat.category_id} onClick={() => onSelect(cat)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/5 border border-white/8 text-white/55 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/8 transition-all whitespace-nowrap">
            <Icon className="w-3 h-3" />
            {cleanName(cat.category_name)}
            <span className="text-[9px] text-white/25 ml-0.5">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Category grid view ────────────────────────────────────────────────────────
function CategoryGridView({ categories, catStreamMap, onSelect, onBack, title }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? categories.filter(c => cleanName(c.category_name).toLowerCase().includes(search.toLowerCase()))
    : categories;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 mb-6 flex-wrap flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Home
        </button>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-all w-44" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.filter(c => (catStreamMap[c.category_id]?.length ?? 0) > 0).map(cat => {
            const Icon = getCatIcon(cat.category_name);
            const [g1, g2] = gradientFor(cat.category_name);
            const count = catStreamMap[cat.category_id]?.length ?? 0;
            return (
              <button key={cat.category_id} onClick={() => onSelect(cat)}
                className="group relative rounded-2xl overflow-hidden border border-white/8 hover:border-white/25 transition-all hover:scale-[1.02] text-left"
                style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="relative p-5 flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white truncate">{cleanName(cat.category_name)}</p>
                    <p className="text-[11px] text-white/50">{count} channels</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Channel list for a selected category ──────────────────────────────────────
function ChannelListView({ category, streams, onPlay, onBack }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const filtered = search
    ? streams.filter(s => cleanName(s.name).toLowerCase().includes(search.toLowerCase()))
    : streams;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 mb-5 flex-wrap flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2 className="text-lg font-black text-white">{cleanName(category.category_name)}</h2>
          <p className="text-xs text-white/30">{streams.length} channels</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-all w-40" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex items-center bg-white/5 border border-white/8 rounded-xl p-0.5">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/35 hover:text-white'}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/35 hover:text-white'}`}><List className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(s => <StreamCard key={s.stream_id || s.url} stream={s} onPlay={onPlay} />)}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((s, i) => {
              const name = cleanName(s.name);
              return (
                <div key={s.stream_id || s.url} onClick={() => onPlay(s)}
                  className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/4 transition-colors cursor-pointer">
                  <span className="text-xs text-white/20 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <div className="w-10 h-6 rounded overflow-hidden flex-shrink-0"
                    style={{ background: gradientFor(name).join(' ') }}>
                    {s.stream_icon && <img src={s.stream_icon} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />}
                  </div>
                  <p className="text-sm text-white/80 truncate flex-1">{name}</p>
                  <Play className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 transition-colors flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}
        {filtered.length === 0 && <p className="text-center text-white/25 py-16 text-sm">No channels found.</p>}
      </div>
    </div>
  );
}

// ── Loading screen ─────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Tv2 className="w-10 h-10 text-cyan-400" />
        </div>
        <div className="absolute -inset-2 rounded-2xl border border-cyan-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-black text-white mb-1">Quantum<span className="text-cyan-400">TV</span></h1>
        <p className="text-white/40 text-sm">Loading your channels…</p>
      </div>
      <div className="w-48 h-1 bg-white/6 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full animate-pulse" style={{ width: '60%' }} />
      </div>
    </div>
  );
}

// ── Main BrowseSection ────────────────────────────────────────────────────────
export default function BrowseSection() {
  const { playlist, loading, error, refresh } = useM3UPlaylist();
  const [selectedCat, setSelectedCat] = useState(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const playStream = useCallback((stream) => {
    const src = stream.direct_url || stream.url;
    setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
  }, []);

  const catStreamMap = useMemo(() => {
    if (!playlist) return {};
    const map = {};
    for (const s of playlist.streams) {
      if (!map[s.category_id]) map[s.category_id] = [];
      map[s.category_id].push(s);
    }
    return map;
  }, [playlist]);

  // Categorise shelves by type
  const { liveCategories, movieCategories, seriesCategories, musicCategories, kidsCategories, sportsCategories, newsCategories, otherCategories } = useMemo(() => {
    if (!playlist) return {};
    const live = [], movies = [], series = [], music = [], kids = [], sports = [], news = [], other = [];
    for (const c of playlist.categories) {
      const lc = c.category_name.toLowerCase();
      const count = catStreamMap[c.category_id]?.length ?? 0;
      if (!count) continue;
      if (lc.includes('movie') || lc.includes('film') || lc.includes('cinema') || lc.includes('vod')) movies.push(c);
      else if (lc.includes('series') || lc.includes('show') || lc.includes('episode')) series.push(c);
      else if (lc.includes('music') || lc.includes('radio')) music.push(c);
      else if (lc.includes('kids') || lc.includes('cartoon') || lc.includes('animation')) kids.push(c);
      else if (lc.includes('sport')) sports.push(c);
      else if (lc.includes('news')) news.push(c);
      else if (lc.includes('live') || lc.includes('tv') || lc.includes('channel')) live.push(c);
      else other.push(c);
    }
    return { liveCategories: live, movieCategories: movies, seriesCategories: series, musicCategories: music, kidsCategories: kids, sportsCategories: sports, newsCategories: news, otherCategories: other };
  }, [playlist, catStreamMap]);

  // Flatten streams for a list of categories
  const streamsFor = (cats = []) => cats.flatMap(c => catStreamMap[c.category_id] || []);

  // Global search
  const searchResults = useMemo(() => {
    if (!globalSearch || !playlist) return [];
    const q = globalSearch.toLowerCase();
    return playlist.streams.filter(s => cleanName(s.name).toLowerCase().includes(q)).slice(0, 80);
  }, [globalSearch, playlist]);

  if (loading) return <LoadingScreen />;

  if (error) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Tv2 className="w-12 h-12 text-white/15" />
      <p className="text-white/50 text-sm">{error}</p>
      <button onClick={refresh} className="px-5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/25 transition-colors">
        Try Again
      </button>
    </div>
  );

  // ── Channel list for selected category ──
  if (selectedCat) {
    return (
      <div className="h-full overflow-hidden p-4 sm:p-6">
        <ChannelListView
          category={selectedCat}
          streams={catStreamMap[selectedCat.category_id] || []}
          onPlay={playStream}
          onBack={() => setSelectedCat(null)}
        />
      </div>
    );
  }

  // ── All categories grid ──
  if (showAllCats) {
    return (
      <div className="h-full overflow-hidden p-4 sm:p-6">
        <CategoryGridView
          categories={playlist.categories}
          catStreamMap={catStreamMap}
          onSelect={(cat) => { setShowAllCats(false); setSelectedCat(cat); }}
          onBack={() => setShowAllCats(false)}
          title="All Categories"
        />
      </div>
    );
  }

  const hero = playlist.streams.find(s => s.stream_icon) || playlist.streams[0];
  const allCats = playlist.categories.filter(c => (catStreamMap[c.category_id]?.length ?? 0) > 0);

  // Build dynamic shelves from whatever categories exist
  const allMovieStreams = streamsFor(movieCategories || []);
  const allSeriesStreams = streamsFor(seriesCategories || []);
  const allSportsStreams = streamsFor(sportsCategories || []);
  const allNewsStreams = streamsFor(newsCategories || []);
  const allMusicStreams = streamsFor(musicCategories || []);
  const allKidsStreams = streamsFor(kidsCategories || []);
  const allLiveStreams = streamsFor(liveCategories || []);
  const allOtherStreams = streamsFor(otherCategories || []);

  // "Trending" — first 30 streams with icons
  const trending = playlist.streams.filter(s => s.stream_icon).slice(0, 30);
  // "Recently Added" — last 30 streams
  const recent = [...playlist.streams].reverse().slice(0, 30);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Search + header bar ── */}
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
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-all"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-white/20 flex-shrink-0 hidden md:block">{playlist.streams.length.toLocaleString()} channels</span>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pb-6">

        {globalSearch ? (
          /* Search results */
          <div className="pt-2">
            <p className="text-xs text-white/35 mb-4">{searchResults.length} results for "<span className="text-white/60">{globalSearch}</span>"</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {searchResults.map(s => <StreamCard key={s.stream_id || s.url} stream={s} onPlay={playStream} />)}
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
            <CategoryPills categories={allCats.slice(0, 20)} catStreamMap={catStreamMap} onSelect={setSelectedCat} />

            {/* Trending shelf */}
            {trending.length > 0 && (
              <Shelf title="Trending Now" icon={Flame} color="text-orange-400"
                streams={trending} onPlay={playStream}
                onViewAll={() => setShowAllCats(true)} />
            )}

            {/* Movies shelf */}
            {allMovieStreams.length > 0 && (
              <Shelf title="Movies" icon={Film} color="text-violet-400"
                streams={allMovieStreams} onPlay={playStream} aspect="portrait"
                onViewAll={() => setSelectedCat(movieCategories[0])} />
            )}

            {/* Sports shelf */}
            {allSportsStreams.length > 0 && (
              <Shelf title="Sports" icon={Zap} color="text-yellow-400"
                streams={allSportsStreams} onPlay={playStream}
                onViewAll={() => setSelectedCat(sportsCategories[0])} />
            )}

            {/* Series shelf */}
            {allSeriesStreams.length > 0 && (
              <Shelf title="TV Shows & Series" icon={Clapperboard} color="text-pink-400"
                streams={allSeriesStreams} onPlay={playStream} aspect="portrait"
                onViewAll={() => setSelectedCat(seriesCategories[0])} />
            )}

            {/* News shelf */}
            {allNewsStreams.length > 0 && (
              <Shelf title="News" icon={Globe} color="text-blue-400"
                streams={allNewsStreams} onPlay={playStream}
                onViewAll={() => setSelectedCat(newsCategories[0])} />
            )}

            {/* Kids shelf */}
            {allKidsStreams.length > 0 && (
              <Shelf title="Kids & Animation" icon={Star} color="text-green-400"
                streams={allKidsStreams} onPlay={playStream}
                onViewAll={() => setSelectedCat(kidsCategories[0])} />
            )}

            {/* Music shelf */}
            {allMusicStreams.length > 0 && (
              <Shelf title="Music & Radio" icon={Music} color="text-cyan-400"
                streams={allMusicStreams} onPlay={playStream}
                onViewAll={() => setSelectedCat(musicCategories[0])} />
            )}

            {/* Live TV shelf */}
            {allLiveStreams.length > 0 && (
              <Shelf title="Live TV" icon={Radio} color="text-red-400"
                streams={allLiveStreams} onPlay={playStream}
                onViewAll={() => setSelectedCat(liveCategories[0])} />
            )}

            {/* Other categories shelves — show each as its own row */}
            {(otherCategories || []).slice(0, 6).map(cat => {
              const streams = catStreamMap[cat.category_id] || [];
              if (!streams.length) return null;
              const Icon = getCatIcon(cat.category_name);
              return (
                <Shelf key={cat.category_id}
                  title={cleanName(cat.category_name)}
                  icon={Icon} color="text-white/50"
                  streams={streams} onPlay={playStream}
                  onViewAll={() => setSelectedCat(cat)} />
              );
            })}

            {/* Recently Added */}
            {recent.length > 0 && (
              <Shelf title="Recently Added" icon={Clock} color="text-white/50"
                streams={recent} onPlay={playStream}
                onViewAll={() => setShowAllCats(true)} />
            )}

            {/* Browse all categories button */}
            <div className="mt-4 mb-2">
              <button onClick={() => setShowAllCats(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/4 border border-white/8 text-white/50 text-sm font-bold hover:bg-white/8 hover:text-white transition-all">
                <Grid3X3 className="w-4 h-4" />
                Browse All {allCats.length} Categories
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}