import React from 'react';
import { Film, Clapperboard, Settings, Zap, LogOut, Radio, Tv2, Bookmark, History, Bell } from 'lucide-react';
import { clearCredentials } from '@/lib/iptv-store';
import { useStore } from '@/lib/use-store';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  { id: 'live',      icon: Radio,        label: 'Live TV',   sub: 'Channels' },
  { id: 'movies',    icon: Film,         label: 'Movies',    sub: 'VOD' },
  { id: 'series',    icon: Clapperboard, label: 'TV Series', sub: 'Episodes' },
  { id: 'epg',       icon: Tv2,          label: 'TV Guide',  sub: 'EPG' },
  { id: 'bookmarks', icon: Bookmark,     label: 'Bookmarks', sub: 'Saved' },
  { id: 'history',   icon: History,      label: 'History',   sub: 'Watched' },
  { id: 'reminders', icon: Bell,         label: 'Reminders', sub: 'Alerts' },
  { id: 'settings',  icon: Settings,     label: 'Settings',  sub: 'Config' },
];

export default function AppSidebar({ onClose }) {
  const { credentials } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const host = credentials?.baseUrl?.replace(/https?:\/\//, '').split(':')[0] ?? '';

  return (
    <aside className="flex flex-col h-full bg-[hsl(220_18%_5%)] border-r border-border w-60">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 flex-shrink-0 rounded-xl overflow-hidden">
          <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/40f2bbd9e_QUANTUMTVLOGOver2.png" alt="QuantumTV" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight">Quantum<span className="text-primary">TV</span></p>
          <p className="text-[10px] text-muted-foreground truncate">{host || 'Connected'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname.startsWith('/' + item.id);
          return (
            <button key={item.id}
              onClick={() => { navigate('/' + item.id); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 group ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}>
              <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-primary' : ''}`} />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium leading-tight">{item.label}</p>
                <p className="text-[10px] opacity-60">{item.sub}</p>
              </div>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t border-border">
        <button onClick={clearCredentials}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all">
          <LogOut className="w-[18px] h-[18px]" />
          <span className="text-sm font-medium">Disconnect</span>
        </button>
      </div>
    </aside>
  );
}