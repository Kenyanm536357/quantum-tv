import React, { useState, useEffect, useMemo } from 'react';
import { useIPTV } from '@/lib/IPTVContext';
import CategoryFolder from '@/components/iptv/CategoryFolder';
import ChannelItem from '@/components/iptv/ChannelItem';
import SearchBar from '@/components/iptv/SearchBar';
import LoadingGrid from '@/components/iptv/LoadingGrid';
import HLSPlayer from '@/components/iptv/HLSPlayer';
import { ChevronLeft, Tv } from 'lucide-react';

export default function LiveTV() {
  const { fetchApi, streamUrl } = useIPTV();
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [search, setSearch] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoadingCats(true);
    fetchApi('get_live_categories')
      .then(setCategories)
      .catch(e => setError(e.message))
      .finally(() => setLoadingCats(false));
  }, [fetchApi]);

  const loadChannels = async (cat) => {
    setSelectedCategory(cat);
    setSearch('');
    setLoadingChannels(true);
    try {
      const data = await fetchApi('get_live_streams', { category_id: cat.category_id });
      setChannels(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingChannels(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return channels;
    return channels.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
  }, [channels, search]);

  const filteredCats = useMemo(() => {
    if (!search) return categories;
    return categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()));
  }, [categories, search]);

  // Count map
  const countMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.category_id] = parseInt(c.num || 0); });
    return m;
  }, [categories]);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {selectedCategory && (
            <button
              onClick={() => { setSelectedCategory(null); setChannels([]); setSearch(''); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Tv className="w-5 h-5 text-primary" />
              {selectedCategory ? selectedCategory.category_name : 'Live TV'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedCategory
                ? `${filtered.length} channel${filtered.length !== 1 ? 's' : ''}`
                : `${categories.length} categories`}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={selectedCategory ? 'Search channels...' : 'Search categories...'}
          />
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {!selectedCategory ? (
        loadingCats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCats.map((cat, i) => (
              <CategoryFolder
                key={cat.category_id}
                category={cat.category_name}
                count={channels.filter(c => c.category_id === cat.category_id).length || parseInt(cat.num || 0)}
                type="live"
                delay={i * 0.02}
                onClick={() => loadChannels(cat)}
              />
            ))}
            {filteredCats.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                No categories found matching "{search}"
              </div>
            )}
          </div>
        )
      ) : loadingChannels ? (
        <LoadingGrid count={12} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((ch, i) => (
            <ChannelItem
              key={ch.stream_id}
              item={ch}
              type="live"
              delay={i * 0.015}
              onClick={() => setNowPlaying({
                src: streamUrl(ch.stream_id, 'live'),
                title: ch.name,
                category: selectedCategory?.category_name
              })}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
              No channels found matching "{search}"
            </div>
          )}
        </div>
      )}

      {/* Player */}
      {nowPlaying && (
        <HLSPlayer
          src={nowPlaying.src}
          title={nowPlaying.title}
          category={nowPlaying.category}
          onClose={() => setNowPlaying(null)}
        />
      )}
    </div>
  );
}