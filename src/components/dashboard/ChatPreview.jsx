import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const messages = [
  { user: 'NeonRider', color: 'text-primary', msg: 'This stream is fire! 🔥🔥' },
  { user: 'PixelQueen', color: 'text-pink-400', msg: 'Love the new overlay design!' },
  { user: 'CyberWolf', color: 'text-emerald-400', msg: 'Can you play that track again?' },
  { user: 'StarGazer', color: 'text-amber-400', msg: 'Just subscribed! Been watching for months' },
  { user: 'ThunderBolt', color: 'text-accent', msg: 'GG everyone! Great plays 👏' },
  { user: 'LunaStream', color: 'text-sky-400', msg: 'Hello from Tokyo! 🇯🇵' },
  { user: 'BlazeMaster', color: 'text-red-400', msg: 'Who else is staying up late for this?' },
];

export default function ChatPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
      className="bg-card border border-border rounded-xl flex flex-col"
    >
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Live Chat</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">2,341 chatting</span>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-2.5 max-h-64 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className="text-sm">
            <span className={`font-medium ${m.color}`}>{m.user}</span>
            <span className="text-muted-foreground ml-1.5">{m.msg}</span>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          placeholder="Send a message..."
          className="bg-secondary border-0 text-sm h-9"
        />
        <Button size="sm" className="bg-primary hover:bg-primary/90 h-9 px-3">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}