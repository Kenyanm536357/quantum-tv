import React from 'react';
import { Play, Radio, Film, Clapperboard } from 'lucide-react';

const TYPE_ICON = { live: Radio, movie: Film, series: Clapperboard };
const FALLBACK = { live: 'LIVE', movie: 'MOVIE', series: 'SERIES' };
const cleanName = (name = '') => name.replace(/;/g, '').replace(/\s{2,}/g, ' ').trim();

export default function MediaCard({ item, type = 'live', aspect = 'video', onPlay }) {
  const Icon = TYPE_ICON[type] || Radio;
  const thumb = item.stream_icon || item.cover || item.movie_image || null;

  return (
    <button
      onClick={onPlay}
      style={{ minHeight: 44 }}
      className="group w-full bg-card border border-border hover:border-primary/40 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-primary/5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 select-none"
    >
      {/* Thumbnail */}
      <div className={`relative bg-muted flex items-center justify-center overflow-hidden ${aspect === 'poster' ? 'aspect-[2/3]' : 'aspect-video'}`}>
        {thumb && (
          <img src={thumb} alt={item.name} loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        {/* Fallback icon */}
        <Icon className="w-8 h-8 text-muted-foreground/30 relative z-[1]" />

        {/* Hover play */}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-[2]">
          <div className="w-11 h-11 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
          </div>
        </div>

        {/* LIVE badge */}
        {type === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-destructive px-2 py-0.5 rounded-full z-[3]">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold text-white leading-none">LIVE</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[13px] font-medium text-foreground truncate leading-snug">{cleanName(item.name)}</p>
        {item.rating && item.rating !== '0' && (
          <p className="text-[11px] text-amber-400 mt-0.5">★ {item.rating}</p>
        )}
      </div>
    </button>
  );
}