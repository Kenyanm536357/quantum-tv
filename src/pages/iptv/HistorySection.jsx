import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/use-store';
import { setState } from '@/lib/iptv-store';
import { getHistory, removeFromHistory, clearHistory } from '@/lib/user-data';
import { usePlaylist } from '@/lib/use-playlist';
import { History, Trash2, Play, Radio, Film, Clapperboard, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const cleanName = (name = '') => name.replace(/;/g, '').replace(/\s{2,}/g, ' ').trim();
const TYPE_ICON = { live: Radio, movie: Film, series: Clapperboard };

export default function HistorySection() {
  const { credentials } = useStore();
  const { resolveStreamUrl } = usePlaylist(credentials);
  const [history, setHistory] = useState([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setHistory(getHistory(credentials));
  }, [credentials]);

  const handlePlay = async (item) => {
    const src = await resolveStreamUrl(item, item.streamType);
    setState({ player: { src, title: cleanName(item.name), type: item.streamType, resumeAt: item.progress || 0 } });
  };

  const handleRemove = (item) => {
    const updated = removeFromHistory(credentials, item);
    setHistory(updated);
  };

  const handleClearAll = () => {
    clearHistory(credentials);
    setHistory([]);
    setClearing(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Watch History
          </h2>
          <p className="text-xs text-muted-foreground">{history.length} items</p>
        </div>
        {history.length > 0 && (
          clearing ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Clear all?</span>
              <button onClick={handleClearAll} className="text-destructive font-semibold hover:underline">Yes</button>
              <button onClick={() => setClearing(false)} className="text-muted-foreground hover:underline">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setClearing(true)}
              className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
              <Trash2 className="w-3.5 h-3.5" /> Clear history
            </button>
          )
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20">
          <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nothing watched yet. Start watching to build your history.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(item => {
            const Icon = TYPE_ICON[item.streamType] || Radio;
            const thumb = item.stream_icon || item.cover || item.movie_image;
            const pct = item.progress && item.progress > 0 ? Math.min(100, Math.round(item.progress * 100)) : 0;
            return (
              <div key={item.id + item.watched_at} className="group flex items-center gap-3 bg-card border border-border hover:border-primary/30 rounded-xl p-3 transition-all">
                {/* Thumbnail */}
                <div className="relative w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={cleanName(item.name)} className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : <Icon className="w-6 h-6 text-muted-foreground" />}
                  {pct > 0 && pct < 100 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{cleanName(item.name)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.watched_at ? formatDistanceToNow(new Date(item.watched_at), { addSuffix: true }) : ''}
                    {pct > 0 && pct < 100 ? ` · ${pct}% watched` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handlePlay(item)}
                    className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors"
                    title={pct > 0 ? 'Resume' : 'Play'}>
                    <Play className="w-4 h-4 fill-primary" />
                  </button>
                  <button onClick={() => handleRemove(item)}
                    className="w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}