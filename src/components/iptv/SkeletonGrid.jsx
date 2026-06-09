import React from 'react';

export default function SkeletonGrid({ count = 12, aspect = 'video' }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
          <div className={`bg-secondary ${aspect === 'poster' ? 'aspect-[2/3]' : 'aspect-video'}`} />
          <div className="p-3 space-y-1.5">
            <div className="h-3 bg-secondary rounded w-3/4" />
            <div className="h-2.5 bg-secondary rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}