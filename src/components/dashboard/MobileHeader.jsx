import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Zap, LayoutDashboard, Radio, Video, BarChart3, Users, MessageSquare, Settings } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Radio, label: 'Live Stream', path: '/live' },
  { icon: Video, label: 'Content', path: '/content' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Users, label: 'Audience', path: '/audience' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function MobileHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="lg:hidden">
      <div className="fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground">Quantum TV</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-foreground p-1">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 top-14 bg-background/95 backdrop-blur-sm z-40">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}