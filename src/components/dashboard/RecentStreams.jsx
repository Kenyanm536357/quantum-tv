import React from 'react';
import { Play, Eye, Clock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const streams = [
  {
    title: 'Friday Night Special — Live Q&A',
    date: 'May 12, 2026',
    duration: '3h 24m',
    viewers: '24.1K',
    peakViewers: '31.2K',
    thumbnail: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=300&q=80',
  },
  {
    title: 'Tech Talk: Future of AI Streaming',
    date: 'May 10, 2026',
    duration: '2h 48m',
    viewers: '18.7K',
    peakViewers: '22.4K',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&q=80',
  },
  {
    title: 'Community Game Night',
    date: 'May 8, 2026',
    duration: '4h 12m',
    viewers: '32.4K',
    peakViewers: '41.8K',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&q=80',
  },
  {
    title: 'Creative Workshop: Overlay Design',
    date: 'May 6, 2026',
    duration: '1h 56m',
    viewers: '9.8K',
    peakViewers: '12.1K',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300&q=80',
  },
];

export default function RecentStreams() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground">Recent Streams</h3>
        <button className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">View All</button>
      </div>
      <div className="space-y-3">
        {streams.map((stream, i) => (
          <div
            key={i}
            className="flex gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-all cursor-pointer group"
          >
            <div className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
              <img src={stream.thumbnail} alt={stream.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{stream.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{stream.date}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />{stream.duration}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Eye className="w-3 h-3" />{stream.viewers}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <TrendingUp className="w-3 h-3" />{stream.peakViewers}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}