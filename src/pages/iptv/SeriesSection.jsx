import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/use-store';
import { useXtream } from '@/lib/use-xtream';
import { setState, episodeUrl } from '@/lib/iptv-store';
import CategoryGrid from '@/components/iptv/CategoryGrid';
import SearchInput from '@/components/iptv/SearchInput';
import SkeletonGrid from '@/components/iptv/SkeletonGrid';
import { Clapperboard, ChevronLeft, Play, Star } from 'lucide-react';

export default function SeriesSection() {
  const { credentials } = useStore();
  const { loading, error, fetchAction } = useXtream(credentials);

  const [categories, setCategories] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [episodes, setEpisodes] = useState({});
  const [seriesInfo, setSeriesInfo] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [search, setSearch] = useState('');
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingEps, setLoadingEps] = useState(false);

  useEffect(() => {
    fetchAction('get_series_categories').then(data => { if (data) setCategories(data); });
  }, [fetchAction]);

  const selectCat = async (cat) => {
    setSelectedCat(cat);
    setSelectedSeries(null);
    setSearch('');
    setLoadingSeries(true);
    const data = await fetchAction('get_series', { category_id: cat.category_id });
    if (data) setSeriesList(data);
    setLoadingSeries(false);
  };

  const selectSeries = async (series) => {
    setSelectedSeries(series);
    setLoadingEps(true);
    const data = await fetchAction('get_series_info', { series_id: series.series_id });
    if (data) { setEpisodes(data.episodes || {}); setSeriesInfo(data.info || null); }
    setLoadingEps(false);
  };

  const allEpisodes = useMemo(() => Object.values(episodes).flat(), [episodes]);

  const filteredSeries = useMemo(() =>
    search ? seriesList.filter(s => s.name?.toLowerCase().includes(search.toLowerCase())) : seriesList,
    [seriesList, search]);

  const filteredCats = useMemo(() =>
    search ? categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase())) : categories,
    [categories, search]);

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setSelectedCat(null); setSelectedSeries(null); setSeriesList([]); setSearch(''); }}
            className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${!selectedCat ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Clapperboard className="w-5 h-5 text-primary" /> TV Series
          </button>
          {selectedCat && (
            <>
              <span className="text-muted-foreground">/</span>
              <button
                onClick={() => { setSelectedSeries(null); setSearch(''); }}
                className={`text-sm font-medium transition-colors ${!selectedSeries ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {selectedCat.category_name}
              </button>
            </>
          )}
          {selectedSeries && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium text-foreground">{selectedSeries.name}</span>
            </>
          )}
        </div>
        {!selectedSeries && (
          <div className="w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Search…" />
          </div>
        )}
      </div>

      {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">{error}</div>}

      {/* Categories */}
      {!selectedCat && (
        loading
          ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[72px] bg-card border border-border rounded-xl animate-pulse" />)}</div>
          : <CategoryGrid categories={filteredCats} onSelect={selectCat} icon={Clapperboard} />
      )}

      {/* Series grid */}
      {selectedCat && !selectedSeries && (
        loadingSeries
          ? <SkeletonGrid count={12} aspect="poster" />
          : <>
              {filteredSeries.length === 0 && <p className="text-center text-muted-foreground py-20 text-sm">No series found.</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                {filteredSeries.map(s => (
                  <button key={s.series_id} onClick={() => selectSeries(s)}
                    className="group text-left bg-card border border-border hover:border-primary/40 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5">
                    <div className="relative aspect-[2/3] bg-muted overflow-hidden">
                      {s.cover && (
                        <img src={s.cover} alt={s.name} loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={e => e.target.style.display = 'none'} />
                      )}
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center">
                          <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                      {s.rating && s.rating !== '0' && (
                        <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />{s.rating}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
      )}

      {/* Episodes */}
      {selectedSeries && (
        <div className="space-y-4">
          {/* Series info card */}
          <div className="flex gap-4 bg-card border border-border rounded-xl p-4">
            {(seriesInfo?.cover || selectedSeries.cover) && (
              <img src={seriesInfo?.cover || selectedSeries.cover} alt={selectedSeries.name}
                className="w-20 rounded-lg object-cover aspect-[2/3] flex-shrink-0"
                onError={e => e.target.style.display = 'none'} />
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-foreground">{selectedSeries.name}</h3>
              {(seriesInfo?.rating || selectedSeries.rating) && (
                <p className="text-sm text-amber-400 mt-0.5">★ {seriesInfo?.rating || selectedSeries.rating}</p>
              )}
              {seriesInfo?.plot && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{seriesInfo.plot}</p>}
            </div>
          </div>

          {/* Episode list */}
          {loadingEps ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{allEpisodes.length} Episode{allEpisodes.length !== 1 ? 's' : ''}</p>
              {allEpisodes.map(ep => (
                <button key={ep.id}
                  onClick={() => setState({ player: { src: episodeUrl(credentials, ep.id), title: ep.title || `Episode ${ep.episode_num}`, type: 'series' } })}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border hover:border-primary/30 rounded-xl transition-all hover:bg-primary/5 text-left group">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Play className="w-4 h-4 text-primary fill-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ep.title || `Episode ${ep.episode_num}`}</p>
                    <p className="text-[11px] text-muted-foreground">Season {ep.season} · Episode {ep.episode_num}</p>
                  </div>
                </button>
              ))}
              {allEpisodes.length === 0 && <p className="text-center text-muted-foreground py-10 text-sm">No episodes available.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}