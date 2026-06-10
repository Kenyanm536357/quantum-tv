import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/use-store';
import { usePlaylist } from '@/lib/use-playlist';
import { setState, apiUrl } from '@/lib/iptv-store';
import { Tv2, ChevronLeft, ChevronRight, Radio, Loader2, Play, RefreshCw } from 'lucide-react';
import SearchInput from '@/components/iptv/SearchInput';
import { cleanName } from '@/lib/clean-name';

const MINS_VISIBLE = 120;   // 2 hours visible in the viewport
const SLOT_WIDTH   = 200;   // px per 30-min slot
const CHAN_WIDTH   = 160;   // px for channel label column

// US state abbreviations + a few extras to detect from channel names
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

function extractState(name = '') {
  const upper = name.toUpperCase();
  // Match patterns like "| TX |", "TX:", "(TX)", "- TX -", " TX " at word boundary
  for (const st of US_STATES) {
    if (new RegExp(`(^|[\\s|\\-(:,])${st}([\\s|\\-):,]|$)`).test(upper)) return st;
  }
  return null;
}

function getStatesFromChannels(channels) {
  const set = new Set();
  channels.forEach(ch => {
    const st = extractState(ch.name);
    if (st) set.add(st);
  });
  return [...set].sort();
}

function decodeBase64(s) {
  if (!s) return '';
  try { return atob(s); } catch { return s; }
}

function toUnix(v) {
  if (!v) return 0;
  // already numeric
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (!isNaN(n)) return n;
  // ISO string
  return Math.floor(new Date(v).getTime() / 1000);
}

