import React from 'react';
import { Radio, Film, Clapperboard, Bookmark, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  { id: 'live',      path: '/live',      icon: Radio,        label: 'Live'   },
  { id: 'movies',    path: '/movies',    icon: Film,         label: 'Movies' },
  { id: 'series',    path: '/series',    icon: Clapperboard, label: 'Series' },
  { id: 'bookmarks', path: '/bookmarks', icon: Bookmark,     label: 'Saved'  },
  { id: 'reminders', path: '/reminders', icon: Bell,         label: 'Alerts' },
];

export default function MobileNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex bg-[hsl(220_18%_5%/0.97)] backdrop-blur border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(item => {
        const active = pathname.startsWith(item.path);
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            style={{ minHeight: 44 }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors select-none relative ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {active && <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-primary" style={{ bottom: 'env(safe-area-inset-bottom)' }} />}
          </button>
        );
      })}
    </nav>
  );
}