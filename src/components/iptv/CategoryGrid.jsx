import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function CategoryGrid({ categories, onSelect, icon: Icon }) {
  if (!categories.length) {
    return <p className="text-center text-muted-foreground py-20 text-sm">No categories found.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {categories.map((cat, i) => (
        <button key={cat.category_id || i}
          onClick={() => onSelect(cat)}
          className="group flex items-center gap-3.5 p-4 bg-card border border-border hover:border-primary/30 rounded-xl transition-all hover:bg-primary/5 text-left">
          <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{cat.category_name}</p>
            {cat.num && <p className="text-[11px] text-muted-foreground">{cat.num} items</p>}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}