import { useState, useEffect } from 'react';

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/use-store';
import { loadCredentials, setState, saveCredentials } from '@/lib/iptv-store';
import MacActivationScreen from '@/components/iptv/MacActivationScreen';
import { isActivated, activateDevice, getDeviceMAC } from '@/lib/mac-auth';
import { AppSidebar, BottomTabBar } from '@/components/iptv/AppTopbar';
import VideoPlayer from '@/components/iptv/VideoPlayer';
import LiveSection from '@/pages/iptv/LiveSection';
import MoviesSection from '@/pages/iptv/MoviesSection';
import SeriesSection from '@/pages/iptv/SeriesSection';
import SettingsSection from '@/pages/iptv/SettingsSection';
import EPGSection from '@/pages/iptv/EPGSection';
import BrowseSection from '@/pages/iptv/BrowseSection';
import BookmarksSection from '@/pages/iptv/BookmarksSection';
import HistorySection from '@/pages/iptv/HistorySection';
import RemindersSection from '@/pages/iptv/RemindersSection';
import { getDueReminders, markReminderFired } from '@/lib/user-data';
import { usePlaylist } from '@/lib/use-playlist';
import { BellRing, X } from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
};
const pageTransition = { duration: 0.15, ease: 'easeOut' };

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
  const cleanN = (s = '') => s.replace(/;/g, '').trim();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-full max-w-sm px-4">
      <div className="flex items-center gap-3 bg-[#0d1117] border border-primary/40 rounded-2xl p-4 shadow-2xl">
        <BellRing className="w-5 h-5 text-primary flex-shrink-0 animate-bounce" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-primary">Reminder</p>
          <p className="text-xs text-white/50 truncate">{cleanN(alert.label)} is on now!</p>
        </div>
        <button onClick={async () => {
          const src = await resolveStreamUrl(alert.item, alert.streamType);
          setState({ player: { src, title: cleanN(alert.label), type: alert.streamType } });
          setAlert(null);
        }} className="px-3 py-1.5 bg-primary text-black rounded-lg text-xs font-bold flex-shrink-0">
          Tune In
        </button>
        <button onClick={() => setAlert(null)} className="text-white/30 hover:text-white/70 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { credentials, player } = useStore();
  const location = useLocation();
  const sectionKey = location.pathname.replace('/', '') || 'epg';
  const [activated, setActivated] = useState(() => isActivated());

  useEffect(() => {
    setState({ section: sectionKey });
  }, [sectionKey]);

  // Auto-load hardcoded playlist once MAC is activated
  useEffect(() => {
    if (activated && !credentials) {
      // Load the hardcoded Quantum TV M3U source silently
      saveCredentials({
        type: 'm3u',
        baseUrl: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
        label: 'Quantum TV',
        mac: getDeviceMAC(),
      });
    }
  }, [activated, credentials]);

  if (!activated) {
    return <MacActivationScreen onActivated={() => setActivated(true)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden"
      style={{ background: '#07090f' }}>

      {/* ── Sidebar: shown on lg screens AND landscape phones ── */}
      <div className="hidden lg:flex flex-shrink-0" style={{ width: 200 }}>
        <AppSidebar />
      </div>
      {/* Landscape phone sidebar (min-height > min-width) */}
      <div className="flex lg:hidden flex-shrink-0 landscape-sidebar">
        <AppSidebar />
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="flex-1 overflow-y-auto overflow-x-hidden content-scroll"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
            }}
          >
            <div className={`h-full ${sectionKey === 'epg' ? 'p-0' : 'p-4 sm:p-6'}`}>
              <Routes location={location}>
                <Route path="/browse"    element={<BrowseSection />} />
                <Route path="/live"      element={<LiveSection />} />
                <Route path="/movies"    element={<MoviesSection />} />
                <Route path="/series"    element={<SeriesSection />} />
                <Route path="/epg"       element={<EPGSection />} />
                <Route path="/bookmarks" element={<BookmarksSection />} />
                <Route path="/history"   element={<HistorySection />} />
                <Route path="/reminders" element={<RemindersSection />} />
                <Route path="/settings"  element={<SettingsSection />} />
                <Route path="*"          element={<Navigate to="/browse" replace />} />
              </Routes>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Bottom tab bar — portrait mobile only */}
        <div className="portrait-bottom-bar lg:hidden">
          <BottomTabBar />
        </div>
      </div>



      {/* Reminder alert */}
      <ReminderChecker credentials={credentials} />

      {/* Video player overlay — suppressed on EPG (inline preview there) */}
      {player && sectionKey !== 'epg' && sectionKey !== 'browse' && (
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

  const adminLink = (
    <a href="/admin/activation" className="fixed top-3 right-4 text-white/40 hover:text-white transition-colors z-[200] select-none text-xl">⚙</a>
  );

  if (booting) {
    return (
      <>
        <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
          <div className="w-9 h-9 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
        {adminLink}
      </>
    );
  }

  return (
    <>
      <AppShell />
      {adminLink}
    </>
  );
}