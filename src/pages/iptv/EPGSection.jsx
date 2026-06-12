import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/use-store';
import { usePlaylist } from '@/lib/use-playlist';
import { setState, apiUrl } from '@/lib/iptv-store';
import { Tv2, ChevronLeft, ChevronRight, Radio, Loader2, Play, X } from 'lucide-react';
import SearchInput from '@/components/iptv/SearchInput';
import { cleanName } from '@/lib/clean-name';
import VideoPlayer from '@/components/iptv/VideoPlayer';

// ─── Constants ───────────────────────────────────────────────────────────────
const SLOT_WIDTH  = 180;   // px per 30-min slot
const CHAN_WIDTH  = 220;   // px for the channel label column
const ROW_HEIGHT  = 54;    // px per channel row
const MINS_VIS   = 120;   // 2 hours visible

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

function extractState(name = '') {
  const upper = name.toUpperCase();
  for (const st of US_STATES) {
    if (new RegExp(`(^|[\\s|\\-(:,])${st}([\\s|\\-):,]|$)`).test(upper)) return st;
  }
  return null;
}

function decodeBase64(s) {
  if (!s) return '';
  try { return atob(s); } catch { return s; }
}

function toUnix(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (!isNaN(n)) return n;
  return Math.floor(new Date(v).getTime() / 1000);
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildSlots(windowStart) {
  const rounded = Math.floor(windowStart / 1800) * 1800;
  const count = Math.ceil(MINS_VIS / 30) + 2;
  return Array.from({ length: count }, (_, i) => rounded + i * 1800);
}

// ─── Category Picker ─────────────────────────────────────────────────────────
function CategoryPicker({ categories, onSelect, loading, search, onSearch }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
          <Tv2 className="w-5 h-5 text-primary" /> TV Guide — Select a Category
        </h2>
        <div className="w-52">
          <SearchInput value={search} onChange={onSearch} placeholder="Search categories…" />
        </div>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto">
          {categories
            .filter(c => cleanName(c.category_name || '').toLowerCase().includes(search.toLowerCase()))
            .map((cat, i) => (
              <button key={cat.category_id || i} onClick={() => onSelect(cat)}
                className="flex items-center gap-3.5 p-4 bg-white/4 border border-white/8 hover:border-primary/40 hover:bg-primary/5 rounded-xl transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Tv2 className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-white truncate">{cleanName(cat.category_name)}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Kodi-style EPG Grid ──────────────────────────────────────────────────────
function EPGGrid({ channels, epgMap, windowStart, onWatch, onSelectProgram, loadingChans, loadingEpg, search, stateFilter, availableStates, onStateFilter, player }) {
  const gridRef = useRef(null);
  const now     = Date.now() / 1000;
  const slots   = buildSlots(windowStart);
  const totalW  = slots.length * SLOT_WIDTH;
  const nowOff  = ((now - windowStart) / 1800) * SLOT_WIDTH;

  const filtered = channels.filter(c => {
    const matchSearch = cleanName(c.name).toLowerCase().includes(search.toLowerCase());
    const matchState  = stateFilter === 'ALL' || extractState(c.name) === stateFilter;
    return matchSearch && matchState;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top split: video preview + current program info ── */}
      <div className="flex gap-0 bg-[#0a0e1a] border-b border-white/8" style={{ minHeight: 200 }}>
        {/* Video pane */}
        <div className="relative bg-black flex-shrink-0 flex items-center justify-center"
          style={{ width: 340, minHeight: 200 }}>
          {player?.src ? (
            <video
              key={player.src}
              src={player.src}
              autoPlay muted
              className="w-full h-full object-contain"
              style={{ maxHeight: 200 }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/20">
              <Tv2 className="w-10 h-10" />
              <span className="text-xs">Select a channel to preview</span>
            </div>
          )}
        </div>

        {/* Program info */}
        <div className="flex-1 flex flex-col justify-center px-6 py-4 min-w-0">
          {player ? (
            <>
              <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">Now Playing</p>
              <h2 className="text-xl font-bold text-white truncate">{player.title || 'Live Stream'}</h2>
              {(() => {
                const epg = epgMap[channels.find(c => c.name === player.title)?.stream_id];
                const now2 = Date.now() / 1000;
                const cur  = epg?.find(p => toUnix(p.start) <= now2 && toUnix(p.stop) > now2);
                if (!cur) return null;
                const title = cleanName(decodeBase64(cur.title));
                const desc  = decodeBase64(cur.description || '');
                const start = toUnix(cur.start);
                const stop  = toUnix(cur.stop);
                const pct   = Math.round(((now2 - start) / (stop - start)) * 100);
                return (
                  <div className="mt-2">
                    <p className="text-sm text-white/80 font-medium">{title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{formatTime(new Date(start * 1000))} — {formatTime(new Date(stop * 1000))}&nbsp;&nbsp;·&nbsp;&nbsp;{Math.round((stop - start) / 60)} min</p>
                    {desc && <p className="text-xs text-white/40 mt-1.5 line-clamp-2">{desc}</p>}
                    <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden w-48">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <p className="text-sm text-white/30">Click a channel to start watching</p>
          )}
        </div>
      </div>

      {/* ── State filter pills ── */}
      {availableStates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 bg-[#0a0e1a] border-b border-white/6"
          style={{ scrollbarWidth: 'none' }}>
          {['ALL', ...availableStates].map(st => (
            <button key={st} onClick={() => onStateFilter(st === stateFilter ? 'ALL' : st)}
              className={`flex-shrink-0 px-3 py-0.5 rounded-full text-[11px] font-bold transition-colors border ${
                stateFilter === st
                  ? 'bg-primary text-black border-primary'
                  : 'bg-white/5 text-white/40 border-white/8 hover:text-white/70'
              }`}>
              {st === 'ALL' ? 'All' : st}
            </button>
          ))}
        </div>
      )}

      {/* ── EPG Scrollable grid ── */}
      <div ref={gridRef} className="flex-1 overflow-auto" style={{ position: 'relative' }}>
        <div style={{ minWidth: CHAN_WIDTH + totalW }}>

          {/* Sticky time header */}
          <div className="sticky top-0 z-20 flex bg-[#080c14] border-b border-white/8">
            {/* Corner */}
            <div className="flex-shrink-0 bg-[#080c14] border-r border-white/8 flex items-center px-3"
              style={{ width: CHAN_WIDTH, minHeight: 36 }}>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {formatDay(new Date())}
              </p>
            </div>
            {/* Time slots */}
            {slots.map((s, i) => (
              <div key={i} style={{ width: SLOT_WIDTH, minHeight: 36, flexShrink: 0 }}
                className="border-l border-white/6 flex flex-col justify-center px-2">
                <p className="text-[11px] font-bold text-white/60">{formatTime(new Date(s * 1000))}</p>
              </div>
            ))}
            {/* NOW line in header */}
            {nowOff >= 0 && nowOff < totalW && (
              <div className="absolute top-0 bottom-0 w-px bg-primary/80 pointer-events-none z-30"
                style={{ left: CHAN_WIDTH + nowOff }} />
            )}
          </div>

          {/* Loading */}
          {loadingChans ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-white/30 py-16 text-sm">No channels found.</p>
          ) : filtered.map((ch, idx) => {
            const epg    = epgMap[ch.stream_id] || [];
            const isPlaying = player?.title === cleanName(ch.name);

            return (
              <div key={ch.stream_id}
                className={`flex border-b border-white/5 group transition-colors ${isPlaying ? 'bg-primary/8' : 'hover:bg-white/3'}`}
                style={{ height: ROW_HEIGHT }}>

                {/* Channel label — sticky left */}
                <div
                  onClick={() => onWatch(ch)}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-3 border-r border-white/6 sticky left-0 z-10 cursor-pointer transition-colors ${
                    isPlaying ? 'bg-primary/15' : 'bg-[#0a0e1a] group-hover:bg-white/5'
                  }`}
                  style={{ width: CHAN_WIDTH, height: ROW_HEIGHT }}>
                  {/* Number */}
                  <span className="text-[11px] text-white/25 w-5 text-right flex-shrink-0">{idx + 1}</span>
                  {/* Logo */}
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {ch.stream_icon ? (
                      <img src={ch.stream_icon} alt="" className="w-full h-full object-contain"
                        onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <Radio className="w-4 h-4 text-white/20" />
                    )}
                  </div>
                  {/* Name */}
                  <p className={`text-[12px] font-semibold truncate flex-1 ${isPlaying ? 'text-primary' : 'text-white/75'}`}>
                    {cleanName(ch.name)}
                  </p>
                  {isPlaying && <Play className="w-3 h-3 text-primary flex-shrink-0" />}
                </div>

                {/* Program track */}
                <div className="relative flex-1 overflow-hidden" style={{ height: ROW_HEIGHT }}>
                  <div style={{ position: 'absolute', inset: 0, width: totalW }}>
                    {/* Grid lines */}
                    {slots.map((_, si) => (
                      <div key={si} className="absolute inset-y-0 border-l border-white/4"
                        style={{ left: si * SLOT_WIDTH }} />
                    ))}

                    {loadingEpg && epg.length === 0 ? (
                      <div className="absolute inset-0 flex items-center px-3">
                        <div className="h-1.5 w-16 bg-white/8 rounded-full animate-pulse" />
                      </div>
                    ) : epg.length === 0 ? (
                      <div className="absolute inset-0 flex items-center px-4">
                        <span className="text-[11px] text-white/20">No information</span>
                      </div>
                    ) : epg.map((prog, pi) => {
                      const start = toUnix(prog.start);
                      const stop  = toUnix(prog.stop);
                      if (stop < windowStart || start > windowStart + MINS_VIS * 60) return null;
                      const left  = ((start - windowStart) / 1800) * SLOT_WIDTH;
                      const width = Math.max(((stop - start) / 1800) * SLOT_WIDTH - 2, 4);
                      const isNow = now >= start && now < stop;
                      const pct   = isNow ? Math.round(((now - start) / (stop - start)) * 100) : 0;
                      const title = cleanName(decodeBase64(prog.title) || 'No information');

                      return (
                        <button key={pi}
                          onClick={() => onSelectProgram(prog, ch)}
                          style={{ left: left + 1, width, top: 3, bottom: 3, position: 'absolute' }}
                          className={`rounded text-left flex flex-col justify-center px-2 overflow-hidden transition-all hover:brightness-125 hover:z-10 ${
                            isNow
                              ? 'bg-primary/20 border border-primary/50 text-white'
                              : 'bg-white/5 border border-white/8 text-white/55 hover:bg-white/10'
                          }`}
                          title={title}>
                          {isNow && (
                            <div className="absolute bottom-0 left-0 h-0.5 bg-primary rounded-full"
                              style={{ width: `${pct}%` }} />
                          )}
                          <span className="text-[11px] font-semibold truncate leading-tight">{title}</span>
                          <span className="text-[9px] text-white/35 truncate">
                            {formatTime(new Date(start * 1000))} – {formatTime(new Date(stop * 1000))}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* NOW red line per row */}
                  {nowOff >= 0 && nowOff < totalW && (
                    <div className="absolute inset-y-0 w-px bg-red-500/60 pointer-events-none z-20"
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

// ─── Program Detail Drawer ────────────────────────────────────────────────────
function ProgramDrawer({ prog, channel, onClose, onWatch }) {
  if (!prog) return null;
  const title  = cleanName(decodeBase64(prog.title) || 'No Info');
  const desc   = decodeBase64(prog.description || '');
  const start  = toUnix(prog.start);
  const stop   = toUnix(prog.stop);
  const now    = Date.now() / 1000;
  const isNow  = now >= start && now < stop;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {isNow && <span className="inline-block mb-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-black">ON NOW</span>}
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-white/40 mt-0.5">
              {cleanName(channel.name)} · {formatTime(new Date(start * 1000))} – {formatTime(new Date(stop * 1000))}
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        {desc && <p className="text-sm text-white/60 leading-relaxed mb-4">{desc}</p>}
        {isNow && (
          <button onClick={() => { onWatch(channel); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-black font-bold text-sm">
            <Play className="w-4 h-4 fill-black" /> Watch Now
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main EPGSection ──────────────────────────────────────────────────────────
export default function EPGSection() {
  const { credentials, player } = useStore();
  const { fetchAction, resolveStreamUrl } = usePlaylist(credentials);

  const [categories, setCategories]   = useState([]);
  const [channels, setChannels]       = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [epgMap, setEpgMap]           = useState({});
  const [search, setSearch]           = useState('');
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingChans, setLoadingChans] = useState(false);
  const [loadingEpg, setLoadingEpg]   = useState(false);
  const [selectedProg, setSelectedProg] = useState(null);
  const [windowStart, setWindowStart] = useState(() => Math.floor(Date.now() / 1000 / 1800) * 1800 - 1800);
  const [stateFilter, setStateFilter] = useState('ALL');

  useEffect(() => {
    setLoadingCats(true);
    fetchAction('get_live_categories').then(data => {
      if (data) setCategories(data);
      setLoadingCats(false);
    });
  }, [fetchAction]);

  const selectCategory = async (cat) => {
    setSelectedCat(cat);
    setSearch('');
    setEpgMap({});
    setStateFilter('ALL');
    setLoadingChans(true);
    const data = await fetchAction('get_live_streams', { category_id: cat.category_id });
    const chans = data || [];
    setChannels(chans);
    setLoadingChans(false);

    if (chans.length) {
      setLoadingEpg(true);
      const batch = chans.slice(0, 60);
      const results = await Promise.all(
        batch.map(async ch => {
          try {
            const url = apiUrl(credentials, 'get_short_epg', { stream_id: ch.stream_id, limit: 10 });
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) return { id: ch.stream_id, listings: [] };
            const json = await res.json();
            return { id: ch.stream_id, listings: json?.epg_listings ?? [] };
          } catch {
            return { id: ch.stream_id, listings: [] };
          }
        })
      );
      const map = {};
      results.forEach(r => { map[r.id] = r.listings; });
      setEpgMap(map);
      setLoadingEpg(false);
    }
  };

  const watchChannel = useCallback(async (ch) => {
    const src = await resolveStreamUrl(ch, 'live');
    setState({ player: { src, title: cleanName(ch.name), type: 'live' } });
  }, [resolveStreamUrl]);

  const availableStates = [...new Set(channels.map(c => extractState(c.name)).filter(Boolean))].sort();

  if (!selectedCat) {
    return (
      <CategoryPicker
        categories={categories}
        onSelect={selectCategory}
        loading={loadingCats}
        search={search}
        onSearch={setSearch}
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.75rem)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap px-0 pb-2 flex-shrink-0">
        <button onClick={() => { setSelectedCat(null); setChannels([]); setEpgMap({}); }}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Categories
        </button>
        <span className="text-white/20">/</span>
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
          <Tv2 className="w-4 h-4 text-primary" />
          {cleanName(selectedCat.category_name)}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-44">
            <SearchInput value={search} onChange={setSearch} placeholder="Filter channels…" />
          </div>
          <button onClick={() => setWindowStart(w => w - 3600)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWindowStart(Math.floor(Date.now() / 1000 / 1800) * 1800 - 1800)}
            className="px-3 h-8 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold transition-colors">
            NOW
          </button>
          <button onClick={() => setWindowStart(w => w + 3600)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          {loadingEpg && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>
      </div>

      {/* Main EPG grid */}
      <div className="flex-1 overflow-hidden rounded-xl border border-white/8 bg-[#0a0e1a]">
        <EPGGrid
          channels={channels}
          epgMap={epgMap}
          windowStart={windowStart}
          onWatch={watchChannel}
          onSelectProgram={(prog, ch) => setSelectedProg({ prog, channel: ch })}
          loadingChans={loadingChans}
          loadingEpg={loadingEpg}
          search={search}
          stateFilter={stateFilter}
          availableStates={availableStates}
          onStateFilter={setStateFilter}
          player={player}
        />
      </div>

      {selectedProg && (
        <ProgramDrawer
          prog={selectedProg.prog}
          channel={selectedProg.channel}
          onClose={() => setSelectedProg(null)}
          onWatch={watchChannel}
        />
      )}
    </div>
  );
}