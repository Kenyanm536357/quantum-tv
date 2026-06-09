import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/use-store';
import { loadCredentials, setState } from '@/lib/iptv-store';
import LoginScreen from '@/components/iptv/LoginScreen';
import AppSidebar from '@/components/iptv/AppSidebar';
import MobileNavbar from '@/components/iptv/MobileNavbar';
import VideoPlayer from '@/components/iptv/VideoPlayer';
import LiveSection from '@/pages/iptv/LiveSection';
import MoviesSection from '@/pages/iptv/MoviesSection';
import SeriesSection from '@/pages/iptv/SeriesSection';
import SettingsSection from '@/pages/iptv/SettingsSection';
import { Menu, Radio, Film, Clapperboard, Settings } from 'lucide-react';

const SECTION_META = {
  live:     { label: 'Live TV',    Icon: Radio },
  movies:   { label: 'Movies',     Icon: Film },
  series:   { label: 'TV Series',  Icon: Clapperboard },
  settings: { label: 'Settings',   Icon: Settings },
};

const pageVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -16 },
};
const pageTransition = { duration: 0.18, ease: 'easeOut' };

function AppShell() {
  const { credentials, player } = useStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active section from URL
  const sectionKey = location.pathname.replace('/', '') || 'live';
  const meta = SECTION_META[sectionKey] || SECTION_META.live;

  // Keep legacy store section in sync
  useEffect(() => {
    if (SECTION_META[sectionKey]) setState({ section: sectionKey });
  }, [sectionKey]);

  if (!credentials) return <LoginScreen />;

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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header
          className="lg:hidden sticky top-0 z-30 bg-[hsl(220_18%_5%/0.95)] backdrop-blur border-b border-border flex items-center justify-between px-4"
          style={{
            height: 'calc(3.5rem + env(safe-area-inset-top))',
            paddingTop: 'env(safe-area-inset-top)',
            paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
            paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ minHeight: 44, minWidth: 44 }}
            className="rounded-xl bg-secondary flex items-center justify-center select-none"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="flex items-center gap-2 text-sm font-bold select-none">
            <meta.Icon className="w-4 h-4 text-primary" />
            {meta.label}
          </span>
          <div style={{ minWidth: 44 }} />
        </header>

        {/* Animated page content */}
        <main
          className="flex-1 overflow-auto"
          style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="min-h-full p-4 sm:p-6 lg:p-8"
            >
              <Routes location={location}>
                <Route path="/live"     element={<LiveSection />} />
                <Route path="/movies"   element={<MoviesSection />} />
                <Route path="/series"   element={<SeriesSection />} />
                <Route path="/settings" element={<SettingsSection />} />
                <Route path="*"         element={<Navigate to="/live" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNavbar />

      {/* Video player overlay */}
      {player && (
        <VideoPlayer src={player.src} title={player.title} type={player.type} />
      )}
    </div>
  );
}

export default function Home() {
  const [booting, setBooting] = useState(true);

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

  return <AppShell />;
}