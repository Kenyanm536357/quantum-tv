import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/use-store';
import { setState } from '@/lib/iptv-store';
import { getReminders, removeReminder, addReminder, markReminderFired, getDueReminders } from '@/lib/user-data';
import { usePlaylist } from '@/lib/use-playlist';
import { Bell, BellRing, Trash2, Play, Radio, Clock, Plus, CheckCircle } from 'lucide-react';
import { formatDistanceToNow, format, isPast } from 'date-fns';

const cleanName = (name = '') => name.replace(/;/g, '').replace(/\s{2,}/g, ' ').trim();

export default function RemindersSection() {
  const { credentials } = useStore();
  const { resolveStreamUrl } = usePlaylist(credentials);
  const [reminders, setReminders] = useState([]);
  const [firedQueue, setFiredQueue] = useState([]);
  const tickRef = useRef(null);

  const refresh = () => setReminders(getReminders(credentials));

  useEffect(() => {
    refresh();
    // Poll every 30s to detect due reminders
    tickRef.current = setInterval(() => {
      const due = getDueReminders(credentials);
      if (due.length > 0) {
        setFiredQueue(due);
        due.forEach(r => markReminderFired(credentials, r.id));
        refresh();
      }
    }, 30000);
    return () => clearInterval(tickRef.current);
  }, [credentials]);

  const handleRemove = (id) => {
    const updated = removeReminder(credentials, id);
    setReminders(updated);
  };

  const handlePlay = async (item, streamType) => {
    const src = await resolveStreamUrl(item, streamType);
    setState({ player: { src, title: cleanName(item.name), type: streamType } });
  };

  const dismissFired = (r) => setFiredQueue(q => q.filter(x => x.id !== r.id));
  const tuneIn = async (r) => {
    await handlePlay(r.item, r.streamType);
    dismissFired(r);
  };

  const upcoming = reminders.filter(r => !r.fired && !isPast(new Date(r.remindAt)));
  const past = reminders.filter(r => r.fired || isPast(new Date(r.remindAt)));

  return (
    <div className="space-y-5">
      {/* Due reminder toasts */}
      {firedQueue.map(r => (
        <div key={r.id} className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl p-4 animate-pulse">
          <BellRing className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary">Reminder: {cleanName(r.label)}</p>
            <p className="text-xs text-muted-foreground">Your show is starting now!</p>
          </div>
          <button onClick={() => tuneIn(r)}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors flex-shrink-0">
            Tune In
          </button>
          <button onClick={() => dismissFired(r)} className="text-muted-foreground hover:text-foreground transition-colors">
            <CheckCircle className="w-4 h-4" />
          </button>
        </div>
      ))}

      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Reminders
        </h2>
        <p className="text-xs text-muted-foreground">Set reminders and the app will auto-tune when it's time.</p>
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-2">No reminders yet.</p>
          <p className="text-xs text-muted-foreground">Tap the <Bell className="inline w-3.5 h-3.5 mx-0.5" /> icon on any channel to set a reminder.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Upcoming
              </p>
              {upcoming.map(r => <ReminderRow key={r.id} r={r} onRemove={handleRemove} onPlay={() => handlePlay(r.item, r.streamType)} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Past</p>
              {past.map(r => <ReminderRow key={r.id} r={r} onRemove={handleRemove} onPlay={() => handlePlay(r.item, r.streamType)} past />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderRow({ r, onRemove, onPlay, past }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${past ? 'bg-secondary/50 border-border opacity-60' : 'bg-card border-border hover:border-primary/30'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${past ? 'bg-secondary' : 'bg-primary/10'}`}>
        <Bell className={`w-4 h-4 ${past ? 'text-muted-foreground' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{cleanName(r.label)}</p>
        <p className="text-[11px] text-muted-foreground">
          {past
            ? `Was: ${format(new Date(r.remindAt), 'MMM d, h:mm a')}`
            : `${format(new Date(r.remindAt), 'MMM d, h:mm a')} · ${formatDistanceToNow(new Date(r.remindAt), { addSuffix: true })}`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onPlay}
          className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors">
          <Play className="w-4 h-4 fill-primary" />
        </button>
        <button onClick={() => onRemove(r.id)}
          className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}