import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/use-store';
import { loadCredentials, setState } from '@/lib/iptv-store';
import WelcomeScreen from '@/components/iptv/WelcomeScreen';
import AppSidebar from '@/components/iptv/AppSidebar';
import MobileNavbar from '@/components/iptv/MobileNavbar';
import VideoPlayer from '@/components/iptv/VideoPlayer';
import LiveSection from '@/pages/iptv/LiveSection';
import MoviesSection from '@/pages/iptv/MoviesSection';
import SeriesSection from '@/pages/iptv/SeriesSection';
import SettingsSection from '@/pages/iptv/SettingsSection';
import EPGSection from '@/pages/iptv/EPGSection';
import BookmarksSection from '@/pages/iptv/BookmarksSection';
import HistorySection from '@/pages/iptv/HistorySection';
import RemindersSection from '@/pages/iptv/RemindersSection';
import { getDueReminders, markReminderFired } from '@/lib/user-data';
import { usePlaylist } from '@/lib/use-playlist';
import { Menu, Radio, Film, Clapperboard, Settings, Tv2, Bookmark, History, Bell, BellRing, X } from 'lucide-react';

const SECTION_META = {
  live:      { label: 'Live TV',    Icon: Radio },
  movies:    { label: 'Movies',     Icon: Film },
  series:    { label: 'TV Series',  Icon: Clapperboard },
  epg:       { label: 'TV Guide',   Icon: Tv2 },
  bookmarks: { label: 'Bookmarks',  Icon: Bookmark },
  history:   { label: 'History',    Icon: History },
  reminders: { label: 'Reminders',  Icon: Bell },
  settings:  { label: 'Settings',   Icon: Settings },
};

const pageVariants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -16 },
};
const pageTransition = { duration: 0.18, ease: 'easeOut' };

function ReminderChecker({ credentials }) {
  const { resolveStreamUrl } = usePlaylist(credentials);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const check = () => {
      const due = getDueReminders(credentials);
      if (due.length > 0) {
        due.forEach(r => markReminderFired(credentials, r.id));
        setAlert(due[0]);
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [credentials]);

  if (!alert) return null;
  const cleanName = (s = '') => s.replace(/;/g, '').trim();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-full max-w-sm px-4">
      <div className="flex items-center gap-3 bg-card border border-primary/40 rounded-2xl p-4 shadow-2xl">
        <BellRing className="w-5 h-5 text-primary flex-shrink-0 animate-bounce" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary">Reminder</p>
          <p className="text-xs text-muted-foreground truncate">{cleanName(alert.label)} is on now!</p>
        </div>
        <button onClick={async () => {
          const src = await resolveStreamUrl(alert.item, alert.streamType);
          setState({ player: { src, title: cleanName(alert.label), type: alert.streamType } });
          setAlert(null);
        }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold flex-shrink-0">
          Tune In
        </button>
        <button onClick={() => setAlert(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

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

  if (!credentials) return <WelcomeScreen />;


  return (
    <div className="min-h-screen flex" style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}>
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
                <Route path="/epg"       element={<EPGSection />} />
                <Route path="/bookmarks" element={<BookmarksSection />} />
                <Route path="/history"   element={<HistorySection />} />
                <Route path="/reminders" element={<RemindersSection />} />
                <Route path="/settings"  element={<SettingsSection />} />
                <Route path="*"         element={<Navigate to="/live" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNavbar />

      {/* Reminder alert */}
      <ReminderChecker credentials={credentials} />

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