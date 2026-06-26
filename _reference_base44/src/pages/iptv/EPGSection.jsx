import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useM3UPlaylist, playM3UStream } from '@/lib/use-m3u-playlist';
import { cleanName } from '@/lib/clean-name';
import {
  Tv2, ChevronLeft, ChevronRight, Search, X, Play, Loader2,
  Radio, Globe, Zap, Film, Music, Clock
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const SLOT_WIDTH  = 200;   // px per 30-min slot
const CHAN_WIDTH  = 220;   // px for channel column
const ROW_HEIGHT  = 56;    // px per row
const SLOTS_VIS   = 6;     // number of 30-min slots visible (3 hours)

const CAT_ICONS = { news: Globe, sports: Zap, movie: Film, film: Film, music: Music, kids: Tv2 };
function getCatIcon(name = '') {
  const l = name.toLowerCase();
  for (const [k, I] of Object.entries(CAT_ICONS)) if (l.includes(k)) return I;
  return Radio;
}

const GRADIENTS = [
  ['#1a0533','#6d28d9'], ['#0c1a2e','#0ea5e9'], ['#1a0a00','#ea580c'],
  ['#0a1a0a','#16a34a'], ['#1a001a','#db2777'], ['#1a1000','#ca8a04'],
];
function gradientFor(name = '') {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function formatTime(unix) {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDay(unix) {
  return new Date(unix * 1000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Build array of 30-min slot timestamps
function buildSlots(windowStart, count = SLOTS_VIS + 2) {
  const rounded = Math.floor(windowStart / 1800) * 1800;
  return Array.from({ length: count }, (_, i) => rounded + i * 1800);
}

// ── Category picker ───────────────────────────────────────────────────────────
function CategoryPicker({ categories, catStreamMap, onSelect, search, onSearch }) {
  const filtered = categories.filter(c =>
    (catStreamMap[c.category_id]?.length ?? 0) > 0 &&
    cleanName(c.category_name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Tv2 className="w-5 h-5 text-cyan-400" /> TV Guide
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search categories…"
            className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-all w-48" />
          {search && <button onClick={() => onSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cat => {
            const Icon = getCatIcon(cat.category_name);
            const [g1, g2] = gradientFor(cat.category_name);
            const count = catStreamMap[cat.category_id]?.length ?? 0;
            return (
              <button key={cat.category_id} onClick={() => onSelect(cat)}
                className="group relative flex items-center gap-3 p-4 rounded-xl border border-white/8 hover:border-cyan-500/30 hover:bg-white/4 transition-all text-left">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                  <Icon className="w-5 h-5 text-white/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{cleanName(cat.category_name)}</p>
                  <p className="text-[11px] text-white/35">{count} channels</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            );
          })}
          {filtered.length === 0 && <p className="col-span-full text-center text-white/25 py-16 text-sm">No categories found.</p>}
        </div>
      </div>
    </div>
  );
}

// ── TV Guide Grid ─────────────────────────────────────────────────────────────
function TVGuideGrid({ channels, search, windowStart, nowPlaying, onWatch }) {
  const now = Math.floor(Date.now() / 1000);
  const slots = buildSlots(windowStart);
  const totalW = slots.length * SLOT_WIDTH;
  const nowOff = Math.max(0, ((now - slots[0]) / 1800) * SLOT_WIDTH);

  const filtered = search
    ? channels.filter(c => cleanName(c.name).toLowerCase().includes(search.toLowerCase()))
    : channels;

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-white/8 bg-[#080c14]">
      {/* Time header row */}
      <div className="flex bg-[#070a10] border-b border-white/8 flex-shrink-0 overflow-hidden">
        <div className="flex-shrink-0 border-r border-white/8 flex items-center px-4"
          style={{ width: CHAN_WIDTH, minHeight: 40 }}>
          <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{formatDay(now)}</p>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex" style={{ width: totalW }}>
            {slots.map((s, i) => (
              <div key={i} style={{ width: SLOT_WIDTH, flexShrink: 0, minHeight: 40 }}
                className="border-l border-white/6 flex items-center px-3">
                <p className="text-[11px] font-bold text-white/50">{formatTime(s)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Channel rows */}
      <div className="flex-1 overflow-auto min-h-0">
        <div style={{ minWidth: CHAN_WIDTH + totalW }}>
          {filtered.length === 0 && (
            <p className="text-center text-white/25 py-16 text-sm">No channels found.</p>
          )}
          {filtered.map((ch, idx) => {
            const name = cleanName(ch.name);
            const isPlaying = nowPlaying === (ch.stream_id || ch.url);
            const [g1, g2] = gradientFor(name);

            // Each channel gets a single "LIVE NOW" block spanning the current 30-min slot
            const currentSlot = Math.floor(now / 1800) * 1800;
            const blockLeft = Math.max(0, ((currentSlot - slots[0]) / 1800) * SLOT_WIDTH);
            const blockWidth = SLOT_WIDTH - 2;

            return (
              <div key={ch.stream_id || ch.url || idx}
                className={`flex border-b border-white/5 group transition-colors ${isPlaying ? 'bg-cyan-500/6' : 'hover:bg-white/2'}`}
                style={{ height: ROW_HEIGHT }}>

                {/* Channel label — sticky left */}
                <div
                  onClick={() => onWatch(ch)}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-3 border-r border-white/6 sticky left-0 z-10 cursor-pointer transition-colors select-none ${
                    isPlaying ? 'bg-cyan-500/12' : 'bg-[#080c14] group-hover:bg-white/4'
                  }`}
                  style={{ width: CHAN_WIDTH, height: ROW_HEIGHT }}>
                  <span className="text-[10px] text-white/20 w-5 text-right flex-shrink-0">{idx + 1}</span>
                  {/* Logo */}
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
                    {ch.stream_icon
                      ? <img src={ch.stream_icon} alt="" className="w-full h-full object-contain"
                          onError={e => { e.target.style.display = 'none'; }} />
                      : null}
                  </div>
                  <p className={`text-[12px] font-semibold truncate flex-1 leading-tight ${isPlaying ? 'text-cyan-400' : 'text-white/75'}`}>
                    {name}
                  </p>
                  {isPlaying && <Play className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                </div>

                {/* Program track */}
                <div className="relative flex-1" style={{ height: ROW_HEIGHT }}>
                  <div style={{ position: 'absolute', inset: 0, width: totalW }}>
                    {/* Slot grid lines */}
                    {slots.map((_, si) => (
                      <div key={si} className="absolute inset-y-0 border-l border-white/4"
                        style={{ left: si * SLOT_WIDTH }} />
                    ))}

                    {/* LIVE NOW block */}
                    <button
                      onClick={() => onWatch(ch)}
                      style={{ left: blockLeft + 1, width: blockWidth, top: 5, bottom: 5, position: 'absolute' }}
                      className={`rounded-lg text-left flex items-center px-3 gap-2 overflow-hidden transition-all hover:brightness-125 ${
                        isPlaying
                          ? 'bg-cyan-500/25 border border-cyan-500/60'
                          : 'bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20'
                      }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <span className="text-[11px] font-bold text-white/75 truncate">LIVE NOW</span>
                      <span className="text-[9px] text-white/30 ml-auto flex-shrink-0">
                        {formatTime(currentSlot)} – {formatTime(currentSlot + 1800)}
                      </span>
                    </button>

                    {/* Future empty slots */}
                    {slots.slice(1).map((s, si) => s > currentSlot && (
                      <div key={si}
                        style={{ left: ((s - slots[0]) / 1800) * SLOT_WIDTH + 1, width: blockWidth, top: 5, bottom: 5, position: 'absolute' }}
                        className="rounded-lg bg-white/3 border border-white/6 flex items-center px-3">
                        <span className="text-[10px] text-white/15 truncate">
                          {formatTime(s)} – {formatTime(s + 1800)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* NOW red line */}
                  {nowOff >= 0 && nowOff < totalW && (
                    <div className="absolute inset-y-0 w-0.5 bg-red-500/70 pointer-events-none z-20"
                      style={{ left: nowOff }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main EPGSection ───────────────────────────────────────────────────────────
export default function EPGSection() {
  const { playlist, loading, error, refresh } = useM3UPlaylist();
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [windowStart, setWindowStart] = useState(() =>
    Math.floor(Date.now() / 1000 / 1800) * 1800 - 1800
  );

  const catStreamMap = useMemo(() => {
    if (!playlist) return {};
    const map = {};
    for (const s of playlist.streams) {
      if (!map[s.category_id]) map[s.category_id] = [];
      map[s.category_id].push(s);
    }
    return map;
  }, [playlist]);

  const channels = useMemo(() => {
    if (!selectedCat) return [];
    return catStreamMap[selectedCat.category_id] || [];
  }, [selectedCat, catStreamMap]);

  const handleWatch = useCallback((stream) => {
    setNowPlaying(stream.stream_id || stream.url);
    playM3UStream(stream);
  }, []);

  const handleBack = () => { setSelectedCat(null); setSearch(''); setNowPlaying(null); };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      <p className="text-sm text-white/40">Loading TV Guide…</p>
    </div>
  );

  if (error) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Tv2 className="w-10 h-10 text-white/15" />
      <p className="text-sm text-white/40">{error}</p>
      <button onClick={refresh} className="px-5 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/25 transition-colors">
        Try Again
      </button>
    </div>
  );

  // ── Category picker ──
  if (!selectedCat) {
    return (
      <div className="h-full overflow-hidden p-4 sm:p-6">
        <CategoryPicker
          categories={playlist?.categories ?? []}
          catStreamMap={catStreamMap}
          onSelect={(cat) => { setSelectedCat(cat); setSearch(''); }}
          search={search}
          onSearch={setSearch}
        />
      </div>
    );
  }

  // ── TV Guide grid ──
  return (
    <div className="flex flex-col h-full overflow-hidden p-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap px-4 sm:px-6 py-3 flex-shrink-0 border-b border-white/6 bg-[#07090f]">
        <button onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> TV Guide
        </button>
        <span className="text-white/20">/</span>
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Tv2 className="w-4 h-4 text-cyan-400" />
          {cleanName(selectedCat.category_name)}
          <span className="text-white/25 font-normal ml-1">({channels.length})</span>
        </h2>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter channels…"
              className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-8 py-1.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 transition-all w-36" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          {/* Time nav */}
          <button onClick={() => setWindowStart(w => w - 3600)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWindowStart(Math.floor(Date.now() / 1000 / 1800) * 1800 - 1800)}
            className="px-3 h-8 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 text-xs font-bold transition-colors">
            NOW
          </button>
          <button onClick={() => setWindowStart(w => w + 3600)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden px-4 sm:px-6 py-4">
        <TVGuideGrid
          channels={channels}
          search={search}
          windowStart={windowStart}
          nowPlaying={nowPlaying}
          onWatch={handleWatch}
        />
      </div>
    </div>
  );
}