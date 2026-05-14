import React, { useState, useEffect } from 'react';
import { Radio, Eye, Clock, MessageSquare, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function LiveStreamPanel() {
  const [elapsed, setElapsed] = useState(7432); // seconds

  useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Stream Preview */}
      <div className="relative aspect-video bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
        <img
          src="https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&q=80"
          alt="Stream preview"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        
        {/* Live Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-glow" />
            LIVE
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs">
            <Eye className="w-3 h-3" />
            12,847
          </div>
        </div>

        {/* Timer */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-mono">
          <Clock className="w-3 h-3" />
          {formatTime(elapsed)}
        </div>

        {/* Center Play Area */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/30 flex items-center justify-center">
            <Radio className="w-7 h-7 text-primary" />
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>2,341</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <Heart className="w-3.5 h-3.5" />
              <span>8,912</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Info */}
      <div className="p-5">
        <h3 className="font-semibold text-foreground mb-1">Late Night Gaming Marathon — Episode 47</h3>
        <p className="text-xs text-muted-foreground mb-4">Category: Gaming • Language: English</p>
        <div className="flex gap-2">
          <Button size="sm" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs">
            End Stream
          </Button>
          <Button size="sm" variant="secondary" className="text-xs">
            Stream Settings
          </Button>
        </div>
      </div>
    </motion.div>
  );
}