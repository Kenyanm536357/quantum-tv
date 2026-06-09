import React from 'react';
import { Folder, ChevronRight, Tv, Film, Clapperboard } from 'lucide-react';
import { motion } from 'framer-motion';

const typeIcon = { live: Tv, movie: Film, series: Clapperboard };

export default function CategoryFolder({ category, count, type = 'live', onClick, delay = 0 }) {
  const Icon = typeIcon[type] || Folder;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay }}
      onClick={onClick}
      className="group w-full bg-card border border-border hover:border-primary/30 rounded-xl p-4 flex items-center gap-3 transition-all duration-200 hover:bg-primary/5 text-left"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{category}</p>
        <p className="text-[11px] text-muted-foreground">{count} {count === 1 ? 'item' : 'items'}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </motion.button>
  );
}