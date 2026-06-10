import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/use-store';
import { usePlaylist } from '@/lib/use-playlist';
import { setState } from '@/lib/iptv-store';
import CategoryGrid from '@/components/iptv/CategoryGrid';
import MediaCard from '@/components/iptv/MediaCard';
import SearchInput from '@/components/iptv/SearchInput';
import SkeletonGrid from '@/components/iptv/SkeletonGrid';
import { Film, ChevronLeft, ArrowUpDown } from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'az',     label: 'A → Z' },
  { value: 'za',     label: 'Z → A' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

function sortItems(items, sort, nameKey = 'name', dateKey = 'added') {
  const arr = [...items];
  if (sort === 'az') return arr.sort((a, b) => (a[nameKey] || '').localeCompare(b[nameKey] || ''));
  if (sort === 'za') return arr.sort((a, b) => (b[nameKey] || '').localeCompare(a[nameKey] || ''));
  if (sort === 'newest') return arr.sort((a, b) => (Number(b[dateKey]) || 0) - (Number(a[dateKey]) || 0));
  if (sort === 'oldest') return arr.sort((a, b) => (Number(a[dateKey]) || 0) - (Number(b[dateKey]) || 0));
  return arr;
}

function SortSelect({ value, onChange }) {
  return (
    <div className="relative">
      <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground appearance-none cursor-pointer focus:outline-none focus:border-primary/50"
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function MoviesSection() {
  const { credentials } = useStore();
  const { loading, error, fetchAction, resolveStreamUrl } = usePlaylist(credentials);

  const [categories, setCategories] = useState([]);
  const [vods, setVods] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('az');
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

  const displayedCats = useMemo(() => {
    const filtered = search
      ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()))
      : categories;
    return sortItems(filtered, sort, 'category_name');
  }, [categories, search, sort]);

  const displayedVods = useMemo(() => {
    const filtered = search
      ? vods.filter(v => v.name?.toLowerCase().includes(search.toLowerCase()))
      : vods;
    return sortItems(filtered, sort, 'name', 'added');
  }, [vods, search, sort]);

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
              {selectedCat ? selectedCat.category_name : 'Movies'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedCat
                ? `${displayedVods.length} movie${displayedVods.length !== 1 ? 's' : ''}`
                : `${displayedCats.length} categor${displayedCats.length !== 1 ? 'ies' : 'y'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SortSelect value={sort} onChange={setSort} />
          <div className="w-52">
            <SearchInput value={search} onChange={setSearch}
              placeholder={selectedCat ? 'Search movies…' : 'Search categories…'} />
          </div>
        </div>
      </div>

      {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">{error}</div>}

      {!selectedCat ? (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[88px] bg-card border border-border rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <CategoryGrid categories={displayedCats} onSelect={selectCategory} icon={Film} />
        )
      ) : loadingVods ? (
        <SkeletonGrid count={12} aspect="video" />
      ) : (
        <>
          {displayedVods.length === 0 && <p className="text-center text-muted-foreground py-20 text-sm">No movies found.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-5">
            {displayedVods.map(v => (
              <MediaCard key={v.stream_id} item={v} type="movie"
                onPlay={async () => {
                  const src = await resolveStreamUrl(v, 'vod');
                  setState({ player: { src, title: v.name, type: 'vod' } });
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}