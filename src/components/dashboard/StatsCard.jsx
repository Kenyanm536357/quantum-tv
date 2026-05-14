import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StatsCard({ title, value, change, changeLabel, icon: Icon, iconColor, delay = 0 }) {
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
          isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change)}%
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{changeLabel || title}</p>
    </motion.div>
  );
}