import React from 'react';
import { Radio, Upload, Calendar, Gift, FileText, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

const actions = [
  { icon: Radio, label: 'Go Live', desc: 'Start streaming', color: 'bg-primary/10 text-primary hover:bg-primary/20' },
  { icon: Upload, label: 'Upload', desc: 'New content', color: 'bg-accent/10 text-accent hover:bg-accent/20' },
  { icon: Calendar, label: 'Schedule', desc: 'Plan stream', color: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' },
  { icon: Gift, label: 'Giveaway', desc: 'Engage fans', color: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' },
  { icon: FileText, label: 'Clip', desc: 'Create clip', color: 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20' },
  { icon: Bell, label: 'Alert', desc: 'Send alert', color: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20' },
];

export default function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${action.color}`}
          >
            <action.icon className="w-5 h-5" />
            <span className="text-[11px] font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}