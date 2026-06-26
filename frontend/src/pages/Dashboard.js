import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { Users, Server, Activity, Sparkles, ArrowUpRight } from "lucide-react";

const StatCard = ({ label, value, icon: Icon, accent, testid }) => (
  <div data-testid={testid} className="neon-card p-6 group">
    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity"
      style={{ background: accent === "cyan" ? "rgba(6,182,212,0.5)" : "rgba(139,92,246,0.5)" }} />
    <div className="flex items-start justify-between relative">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">{label}</div>
        <div className="font-heading font-bold text-4xl mt-3 gradient-text">{value}</div>
      </div>
      <div className={`p-3 rounded-2xl bg-white/5 border border-white/10`}>
        <Icon className={`w-5 h-5 ${accent === "cyan" ? "text-cyan-400" : "text-purple-400"}`} />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-1 text-xs text-zinc-500">
      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
      <span>Live</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
    refetchInterval: 10000,
  });
  const { data: act } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => (await api.get("/admin/activity?limit=12")).data,
    refetchInterval: 12000,
  });

  return (
    <div data-testid="dashboard-page" className="space-y-8 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Overview</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Mission Control</h1>
        <p className="text-zinc-400 text-sm mt-2">Real-time view of your Quantum TV deployment.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard testid="stat-users-total" label="Total Users" value={isLoading ? "—" : data?.users_total ?? 0} icon={Users} accent="purple" />
        <StatCard testid="stat-users-active" label="Active Users" value={isLoading ? "—" : data?.users_active ?? 0} icon={Sparkles} accent="cyan" />
        <StatCard testid="stat-recent-logins" label="Recent Logins (7d)" value={isLoading ? "—" : data?.users_recent_logins_7d ?? 0} icon={Activity} accent="purple" />
        <StatCard testid="stat-open-pins" label="Open Auth Pins" value={isLoading ? "—" : data?.open_pins ?? 0} icon={Server} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 neon-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-lg">Recent Activity</h3>
            <span className="text-xs text-zinc-500 font-mono">last 12 events</span>
          </div>
          <div className="divide-y divide-white/5">
            {(act?.activity || []).length === 0 && (
              <div className="text-sm text-zinc-500 py-6 text-center">No activity yet — waiting for first sign-in.</div>
            )}
            {(act?.activity || []).map((a) => (
              <div key={a.id + a.at} className="py-3 flex items-center gap-4">
                <img src={a.avatar || "/logo.png"} alt="" className="w-9 h-9 rounded-full border border-white/10 object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{a.username || "Unknown"}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">{a.action} · {a.server || "no server"}</div>
                </div>
                <div className="text-xs text-zinc-500 font-mono">{a.at ? new Date(a.at).toLocaleString() : "—"}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="neon-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-4">Service</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Name</span><span>{data?.service_name || "Quantum TV"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Backend</span><span className="text-emerald-400 font-mono">online</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Auth</span><span>Plex OAuth (PIN)</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Token storage</span><span className="text-cyan-400">Fernet-encrypted</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
