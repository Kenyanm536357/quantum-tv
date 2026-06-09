import React, { useState, useEffect, useMemo } from 'react';
import { useIPTV } from '@/lib/IPTVContext';
import CategoryFolder from '@/components/iptv/CategoryFolder';
import ChannelItem from '@/components/iptv/ChannelItem';
import SearchBar from '@/components/iptv/SearchBar';
import LoadingGrid from '@/components/iptv/LoadingGrid';
import HLSPlayer from '@/components/iptv/HLSPlayer';
import { ChevronLeft, Film } from 'lucide-react';

export default function Movies() {
  const { fetchApi, streamUrl } = useIPTV();
  const [categories, setCategories] = useState([]);
  const [vods, setVods] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingVods, setLoadingVods] = useState(false);
  const [search, setSearch] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);

  useEffect(() => {
    setLoadingCats(true);
    fetchApi('get_vod_categories')
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, [fetchApi]);

  const loadVods = async (cat) => {
    setSelectedCategory(cat);
    setSearch('');
    setLoadingVods(true);
    try {
      const data = await fetchApi('get_vod_streams', { category_id: cat.category_id });
      setVods(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVods(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return vods;
    return vods.filter(v => v.name?.toLowerCase().includes(search.toLowerCase()));
  }, [vods, search]);

  const filteredCats = useMemo(() => {
    if (!search) return categories;
    return categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()));
  }, [categories, search]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {selectedCategory && (
            <button
              onClick={() => { setSelectedCategory(null); setVods([]); setSearch(''); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              {selectedCategory ? selectedCategory.category_name : 'Movies (VOD)'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedCategory ? `${filtered.length} movie${filtered.length !== 1 ? 's' : ''}` : `${categories.length} categories`}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={selectedCategory ? 'Search movies...' : 'Search categories...'}
          />
        </div>
      </div>

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
                count={parseInt(cat.num || 0)}
                type="movie"
                delay={i * 0.02}
                onClick={() => loadVods(cat)}
              />
            ))}
            {filteredCats.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
                No categories found
              </div>
            )}
          </div>
        )
      ) : loadingVods ? (
        <LoadingGrid count={12} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((v, i) => (
            <ChannelItem
              key={v.stream_id}
              item={{ ...v, stream_icon: v.stream_icon || v.cover }}
              type="movie"
              delay={i * 0.015}
              onClick={() => setNowPlaying({
                src: streamUrl(v.stream_id, 'movie'),
                title: v.name,
                category: selectedCategory?.category_name
              })}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground text-sm">
              No movies found
            </div>
          )}
        </div>
      )}

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