import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/use-store';
import { setState } from '@/lib/iptv-store';
import { getBookmarks, removeBookmark } from '@/lib/user-data';
import { usePlaylist } from '@/lib/use-playlist';
import { Bookmark, Trash2, Play, Radio, Film, Clapperboard, Search } from 'lucide-react';

const cleanName = (name = '') => name.replace(/;/g, '').replace(/\s{2,}/g, ' ').trim();
const TYPE_ICON = { live: Radio, movie: Film, series: Clapperboard };
const TYPE_LABEL = { live: 'Live', movie: 'Movie', series: 'Series' };

export default function BookmarksSection() {
  const { credentials } = useStore();
  const { resolveStreamUrl } = usePlaylist(credentials);
  const [bookmarks, setBookmarks] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setBookmarks(getBookmarks(credentials));
  }, [credentials]);

  const handlePlay = async (item) => {
    const src = await resolveStreamUrl(item, item.streamType);
    setState({ player: { src, title: cleanName(item.name), type: item.streamType } });
  };

  const handleRemove = (item) => {
    const updated = removeBookmark(credentials, item);
    setBookmarks(updated);
  };

  const filtered = bookmarks.filter(b => {
    const matchName = cleanName(b.name).toLowerCase().includes(search.toLowerCase());
    const matchType = filter === 'all' || b.streamType === filter;
    return matchName && matchType;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" /> My Bookmarks
          </h2>
          <p className="text-xs text-muted-foreground">{bookmarks.length} saved</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'live', 'movie', 'series'].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t === 'all' ? 'All' : TYPE_LABEL[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bookmarks…"
          className="w-full bg-secondary border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-all" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{bookmarks.length === 0 ? 'No bookmarks yet. Tap the bookmark icon on any channel or movie.' : 'No results.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(item => {
            const Icon = TYPE_ICON[item.streamType] || Radio;
            const thumb = item.stream_icon || item.cover || item.movie_image;
            return (
              <div key={item.id} className="group flex items-center gap-3 bg-card border border-border hover:border-primary/30 rounded-xl p-3 transition-all">
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {thumb ? (
                    <img src={thumb} alt={cleanName(item.name)} className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : <Icon className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{cleanName(item.name)}</p>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{TYPE_LABEL[item.streamType]}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handlePlay(item)}
                    className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <Play className="w-4 h-4 fill-primary" />
                  </button>
                  <button onClick={() => handleRemove(item)}
                    className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors">
                    <Trash2 className="w-4 h-4" />
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