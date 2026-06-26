import React from 'react';
import { ChevronRight } from 'lucide-react';
import PullToRefresh from './PullToRefresh';
import { cleanName } from '@/lib/clean-name';

export default function CategoryGrid({ categories, onSelect, icon: Icon, onRefresh }) {
  if (!categories.length) {
    return <p className="text-center text-muted-foreground py-20 text-sm">No categories found.</p>;
  }
  return (
    <PullToRefresh onRefresh={onRefresh}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
        {categories.map((cat, i) => (
          <button key={cat.category_id || i}
            onClick={() => onSelect(cat)}
            className="group flex items-center gap-4 p-5 bg-card border border-border hover:border-primary/40 rounded-2xl transition-all hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5 text-left select-none">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground truncate">{cleanName(cat.category_name)}</p>
              {cat.num && <p className="text-xs text-muted-foreground mt-0.5">{cat.num} items</p>}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    </PullToRefresh>
  );
}