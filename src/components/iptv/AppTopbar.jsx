import React, { useState } from 'react';
import { Film, Clapperboard, Settings, LogOut, Radio, Tv2, Bookmark, History, Bell, Menu, X, Zap, LayoutGrid } from 'lucide-react';
import { clearCredentials } from '@/lib/iptv-store';
import { useNavigate, useLocation } from 'react-router-dom';

export const NAV = [
  { id: 'browse',    icon: LayoutGrid,   label: 'Browse'    },
  { id: 'epg',       icon: Tv2,          label: 'TV Guide'  },
  { id: 'live',      icon: Radio,        label: 'Live TV'   },
  { id: 'movies',    icon: Film,         label: 'Movies'    },
  { id: 'series',    icon: Clapperboard, label: 'Series'    },
  { id: 'bookmarks', icon: Bookmark,     label: 'Bookmarks' },
  { id: 'history',   icon: History,      label: 'History'   },
  { id: 'reminders', icon: Bell,         label: 'Reminders' },
  { id: 'settings',  icon: Settings,     label: 'Settings'  },
];

// ── Sidebar (desktop/landscape) ───────────────────────────────────────────────
export function AppSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const go = (id) => navigate('/' + id);

  return (
    <aside className="flex flex-col h-full bg-[#07090f] border-r border-white/6 select-none"
      style={{ width: 200, paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/6 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
          <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/7cb772c8e_QUANTUMTVLOGOver2.png"
            alt="QuantumTV" className="w-full h-full object-cover rounded-lg" />
        </div>
        <span className="text-[15px] font-black tracking-tight text-white">
          Quantum<span className="text-primary">TV</span>
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {NAV.map(item => {
          const active = pathname.startsWith('/' + item.id);
          return (
            <button key={item.id} onClick={() => go(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-white/45 hover:text-white hover:bg-white/6'
              }`}>
              <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </nav>


    </aside>
  );
}

// ── Bottom tab bar (mobile portrait) ─────────────────────────────────────────
const BOTTOM_NAV = NAV.slice(0, 5); // show first 5 in bottom bar

export function BottomTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const go = (id) => { navigate('/' + id); setMoreOpen(false); };

  return (
    <>
      {/* More drawer */}
      {moreOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute bottom-0 left-0 right-0 bg-[#0a0e1a] border-t border-white/10 rounded-t-2xl p-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2">
              {NAV.slice(5).map(item => {
                const active = pathname.startsWith('/' + item.id);
                return (
                  <button key={item.id} onClick={() => go(item.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all ${
                      active ? 'bg-primary/15 text-primary' : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}>
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex bg-[#07090f]/95 backdrop-blur-xl border-t border-white/8"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        {BOTTOM_NAV.map(item => {
          const active = pathname.startsWith('/' + item.id);
          return (
            <button key={item.id} onClick={() => go(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-all select-none touch-manipulation ${
                active ? 'text-primary' : 'text-white/35 hover:text-white/70'
              }`}>
              <item.icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
              {item.label}
            </button>
          );
        })}
        <button onClick={() => setMoreOpen(v => !v)}
          className="flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium text-white/35 hover:text-white/70 transition-all select-none touch-manipulation">
          <Menu className="w-5 h-5" />
          More
        </button>
      </nav>
    </>
  );
}

// ── Default export (kept for any legacy imports) ──────────────────────────────
export default function AppTopbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = (id) => { navigate('/' + id); setMobileOpen(false); };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-4 bg-[#07090f]/95 backdrop-blur-xl border-b border-white/6 select-none"
        style={{ height: 'calc(3.25rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => go('epg')} className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg overflow-hidden">
            <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/7cb772c8e_QUANTUMTVLOGOver2.png"
              alt="QuantumTV" className="w-full h-full object-cover rounded-lg" />
          </div>
          <span className="text-[15px] font-black tracking-tight text-white">Quantum<span className="text-primary">TV</span></span>
        </button>
        <nav className="hidden lg:flex items-center gap-0.5 flex-1">
          {NAV.map(item => {
            const active = pathname.startsWith('/' + item.id);
            return (
              <button key={item.id} onClick={() => go(item.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'text-white bg-white/10' : 'text-white/45 hover:text-white hover:bg-white/5'
                }`}>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 ml-auto">

          <button onClick={() => setMobileOpen(v => !v)}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors">
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" style={{ top: 'calc(3.25rem + env(safe-area-inset-top))' }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-[#0a0e1a] border-b border-white/8 grid grid-cols-2 gap-1 p-3">
            {NAV.map(item => {
              const active = pathname.startsWith('/' + item.id);
              return (
                <button key={item.id} onClick={() => go(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    active ? 'bg-primary/15 text-primary' : 'text-white/55 hover:bg-white/5 hover:text-white'
                  }`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}