function formatHour(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayShort(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Build time slot headers starting from `startMin` (minutes since epoch start of day)
function buildTimeSlots(windowStart) {
  // Round windowStart down to nearest 30 min
  const rounded = Math.floor(windowStart / 1800) * 1800;
  const slots = [];
  for (let i = 0; i < (MINS_VISIBLE / 30) + 2; i++) {
    const t = rounded + i * 1800;
    slots.push(t);
  }
  return slots;
}

// Given a program, compute its left offset and width in px
function programLayout(prog, windowStart) {
  const start = Math.max(toUnix(prog.start), windowStart);
  const stop  = toUnix(prog.stop);
  const left  = ((toUnix(prog.start) - windowStart) / 1800) * SLOT_WIDTH;
  const width = Math.max(((stop - toUnix(prog.start)) / 1800) * SLOT_WIDTH, 4);
  const visLeft = ((start - windowStart) / 1800) * SLOT_WIDTH;
  const visWidth = ((stop - start) / 1800) * SLOT_WIDTH;
  return { left, width, visLeft, visWidth };
}

/* ─── Time header ─────────────────────────────────────────────── */
function TimeHeader({ slots, windowStart, nowOffset }) {
  return (
    <div className="flex" style={{ marginLeft: CHAN_WIDTH }}>
      {slots.map((s, i) => (
        <div
          key={i}
          className="flex-shrink-0 border-l border-white/8 px-2 py-1.5 text-[11px] font-semibold text-white/50"
          style={{ width: SLOT_WIDTH }}
        >
          {formatHour(new Date(s * 1000))}
          <span className="block text-[9px] font-normal text-white/25">{formatDayShort(new Date(s * 1000))}</span>
        </div>
      ))}
      {/* NOW indicator line — just a visual marker in the header */}
      {nowOffset >= 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-primary/70 z-10 pointer-events-none"
          style={{ left: CHAN_WIDTH + nowOffset }}
        />
      )}
    </div>
  );
}

/* ─── Channel row ─────────────────────────────────────────────── */
function ChannelRow({ channel, epg, windowStart, onWatch, onSelectProgram }) {
  const now = Date.now() / 1000;
  const slots = buildTimeSlots(windowStart);
  const totalWidth = slots.length * SLOT_WIDTH;

  return (
    <div className="flex border-t border-white/6 group" style={{ minHeight: 56 }}>
      {/* Channel label */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 bg-[#0d1117] border-r border-white/8 sticky left-0 z-10 cursor-pointer hover:bg-white/5 transition-colors"
        style={{ width: CHAN_WIDTH, minHeight: 56 }}
        onClick={() => onWatch(channel)}
      >
        <div className="w-8 h-8 rounded bg-white/5 overflow-hidden flex items-center justify-center flex-shrink-0">
          {channel.stream_icon ? (
            <img src={channel.stream_icon} alt="" className="w-full h-full object-contain"
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <Radio className="w-4 h-4 text-white/30" />
          )}
        </div>
        <p className="text-[11px] font-medium text-white/80 truncate leading-tight flex-1">{cleanName(channel.name)}</p>
        <Play className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Program track */}
      <div className="relative flex-1 overflow-hidden" style={{ height: 56 }}>
        <div className="absolute inset-y-0" style={{ width: totalWidth, left: 0 }}>
          {/* Background grid lines */}
          {slots.map((_, i) => (
            <div key={i} className="absolute inset-y-0 border-l border-white/5"
              style={{ left: i * SLOT_WIDTH }} />
          ))}

          {/* Programs */}
          {epg.map((prog, pi) => {
            const start = toUnix(prog.start);
            const stop  = toUnix(prog.stop);
            if (stop < windowStart || start > windowStart + MINS_VISIBLE * 60) return null;
            const left  = ((start - windowStart) / 1800) * SLOT_WIDTH;
            const width = ((stop - start) / 1800) * SLOT_WIDTH;
            const isNow = now >= start && now < stop;
            const pct   = isNow ? Math.round(((now - start) / (stop - start)) * 100) : 0;
            const title = cleanName(decodeBase64(prog.title) || 'No Info');

            return (
              <button
                key={pi}
                onClick={() => onSelectProgram(prog, channel)}
                className={`absolute inset-y-[3px] rounded text-left overflow-hidden flex flex-col justify-center px-2 transition-all hover:z-10 hover:brightness-125 ${
                  isNow
                    ? 'bg-primary/25 border border-primary/50 text-white'
                    : 'bg-white/5 border border-white/8 text-white/70 hover:bg-white/10'
                }`}
                style={{ left: left + 1, width: Math.max(width - 2, 4) }}
                title={title}
              >
                {isNow && (
                  <div className="absolute bottom-0 left-0 h-0.5 bg-primary/80 rounded-full"
                    style={{ width: `${pct}%` }} />
                )}
                <span className="text-[11px] font-semibold truncate leading-tight">{title}</span>
                <span className="text-[9px] text-white/40 truncate">
                  {formatHour(new Date(start * 1000))} – {formatHour(new Date(stop * 1000))}
                </span>
              </button>
            );
          })}
        </div>

        {/* NOW red line */}
        {(() => {
          const nowOff = ((now - windowStart) / 1800) * SLOT_WIDTH;
          if (nowOff < 0 || nowOff > totalWidth) return null;
          return (
            <div className="absolute inset-y-0 w-px bg-red-500/70 pointer-events-none z-20"
              style={{ left: nowOff }} />
          );
        })()}
      </div>
    </div>
  );
}

/* ─── Program detail drawer ───────────────────────────────────── */
function ProgramDrawer({ prog, channel, onClose, onWatch }) {
  if (!prog) return null;
  const title = cleanName(decodeBase64(prog.title) || 'No Info');
  const desc  = decodeBase64(prog.description || '');
  const start = toUnix(prog.start);
  const stop  = toUnix(prog.stop);
  const now   = Date.now() / 1000;
  const isNow = now >= start && now < stop;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {isNow && <span className="inline-block mb-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-black">ON NOW</span>}
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-white/40 mt-0.5">
              {cleanName(channel.name)} · {formatHour(new Date(start * 1000))} – {formatHour(new Date(stop * 1000))}
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-lg leading-none">✕</button>
        </div>
        {desc && <p className="text-sm text-white/60 leading-relaxed mb-4">{desc}</p>}
        {isNow && (
          <button
            onClick={() => { onWatch(channel); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-black font-bold text-sm"
          >
            <Play className="w-4 h-4 fill-black" /> Watch Now
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main EPG page ───────────────────────────────────────────── */
export default function EPGSection() {
  const { credentials } = useStore();
  const { fetchAction, resolveStreamUrl } = usePlaylist(credentials);

  const [categories, setCategories]     = useState([]);
  const [channels, setChannels]         = useState([]);
  const [selectedCat, setSelectedCat]   = useState(null);
  const [epgMap, setEpgMap]             = useState({});   // stream_id → listing[]
  const [search, setSearch]             = useState('');
  const [loadingCats, setLoadingCats]   = useState(false);
  const [loadingChans, setLoadingChans] = useState(false);
  const [loadingEpg, setLoadingEpg]     = useState(false);
  const [selectedProg, setSelectedProg] = useState(null);  // { prog, channel }
  const [windowStart, setWindowStart]   = useState(() => Math.floor(Date.now() / 1000 / 1800) * 1800 - 1800);
  const [stateFilter, setStateFilter]   = useState('ALL');

  const gridRef = useRef(null);

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

    // Fetch EPG for all channels in parallel (batch of 30)
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

  const shiftWindow = (dir) => {
    setWindowStart(w => w + dir * 3600); // ±1 hour
  };

  const jumpToNow = () => {
    setWindowStart(Math.floor(Date.now() / 1000 / 1800) * 1800 - 1800);
  };

  const filteredCats   = categories.filter(c => (c.category_name || '').toLowerCase().includes(search.toLowerCase()));
  const availableStates = getStatesFromChannels(channels);
  const filteredChans  = channels.filter(c => {
    const matchSearch = cleanName(c.name).toLowerCase().includes(search.toLowerCase());
    const matchState  = stateFilter === 'ALL' || extractState(c.name) === stateFilter;
    return matchSearch && matchState;
  });
  const slots         = buildTimeSlots(windowStart);
  const now           = Date.now() / 1000;
  const nowOffset     = ((now - windowStart) / 1800) * SLOT_WIDTH;

  /* ── Category picker ── */
  if (!selectedCat) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Tv2 className="w-5 h-5 text-primary" /> TV Guide
          </h2>
          <div className="w-52">
            <SearchInput value={search} onChange={setSearch} placeholder="Search categories…" />
          </div>
        </div>
        {loadingCats ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCats.map((cat, i) => (
              <button key={cat.category_id || i} onClick={() => selectCategory(cat)}
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

  /* ── Guide grid ── */
  return (
    <div className="flex flex-col gap-0 -mx-4 sm:-mx-6 lg:-mx-10">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap px-4 sm:px-6 lg:px-10 pb-4">
        <button onClick={() => { setSelectedCat(null); setChannels([]); setEpgMap({}); }}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Tv2 className="w-4 h-4 text-primary" />
            {cleanName(selectedCat.category_name)}
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="w-44">
            <SearchInput value={search} onChange={setSearch} placeholder="Filter channels…" />
          </div>
          {/* Time nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => shiftWindow(-1)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={jumpToNow}
              className="px-3 h-8 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold transition-colors">
              NOW
            </button>
            <button onClick={() => shiftWindow(1)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {loadingEpg && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>
      </div>

      {/* State filter pills — only shown when states are detected */}
      {availableStates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 sm:px-6 lg:px-10 pb-3 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setStateFilter('ALL')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
              stateFilter === 'ALL'
                ? 'bg-primary text-black border-primary'
                : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white/80'
            }`}
          >
            All States
          </button>
          {availableStates.map(st => (
            <button
              key={st}
              onClick={() => setStateFilter(st === stateFilter ? 'ALL' : st)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                stateFilter === st
                  ? 'bg-primary text-black border-primary'
                  : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white/80'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      {/* Guide grid */}
      <div
        ref={gridRef}
        className="overflow-x-auto overflow-y-auto select-none"
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
        <div style={{ minWidth: CHAN_WIDTH + slots.length * SLOT_WIDTH }}>
          {/* Sticky time header row */}
          <div className="sticky top-0 z-20 bg-[#080c12] border-b border-white/10 flex" style={{ paddingLeft: CHAN_WIDTH }}>
            {/* "NOW" indicator tick */}
            <div className="relative flex w-full">
              {slots.map((s, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 border-l border-white/8 px-3 py-2"
                  style={{ width: SLOT_WIDTH }}
                >
                  <p className="text-[11px] font-bold text-white/60">{formatHour(new Date(s * 1000))}</p>
                  <p className="text-[9px] text-white/25">{formatDayShort(new Date(s * 1000))}</p>
                </div>
              ))}
              {/* Red NOW line in header */}
              {nowOffset >= 0 && nowOffset < slots.length * SLOT_WIDTH && (
                <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                  style={{ left: nowOffset }} />
              )}
            </div>
          </div>

          {/* Channel rows */}
          {loadingChans ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filteredChans.length === 0 ? (
            <p className="text-center text-white/30 py-20 text-sm">No channels found.</p>
          ) : (
            filteredChans.map(ch => (
              <ChannelRow
                key={ch.stream_id}
                channel={ch}
                epg={epgMap[ch.stream_id] || []}
                windowStart={windowStart}
                onWatch={watchChannel}
                onSelectProgram={(prog, channel) => setSelectedProg({ prog, channel })}
              />
            ))
          )}
        </div>
      </div>

      {/* Program detail drawer */}
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