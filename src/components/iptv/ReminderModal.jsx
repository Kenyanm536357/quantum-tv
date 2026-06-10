import React, { useState } from 'react';
import { Bell, X, Clock } from 'lucide-react';
import { addReminder } from '@/lib/user-data';

const QUICK_OFFSETS = [
  { label: '5 min', ms: 5 * 60 * 1000 },
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
];

export default function ReminderModal({ item, streamType, credentials, onClose }) {
  const [mode, setMode] = useState('quick'); // 'quick' | 'custom'
  const [customTime, setCustomTime] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (remindAt) => {
    addReminder(credentials, item, streamType, remindAt);
    setSaved(true);
    setTimeout(onClose, 1200);
  };

  const handleQuick = (ms) => save(new Date(Date.now() + ms).toISOString());
  const handleCustom = () => {
    if (!customTime) return;
    save(new Date(customTime).toISOString());
  };

  const cleanName = (name = '') => name.replace(/;/g, '').trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <p className="font-bold text-sm">Set Reminder</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4 truncate">{cleanName(item?.name)}</p>

        {saved ? (
          <div className="text-center py-4">
            <Bell className="w-8 h-8 text-primary mx-auto mb-2 animate-bounce" />
            <p className="text-sm font-semibold text-primary">Reminder set!</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
              {['quick', 'custom'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${mode === m ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                  {m === 'quick' ? 'Quick' : 'Specific time'}
                </button>
              ))}
            </div>

            {mode === 'quick' ? (
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OFFSETS.map(o => (
                  <button key={o.label} onClick={() => handleQuick(o.ms)}
                    className="flex items-center justify-center gap-1.5 py-3 bg-secondary hover:bg-primary/10 hover:border-primary/30 border border-border rounded-xl text-sm font-medium transition-all">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <input type="datetime-local" value={customTime} onChange={e => setCustomTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-all" />
                <button onClick={handleCustom} disabled={!customTime}
                  className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                  Set Reminder
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}