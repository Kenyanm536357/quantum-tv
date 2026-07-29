import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Settings, Activity, LogOut, Tv,
  Smartphone, Download, MonitorPlay, Menu, X, AlertTriangle, Cable,
} from "lucide-react";
import { IS_PRODUCTION_BACKEND, PRODUCTION_URL } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/Users";
import SettingsPage from "./pages/Settings";
import ActivityPage from "./pages/Activity";
import MobilePreview from "./pages/MobilePreview";
import FireTV from "./pages/FireTV";
import FireTVPreview from "./pages/FireTVPreview";
import Watch from "./pages/Watch";
import Activate from "./pages/Activate";
import Iptv from "./pages/Iptv";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/users", label: "Subscribers", icon: Users, testid: "nav-users" },
  { to: "/iptv", label: "IPTV Provider", icon: Cable, testid: "nav-iptv" },
  { to: "/preview", label: "App Preview", icon: Smartphone, testid: "nav-preview" },
  { to: "/tv-preview", label: "Fire TV Preview", icon: MonitorPlay, testid: "nav-tv-preview" },
  { to: "/firetv", label: "Fire TV Install", icon: Download, testid: "nav-firetv" },
  { to: "/activity", label: "Activity", icon: Activity, testid: "nav-activity" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

const NavList = ({ onPick }) => {
  const loc = useLocation();
  return (
    <nav className="px-3 flex-1 space-y-1 overflow-y-auto">
      {NAV_ITEMS.map((it) => {
        const active = loc.pathname === it.to || (it.to !== "/" && loc.pathname.startsWith(it.to));
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            data-testid={it.testid}
            onClick={onPick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all relative ${
              active
                ? "bg-gradient-to-r from-purple-500/20 via-cyan-500/10 to-transparent border-l-2 border-cyan-400 text-white"
                : "text-zinc-400 hover:text-white hover:bg-white/5 active:bg-white/10"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="font-body">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const BrandHeader = () => (
  <div className="p-5 flex items-center gap-3">
    <img src="/logo.png" alt="logo" className="w-10 h-10 rounded-xl shadow-glow" />
    <div>
      <div className="font-heading font-bold tracking-wide text-sm gradient-text">QUANTUM TV</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Admin Console</div>
    </div>
  </div>
);

const PreviewBanner = () => (
  <div data-testid="preview-banner" className="bg-amber-500/15 border-b border-amber-400/30 text-amber-100 px-3 sm:px-4 md:px-6 py-2 flex items-start sm:items-center gap-3">
    <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
    <div className="text-xs sm:text-sm leading-snug flex-1 min-w-0">
      <span className="font-semibold text-amber-200">Preview environment.</span>{" "}
      Users you create here will NOT appear in the Fire Stick app. Open the production admin at{" "}
      <a href={PRODUCTION_URL + "/login"} className="underline font-medium text-amber-200 break-all" data-testid="goto-production">
        {PRODUCTION_URL.replace(/^https?:\/\//, "")}/login
      </a>
      {" "}to manage real users.
    </div>
  </div>
);

const Shell = ({ children }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on every route change
  useEffect(() => { setDrawerOpen(false); }, [loc.pathname]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const logout = () => { localStorage.removeItem("qtv_admin_token"); nav("/login"); };
  const currentLabel = NAV_ITEMS.find((it) => it.to === loc.pathname || (it.to !== "/" && loc.pathname.startsWith(it.to)))?.label || "Control Center";

  return (
    <div className="min-h-screen flex relative z-10">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 lg:w-64 shrink-0 border-r border-white/5 bg-[#060714]/80 backdrop-blur-md flex-col sticky top-0 h-screen">
        <BrandHeader />
        <NavList />
        <div className="p-3 border-t border-white/5">
          <button
            data-testid="logout-btn"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer + backdrop */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.button
              key="backdrop"
              data-testid="drawer-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-label="Close menu"
            />
            <motion.aside
              key="drawer"
              data-testid="mobile-drawer"
              initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] z-50 bg-[#060714]/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between pr-3">
                <BrandHeader />
                <button
                  data-testid="drawer-close"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NavList onPick={() => setDrawerOpen(false)} />
              <div className="p-3 border-t border-white/5">
                <button
                  data-testid="logout-btn-mobile"
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0 w-full">
        {!IS_PRODUCTION_BACKEND && <PreviewBanner />}
        <header className="h-12 sm:h-14 border-b border-white/5 px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 bg-[#060714]/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              data-testid="open-drawer"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 active:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Tv className="w-4 h-4 text-cyan-400 hidden md:block shrink-0" />
            <span className="hidden md:inline font-heading uppercase tracking-[0.25em] text-xs text-zinc-400">Control Center</span>
            <span className="md:hidden font-heading text-sm font-semibold text-white truncate">{currentLabel}</span>
          </div>
          <div className="text-[10px] sm:text-xs text-zinc-500 font-mono shrink-0">v1.0.0</div>
        </header>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-3 sm:p-4 md:p-6"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};

const RequireAuth = ({ children }) => {
  const t = localStorage.getItem("qtv_admin_token");
  if (!t) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/watch/*" element={<Watch />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
      <Route path="/activity" element={<RequireAuth><ActivityPage /></RequireAuth>} />
      <Route path="/preview" element={<RequireAuth><MobilePreview /></RequireAuth>} />
      <Route path="/tv-preview" element={<RequireAuth><FireTVPreview /></RequireAuth>} />
      <Route path="/firetv" element={<RequireAuth><FireTV /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
