import React, { useState } from 'react';
import { Film, Clapperboard, Settings, Zap, LogOut, Radio, Tv2, Bookmark, History, Bell, Menu, X } from 'lucide-react';
import { clearCredentials } from '@/lib/iptv-store';
import { useStore } from '@/lib/use-store';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  { id: 'live',      icon: Radio,        label: 'Live TV'   },
  { id: 'movies',    icon: Film,         label: 'Movies'    },
  { id: 'series',    icon: Clapperboard, label: 'Series'    },
  { id: 'epg',       icon: Tv2,          label: 'TV Guide'  },
  { id: 'bookmarks', icon: Bookmark,     label: 'Bookmarks' },
  { id: 'history',   icon: History,      label: 'History'   },
  { id: 'reminders', icon: Bell,         label: 'Reminders' },
  { id: 'settings',  icon: Settings,     label: 'Settings'  },
];

export default function AppTopbar() {
  const { credentials } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (id) => { navigate('/' + id); setMobileOpen(false); };

  return (
    <>
      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-6 px-6 bg-black/80 backdrop-blur-xl border-b border-white/5"
        style={{
          height: 'calc(3.75rem + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Brand */}
        <button onClick={() => go('live')} className="flex items-center gap-2 flex-shrink-0 select-none">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-cyan">
            <Zap className="w-4 h-4 text-black" />
          </div>
          <span className="text-[17px] font-black tracking-tight">
            Quantum<span className="text-primary">TV</span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {NAV.map(item => {
            const active = pathname.startsWith('/' + item.id);
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 select-none ${
                  active
                    ? 'text-white bg-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Disconnect + mobile menu */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={clearCredentials}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all select-none"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-white/70 hover:text-white transition-colors select-none"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ top: 'calc(3.75rem + env(safe-area-inset-top))' }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-[#0d0d0d] border-b border-white/8 grid grid-cols-2 gap-1 p-3">
            {NAV.map(item => {
              const active = pathname.startsWith('/' + item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all select-none ${
                    active ? 'bg-primary/15 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={clearCredentials}
              className="col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-all select-none"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </>
  );
}