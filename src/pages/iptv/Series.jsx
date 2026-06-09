import React, { useState, useEffect, useMemo } from 'react';
import { useIPTV } from '@/lib/IPTVContext';
import CategoryFolder from '@/components/iptv/CategoryFolder';
import SearchBar from '@/components/iptv/SearchBar';
import HLSPlayer from '@/components/iptv/HLSPlayer';
import { ChevronLeft, Clapperboard, Play, Star } from 'lucide-react';
import { motion } from 'framer-motion';

function SeriesCard({ item, onClick, delay = 0 }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      onClick={onClick}
      className="group w-full bg-card border border-border hover:border-primary/40 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 text-left"
    >
      <div className="relative aspect-[2/3] bg-secondary flex items-center justify-center overflow-hidden">
        {item.cover ? (
          <img src={item.cover} alt={item.name} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
        ) : (
          <Clapperboard className="w-10 h-10 text-muted-foreground/30" />
        )}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
        {item.rating && (
          <p className="flex items-center gap-0.5 text-[10px] text-amber-400 mt-0.5">
            <Star className="w-2.5 h-2.5 fill-amber-400" /> {item.rating}
          </p>
        )}
      </div>
    </motion.button>
  );
}

function EpisodeItem({ ep, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-card border border-border hover:border-primary/30 rounded-xl transition-all hover:bg-primary/5 text-left group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <Play className="w-4 h-4 text-primary fill-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {ep.title || `Episode ${ep.episode_num}`}
        </p>
        <p className="text-[11px] text-muted-foreground">Season {ep.season} · Ep {ep.episode_num}</p>
      </div>
    </button>
  );
}

export default function Series() {
  const { fetchApi, streamUrl } = useIPTV();
  const [categories, setCategories] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState({});
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingEps, setLoadingEps] = useState(false);
  const [search, setSearch] = useState('');
  const [nowPlaying, setNowPlaying] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchApi('get_series_categories')
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchApi]);

  const loadSeries = async (cat) => {
    setSelectedCat(cat);
    setSelectedSeries(null);
    setSearch('');
    setLoadingSeries(true);
    try {
      const data = await fetchApi('get_series', { category_id: cat.category_id });
      setSeriesList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSeries(false);
    }
  };

  const loadEpisodes = async (series) => {
    setSelectedSeries(series);
    setLoadingEps(true);
    try {
      const data = await fetchApi('get_series_info', { series_id: series.series_id });
      setEpisodes(data.episodes || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEps(false);
    }
  };

  const allEpisodes = useMemo(() => {
    return Object.values(episodes).flat();
  }, [episodes]);

  const filteredSeries = useMemo(() => {
    if (!search) return seriesList;
    return seriesList.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
  }, [seriesList, search]);

  const filteredCats = useMemo(() => {
    if (!search) return categories;
    return categories.filter(c => c.category_name?.toLowerCase().includes(search.toLowerCase()));
  }, [categories, search]);

  const breadcrumbs = [
    { label: 'TV Series', onClick: () => { setSelectedCat(null); setSelectedSeries(null); setSeriesList([]); setSearch(''); } },
    selectedCat && { label: selectedCat.category_name, onClick: () => { setSelectedSeries(null); setSearch(''); } },
    selectedSeries && { label: selectedSeries.name, onClick: null },
  ].filter(Boolean);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                onClick={b.onClick || undefined}
                className={`text-sm font-medium transition-colors ${b.onClick ? 'text-muted-foreground hover:text-foreground' : 'text-foreground'}`}
                disabled={!b.onClick}
              >
                {i === 0 && <Clapperboard className="w-4 h-4 text-primary inline mr-1.5 mb-0.5" />}
                {b.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        {!selectedSeries && (
          <div className="w-full sm:w-64">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." />
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedCat && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCats.map((cat, i) => (
              <CategoryFolder key={cat.category_id} category={cat.category_name} count={parseInt(cat.num || 0)} type="series" delay={i * 0.02} onClick={() => loadSeries(cat)} />
            ))}
          </div>
        )
      )}

      {selectedCat && !selectedSeries && (
        loadingSeries ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-secondary" />
                <div className="p-2 space-y-1"><div className="h-2.5 bg-secondary rounded w-3/4" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
            {filteredSeries.map((s, i) => (
              <SeriesCard key={s.series_id} item={s} delay={i * 0.015} onClick={() => loadEpisodes(s)} />
            ))}
            {filteredSeries.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground text-sm">No series found</div>}
          </div>
        )
      )}

      {selectedSeries && (
        <div className="space-y-4">
          {/* Series Info */}
          <div className="flex gap-4 bg-card border border-border rounded-xl p-4">
            {selectedSeries.cover && (
              <img src={selectedSeries.cover} alt={selectedSeries.name} className="w-20 rounded-lg object-cover aspect-[2/3]" onError={e => e.target.style.display = 'none'} />
            )}
            <div>
              <h3 className="font-bold text-foreground">{selectedSeries.name}</h3>
              {selectedSeries.rating && <p className="text-sm text-amber-400 mt-0.5">★ {selectedSeries.rating}</p>}
              {selectedSeries.plot && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{selectedSeries.plot}</p>}
            </div>
          </div>
          {/* Episodes */}
          {loadingEps ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{allEpisodes.length} Episode{allEpisodes.length !== 1 ? 's' : ''}</p>
              {allEpisodes.map((ep, i) => (
                <EpisodeItem
                  key={ep.id}
                  ep={ep}
                  onClick={() => setNowPlaying({ src: streamUrl(ep.id, 'series'), title: ep.title || `Episode ${ep.episode_num}`, category: selectedSeries.name })}
                />
              ))}
              {allEpisodes.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">No episodes available</div>}
            </div>
          )}
        </div>
      )}

      {nowPlaying && <HLSPlayer src={nowPlaying.src} title={nowPlaying.title} category={nowPlaying.category} onClose={() => setNowPlaying(null)} />}
    </div>
  );
}