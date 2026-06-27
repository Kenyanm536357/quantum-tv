import React from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Server, Settings, Activity, LogOut, Tv, Smartphone, Download, MonitorPlay } from "lucide-react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/Users";
import Servers from "./pages/Servers";
import SettingsPage from "./pages/Settings";
import ActivityPage from "./pages/Activity";
import MobilePreview from "./pages/MobilePreview";
import FireTV from "./pages/FireTV";
import FireTVPreview from "./pages/FireTVPreview";

const Shell = ({ children }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const items = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
    { to: "/users", label: "Users", icon: Users, testid: "nav-users" },
    { to: "/servers", label: "Plex Servers", icon: Server, testid: "nav-servers" },
    { to: "/preview", label: "App Preview", icon: Smartphone, testid: "nav-preview" },
    { to: "/tv-preview", label: "Fire TV Preview", icon: MonitorPlay, testid: "nav-tv-preview" },
    { to: "/firetv", label: "Fire TV Install", icon: Download, testid: "nav-firetv" },
    { to: "/activity", label: "Activity", icon: Activity, testid: "nav-activity" },
    { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
  ];
  const logout = () => { localStorage.removeItem("qtv_admin_token"); nav("/login"); };
  return (
    <div className="min-h-screen flex relative z-10">
      <aside className="w-64 shrink-0 border-r border-white/5 bg-[#060714]/80 backdrop-blur-md flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="w-10 h-10 rounded-xl shadow-glow" />
          <div>
            <div className="font-heading font-bold tracking-wide text-sm gradient-text">QUANTUM TV</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Admin Console</div>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {items.map((it) => {
            const active = loc.pathname === it.to || (it.to !== "/" && loc.pathname.startsWith(it.to));
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                data-testid={it.testid}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all relative ${
                  active
                    ? "bg-gradient-to-r from-purple-500/20 via-cyan-500/10 to-transparent border-l-2 border-cyan-400 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-body">{it.label}</span>
              </Link>
            );
          })}
        </nav>
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
      <main className="flex-1 min-w-0">
        <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between sticky top-0 bg-[#060714]/70 backdrop-blur-md z-20">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <Tv className="w-4 h-4 text-cyan-400" />
            <span className="font-heading uppercase tracking-[0.25em] text-xs">Control Center</span>
          </div>
          <div className="text-xs text-zinc-500 font-mono">v1.0.0</div>
        </header>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-8"
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
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
      <Route path="/servers" element={<RequireAuth><Servers /></RequireAuth>} />
      <Route path="/activity" element={<RequireAuth><ActivityPage /></RequireAuth>} />
      <Route path="/preview" element={<RequireAuth><MobilePreview /></RequireAuth>} />
      <Route path="/tv-preview" element={<RequireAuth><FireTVPreview /></RequireAuth>} />
      <Route path="/firetv" element={<RequireAuth><FireTV /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
