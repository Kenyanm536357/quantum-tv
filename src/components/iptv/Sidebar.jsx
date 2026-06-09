import React from 'react';
import { Tv, Film, Clapperboard, Settings, Zap, LogOut } from 'lucide-react';
import { useIPTV } from '@/lib/IPTVContext';
import { motion } from 'framer-motion';

const navItems = [
  { id: 'live', icon: Tv, label: 'Live TV', desc: 'Channels' },
  { id: 'movies', icon: Film, label: 'Movies', desc: 'VOD' },
  { id: 'series', icon: Clapperboard, label: 'TV Series', desc: 'Episodes' },
  { id: 'settings', icon: Settings, label: 'Settings', desc: 'Config' },
];

export default function Sidebar({ collapsed = false }) {
  const { activeSection, setActiveSection, config, setConfig } = useIPTV();

  return (
    <aside className={`fixed left-0 top-0 bottom-0 bg-sidebar border-r border-sidebar-border flex flex-col z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-sidebar-border ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Quantum<span className="text-primary">IPTV</span></h1>
            <p className="text-[10px] text-muted-foreground">{config?.base_url?.replace(/https?:\/\//, '').split(':')[0] || 'Connected'}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item, i) => {
          const active = activeSection === item.id;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
              {!collapsed && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium leading-tight">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground group-hover:text-sidebar-accent-foreground transition-colors">{item.desc}</p>
                </div>
              )}
              {!collapsed && active && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
            </motion.button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={`p-2 border-t border-sidebar-border ${collapsed ? '' : ''}`}>
        <button
          onClick={() => setConfig(null)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Disconnect' : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Disconnect</span>}
        </button>
      </div>
    </aside>
  );
}