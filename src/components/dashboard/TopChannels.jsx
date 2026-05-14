import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

const channels = [
  { name: 'YouTube', viewers: 45, color: 'bg-red-500' },
  { name: 'Twitch', viewers: 30, color: 'bg-purple-500' },
  { name: 'TikTok', viewers: 15, color: 'bg-pink-500' },
  { name: 'Facebook', viewers: 10, color: 'bg-blue-500' },
];

export default function TopChannels() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <h3 className="font-semibold text-foreground mb-5">Platform Distribution</h3>
      <div className="space-y-4">
        {channels.map((ch) => (
          <div key={ch.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ch.color}`} />
                <span className="text-sm text-foreground">{ch.name}</span>
              </div>
              <span className="text-sm font-medium text-foreground">{ch.viewers}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${ch.color} transition-all duration-700`}
                style={{ width: `${ch.viewers}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}