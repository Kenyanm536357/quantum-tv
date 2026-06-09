import React from 'react';
import { Play, Radio, Film, Clapperboard } from 'lucide-react';
import { motion } from 'framer-motion';

const typeIcon = { live: Radio, movie: Film, series: Clapperboard };

export default function ChannelItem({ item, type = 'live', onClick, delay = 0 }) {
  const Icon = typeIcon[type] || Radio;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      onClick={onClick}
      className="group w-full bg-card border border-border hover:border-primary/40 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 text-left"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-secondary flex items-center justify-center overflow-hidden">
        {item.stream_icon || item.cover ? (
          <img
            src={item.stream_icon || item.cover}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : null}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <Icon className="w-8 h-8 text-white/30" />
        </div>
        {/* Play overlay */}
        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
            <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
          </div>
        </div>
        {/* Live badge */}
        {type === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-destructive/90 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold text-white">LIVE</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
        {item.rating && (
          <p className="text-[11px] text-muted-foreground mt-0.5">★ {item.rating}</p>
        )}
      </div>
    </motion.button>
  );
}