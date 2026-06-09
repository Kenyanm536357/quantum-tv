import React, { useState, useEffect } from 'react';
import { useIPTV } from '@/lib/IPTVContext';
import { base44 } from '@/api/base44Client';
import LoginScreen from '@/components/iptv/LoginScreen';
import Sidebar from '@/components/iptv/Sidebar';
import LiveTV from '@/pages/iptv/LiveTV';
import Movies from '@/pages/iptv/Movies';
import Series from '@/pages/iptv/Series';
import SettingsPage from '@/pages/iptv/SettingsPage';
import { Menu, X } from 'lucide-react';

const sectionComponents = {
  live: LiveTV,
  movies: Movies,
  series: Series,
  settings: SettingsPage,
};

export default function IPTVApp() {
  const { config, setConfig, activeSection } = useIPTV();
  const [booting, setBooting] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Try to restore last saved config on load
  useEffect(() => {
    base44.entities.IPTVConfig.list('-created_date', 1)
      .then(configs => {
        if (configs.length > 0) {
          const cfg = configs[0];
          setConfig({ base_url: cfg.base_url, username: cfg.username, password: cfg.password });
        }
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) return <LoginScreen />;

  const ActiveSection = sectionComponents[activeSection] || LiveTV;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile Top Bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {activeSection === 'live' ? 'Live TV' : activeSection === 'movies' ? 'Movies' : activeSection === 'series' ? 'TV Series' : 'Settings'}
          </span>
          <div className="w-9" />
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <ActiveSection />
        </main>
      </div>
    </div>
  );
}