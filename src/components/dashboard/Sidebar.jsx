import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  BarChart3,
  Users,
  Settings,
  Video,
  MessageSquare,
  Zap
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Radio, label: 'Live Stream', path: '/live' },
  { icon: Video, label: 'Content', path: '/content' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Users, label: 'Audience', path: '/audience' },
  { icon: MessageSquare, label: 'Chat', path: '/chat' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50 lg:flex">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Quantum TV</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">Streaming Studio</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-primary' : ''}`} />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-accent">Q</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Quantum Studio</p>
            <p className="text-[10px] text-muted-foreground">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}