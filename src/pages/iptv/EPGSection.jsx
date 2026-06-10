import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/use-store';
import { usePlaylist } from '@/lib/use-playlist';
import { setState, apiUrl } from '@/lib/iptv-store';
import { Tv2, ChevronLeft, Clock, Calendar, Loader2, Radio } from 'lucide-react';
import SearchInput from '@/components/iptv/SearchInput';

const cleanName = (name = '') => name.replace(/;/g, '').replace(/\s{2,}/g, ' ').trim();

function formatTime(unix) {
  if (!unix) return '';
  const d = new Date(Number(unix) * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(unix) {
  if (!unix) return '';
  return new Date(Number(unix) * 1000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function progressPercent(start, stop) {
  const now = Date.now() / 1000;
  if (now < start) return 0;
  if (now > stop) return 100;
  return Math.round(((now - start) / (stop - start)) * 100);
}

export default function EPGSection() {
  const { credentials } = useStore();
  const { fetchAction, resolveStreamUrl } = usePlaylist(credentials);

  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [epgData, setEpgData] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingEpg, setLoadingEpg] = useState(false);
  const [error, setError] = useState(null);

  // Load categories
  useEffect(() => {
    setLoadingCats(true);
    fetchAction('get_live_categories').then(data => {
      if (data) setCategories(data);
      setLoadingCats(false);
    });
  }, [fetchAction]);

  const selectCategory = async (cat) => {
    setSelectedCat(cat);
    setSelectedChannel(null);
    setSearch('');
    setEpgData([]);
    setLoadingChannels(true);
    const data = await fetchAction('get_live_streams', { category_id: cat.category_id });
    if (data) setChannels(data);
    setLoadingChannels(false);
  };

  const selectChannel = async (ch) => {
    setSelectedChannel(ch);
    setEpgData([]);
    setLoadingEpg(true);
    setError(null);
    try {
      const url = apiUrl(credentials, 'get_short_epg', { stream_id: ch.stream_id, limit: 20 });
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEpgData(json?.epg_listings ?? []);
    } catch (e) {
      setError('EPG data not available for this channel');
    } finally {
      setLoadingEpg(false);
    }
  };

  const filteredChannels = channels.filter(c =>
    cleanName(c.name).toLowerCase().includes(search.toLowerCase())
  );

  const filteredCats = categories.filter(c =>
    (c.category_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const back = () => {
    if (selectedChannel) { setSelectedChannel(null); setEpgData([]); }
    else { setSelectedCat(null); setChannels([]); setSearch(''); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {(selectedCat || selectedChannel) && (
            <button onClick={back} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Tv2 className="w-5 h-5 text-primary" />
              {selectedChannel
                ? cleanName(selectedChannel.name)
                : selectedCat
                  ? cleanName(selectedCat.category_name)
                  : 'TV Guide (EPG)'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedChannel
                ? 'Programme Schedule'
                : selectedCat
                  ? `${filteredChannels.length} channels`
                  : 'Select a channel to view schedule'}
            </p>
          </div>
        </div>
        {!selectedChannel && (
          <div className="w-52">
            <SearchInput value={search} onChange={setSearch}
              placeholder={selectedCat ? 'Search channels…' : 'Search categories…'} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Categories */}
      {!selectedCat && (
        loadingCats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCats.map((cat, i) => (
              <button key={cat.category_id || i} onClick={() => selectCategory(cat)}
                className="group flex items-center gap-3.5 p-4 bg-card border border-border hover:border-primary/30 rounded-xl transition-all hover:bg-primary/5 text-left">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0">
                  <Tv2 className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{cleanName(cat.category_name)}</p>
              </button>
            ))}
          </div>
        )
      )}

      {/* Channels */}
      {selectedCat && !selectedChannel && (
        loadingChannels ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredChannels.map(ch => (
              <button key={ch.stream_id} onClick={() => selectChannel(ch)}
                className="group flex items-center gap-3 p-3 bg-card border border-border hover:border-primary/30 rounded-xl transition-all hover:bg-primary/5 text-left">
                <div className="w-11 h-11 rounded-xl bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {ch.stream_icon ? (
                    <img src={ch.stream_icon} alt={cleanName(ch.name)} className="w-full h-full object-contain"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <Radio className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cleanName(ch.name)}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                    <span className="text-[10px] text-muted-foreground">LIVE</span>
                  </div>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const src = await resolveStreamUrl(ch, 'live');
                    setState({ player: { src, title: cleanName(ch.name), type: 'live' } });
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                >
                  Watch
                </button>
              </button>
            ))}
            {filteredChannels.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-20 text-sm">No channels found.</p>
            )}
          </div>
        )
      )}

      {/* EPG Schedule */}
      {selectedChannel && (
        <div className="space-y-3">
          {/* Watch Now CTA */}
          <button
            onClick={async () => {
              const src = await resolveStreamUrl(selectedChannel, 'live');
              setState({ player: { src, title: cleanName(selectedChannel.name), type: 'live' } });
            }}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors"
          >
            <Radio className="w-4 h-4" /> Watch Live Now
          </button>

          {loadingEpg ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : epgData.length === 0 && !error ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No programme guide available for this channel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Programme Schedule
              </p>
              {epgData.map((prog, i) => {
                const isNow = Date.now() / 1000 >= prog.start && Date.now() / 1000 < prog.stop;
                const pct = progressPercent(prog.start, prog.stop);
                const title = prog.title ? atob(prog.title) : 'Unknown Programme';
                const desc = prog.description ? atob(prog.description) : '';
                return (
                  <div key={i}
                    className={`p-4 rounded-xl border transition-all ${isNow ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isNow && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">NOW</span>
                          )}
                          <p className={`text-sm font-semibold truncate ${isNow ? 'text-primary' : 'text-foreground'}`}>{cleanName(title)}</p>
                        </div>
                        {desc && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{desc}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-foreground">{formatTime(prog.start)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(prog.start)}</p>
                      </div>
                    </div>
                    {isNow && (
                      <div className="mt-3">
                        <div className="h-1 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{pct}% complete</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}