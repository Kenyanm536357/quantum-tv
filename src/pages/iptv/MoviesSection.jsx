import React, { useState, useMemo, useRef } from 'react';
import { useM3UPlaylist, playM3UStream } from '@/lib/use-m3u-playlist.js';
import { cleanName } from '@/lib/clean-name';
import {
  Film, ChevronLeft, ChevronRight, Search, X, Play, Loader2,
  Grid3X3, List, Star, Clapperboard, TrendingUp
} from 'lucide-react';

const GRADIENTS = [
  ['#1a0533','#6d28d9'], ['#0c1a2e','#0ea5e9'], ['#1a0a00','#ea580c'],
  ['#0a1a0a','#16a34a'], ['#1a001a','#db2777'], ['#1a1000','#ca8a04'],
];
function gradientFor(name = '') {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function MovieCard({ stream, onPlay }) {
  const name = cleanName(stream.name);
  const [g1, g2] = gradientFor(name);
  const [imgOk, setImgOk] = useState(!!stream.stream_icon);

  return (
    <div onClick={() => onPlay(stream)}
      className="group cursor-pointer rounded-xl overflow-hidden border border-white/6 hover:border-white/25 transition-all duration-200 hover:scale-[1.04] hover:shadow-xl"
      style={{ background: '#0d1220' }}>
      <div className="relative aspect-[2/3] overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${g1}, ${g2})` }}>
        {imgOk && stream.stream_icon
          ? <img src={stream.stream_icon} alt={name}
              className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              onError={() => setImgOk(false)} />
          : <div className="w-full h-full flex items-center justify-center">
              <Film className="w-10 h-10 text-white/10" />
            </div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-[11px] font-semibold text-white/80 truncate leading-tight">{name}</p>
      </div>
    </div>
  );
}

// Horizontal shelf component
function Shelf({ title, streams, onPlay, onViewAll }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
  if (!streams?.length) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <span className="text-[10px] text-white/20">{streams.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onViewAll && <button onClick={onViewAll} className="text-[11px] font-bold text-violet-400 hover:text-violet-300 mr-2 transition-colors">See all →</button>}
          <button onClick={() => scroll(-1)} className="w-6 h-6 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <button onClick={() => scroll(1)} className="w-6 h-6 rounded-lg bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/40 hover:text-white transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {streams.slice(0, 40).map(s => (
          <div key={s.stream_id || s.url} style={{ width: 120, flexShrink: 0 }}>
            <MovieCard stream={s} onPlay={onPlay} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MoviesSection() {
  const { playlist, loading, error, refresh } = useM3UPlaylist();
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const catStreamMap = useMemo(() => {
    if (!playlist) return {};
    const map = {};
    for (const s of playlist.streams) {
      if (!map[s.category_id]) map[s.category_id] = [];
      map[s.category_id].push(s);
    }
    return map;
  }, [playlist]);

  const movieCats = useMemo(() => {
    if (!playlist) return [];
    const keywords = ['movie', 'film', 'cinema', 'vod', 'documentar', 'animation', 'action', 'comedy', 'drama', 'thriller', 'horror', 'sci-fi', 'fantasy'];
    const matched = playlist.categories.filter(c => {
      const lc = c.category_name.toLowerCase();
      return keywords.some(k => lc.includes(k)) && (catStreamMap[c.category_id]?.length ?? 0) > 0;
    });
    return matched.length > 0 ? matched : playlist.categories.filter(c => (catStreamMap[c.category_id]?.length ?? 0) > 0);
  }, [playlist, catStreamMap]);

  const displayedItems = useMemo(() => {
    if (!selectedCat) return [];
    const streams = catStreamMap[selectedCat.category_id] || [];
    if (!search) return streams;
    return streams.filter(s => cleanName(s.name).toLowerCase().includes(search.toLowerCase()));
  }, [selectedCat, catStreamMap, search]);

  const globalSearch = useMemo(() => {
    if (!search || selectedCat) return [];
    const q = search.toLowerCase();
    const allStreams = movieCats.flatMap(c => catStreamMap[c.category_id] || []);
    return allStreams.filter(s => cleanName(s.name).toLowerCase().includes(q)).slice(0, 60);
  }, [search, selectedCat, movieCats, catStreamMap]);

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      <p className="text-sm text-white/40">Loading movies…</p>
    </div>
  );

  if (error) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Film className="w-10 h-10 text-white/15" />
      <p className="text-sm text-white/40">{error}</p>
      <button onClick={refresh} className="px-5 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 text-sm font-semibold hover:bg-violet-500/25 transition-colors">Try Again</button>
    </div>
  );

  // ── Category drill-down ──
  if (selectedCat) {
    return (
      <div className="flex flex-col h-full gap-4">
        <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
          <button onClick={() => { setSelectedCat(null); setSearch(''); }}
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" /> Movies
          </button>
          <div>
            <h2 className="text-xl font-black text-white">{cleanName(selectedCat.category_name)}</h2>
            <p className="text-xs text-white/30 mt-0.5">{displayedItems.length} titles</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search titles…"
                className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-all w-44" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="flex items-center bg-white/5 border border-white/8 rounded-xl p-0.5">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-violet-500/20 text-violet-400' : 'text-white/35 hover:text-white'}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-violet-500/20 text-violet-400' : 'text-white/35 hover:text-white'}`}><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayedItems.map(s => <MovieCard key={s.stream_id || s.url} stream={s} onPlay={playM3UStream} />)}
            </div>
          ) : (
            <div className="space-y-1">
              {displayedItems.map((s, i) => (
                <div key={s.stream_id || s.url} onClick={() => playM3UStream(s)}
                  className="group flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/4 transition-colors cursor-pointer">
                  <span className="text-xs text-white/20 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <div className="w-8 h-12 rounded overflow-hidden flex-shrink-0" style={{ background: `linear-gradient(135deg, ${gradientFor(cleanName(s.name)).join(',')})` }}>
                    {s.stream_icon && <img src={s.stream_icon} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />}
                  </div>
                  <p className="text-sm text-white/80 truncate flex-1">{cleanName(s.name)}</p>
                  <Play className="w-3.5 h-3.5 text-white/20 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
          {displayedItems.length === 0 && <p className="text-center text-white/25 py-16 text-sm">No titles found.</p>}
        </div>
      </div>
    );
  }

  // ── Home view with shelves ──
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + search */}
      <div className="flex items-center gap-3 mb-6 flex-shrink-0 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-violet-400" /> Movies & Films
          </h2>
          <p className="text-xs text-white/30 mt-0.5">{movieCats.length} categories</p>
        </div>
        <div className="ml-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all movies…"
            className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-all w-48" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {search && !selectedCat ? (
          /* Global search */
          <div>
            <p className="text-xs text-white/35 mb-4">{globalSearch.length} results</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {globalSearch.map(s => <MovieCard key={s.stream_id || s.url} stream={s} onPlay={playM3UStream} />)}
            </div>
            {globalSearch.length === 0 && <p className="text-center text-white/25 py-16 text-sm">No movies found.</p>}
          </div>
        ) : (
          /* Shelves per category */
          <>
            {movieCats.map(cat => (
              <Shelf key={cat.category_id}
                title={cleanName(cat.category_name)}
                streams={catStreamMap[cat.category_id] || []}
                onPlay={playM3UStream}
                onViewAll={() => setSelectedCat(cat)} />
            ))}
            {movieCats.length === 0 && <p className="text-center text-white/25 py-16 text-sm">No movies available.</p>}
          </>
        )}
      </div>
    </div>
  );
}