import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/use-store';
import { loadCredentials, setState } from '@/lib/iptv-store';
import LoginScreen from '@/components/iptv/LoginScreen';
import AppSidebar from '@/components/iptv/AppSidebar';
import VideoPlayer from '@/components/iptv/VideoPlayer';
import LiveSection from '@/pages/iptv/LiveSection';
import MoviesSection from '@/pages/iptv/MoviesSection';
import SeriesSection from '@/pages/iptv/SeriesSection';
import SettingsSection from '@/pages/iptv/SettingsSection';
import { Menu, Radio, Film, Clapperboard, Settings } from 'lucide-react';

const SECTIONS = {
  live: LiveSection,
  movies: MoviesSection,
  series: SeriesSection,
  settings: SettingsSection,
};

const SECTION_LABELS = {
  live: 'Live TV',
  movies: 'Movies',
  series: 'TV Series',
  settings: 'Settings',
};

const SECTION_ICONS = {
  live: Radio,
  movies: Film,
  series: Clapperboard,
  settings: Settings,
};

export default function Home() {
  const { credentials, section, player } = useStore();
  const [booting, setBooting] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadCredentials();
    setBooting(false);
  }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-9 h-9 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!credentials) return <LoginScreen />;

  const ActiveSection = SECTIONS[section] || LiveSection;
  const SectionIcon = SECTION_ICONS[section] || Radio;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <AppSidebar />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10">
            <AppSidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 bg-[hsl(220_18%_5%/0.95)] backdrop-blur border-b border-border flex items-center justify-between px-4">
          <button onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <Menu className="w-5 h-5" />
          </button>
          <span className="flex items-center gap-2 text-sm font-bold">
            <SectionIcon className="w-4 h-4 text-primary" />
            {SECTION_LABELS[section]}
          </span>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <ActiveSection />
        </main>
      </div>

      {/* Video player overlay */}
      {player && (
        <VideoPlayer
          src={player.src}
          title={player.title}
          type={player.type}
        />
      )}
    </div>
  );
}