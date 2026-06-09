import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/use-store';
import { useXtream } from '@/lib/use-xtream';
import { setState, vodUrl } from '@/lib/iptv-store';
import CategoryGrid from '@/components/iptv/CategoryGrid';
import MediaCard from '@/components/iptv/MediaCard';
import SearchInput from '@/components/iptv/SearchInput';
import SkeletonGrid from '@/components/iptv/SkeletonGrid';
import { Film, ChevronLeft } from 'lucide-react';

export default function MoviesSection() {
  const { credentials } = useStore();
  const { loading, error, fetchAction } = useXtream(credentials);

  const [categories, setCategories] = useState([]);
  const [vods, setVods] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [loadingVods, setLoadingVods] = useState(false);

  useEffect(() => {
    fetchAction('get_vod_categories').then(data => { if (data) setCategories(data); });
  }, [fetchAction]);

  const selectCategory = async (cat) => {
    setSelectedCat(cat);
    setSearch('');
    setLoadingVods(true);
    const data = await fetchAction('get_vod_streams', { category_id: cat.category_id });
    if (data) setVods(data);
    setLoadingVods(false);
  };

  const back = () => { setSelectedCat(null); setVods([]); setSearch(''); };

  const displayedCats = useMemo(() =>
    search ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase())) : categories,
    [categories, search]);

  const displayedVods = useMemo(() =>
    search ? vods.filter(v => v.name?.toLowerCase().includes(search.toLowerCase())) : vods,
    [vods, search]);

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {selectedCat && (
            <button onClick={back}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              {selectedCat ? selectedCat.category_name : 'Movies (VOD)'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedCat
                ? `${displayedVods.length} movie${displayedVods.length !== 1 ? 's' : ''}`
                : `${displayedCats.length} categor${displayedCats.length !== 1 ? 'ies' : 'y'}`}
            </p>
          </div>
        </div>
        <div className="w-64">
          <SearchInput value={search} onChange={setSearch}
            placeholder={selectedCat ? 'Search movies…' : 'Search categories…'} />
        </div>
      </div>

      {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">{error}</div>}

      {!selectedCat ? (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[72px] bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <CategoryGrid categories={displayedCats} onSelect={selectCategory} icon={Film} />
        )
      ) : loadingVods ? (
        <SkeletonGrid count={12} aspect="video" />
      ) : (
        <>
          {displayedVods.length === 0 && <p className="text-center text-muted-foreground py-20 text-sm">No movies found.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
            {displayedVods.map(v => (
              <MediaCard key={v.stream_id} item={v} type="movie"
                onPlay={() => setState({ player: { src: vodUrl(credentials, v.stream_id), title: v.name, type: 'vod' } })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}