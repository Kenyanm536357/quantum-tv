import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { Users, Activity, Sparkles, ArrowUpRight } from "lucide-react";

const StatCard = ({ label, value, icon: Icon, accent, testid }) => (
  <div data-testid={testid} className="neon-card p-4 sm:p-6 group">
    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity"
      style={{ background: accent === "cyan" ? "rgba(6,182,212,0.5)" : "rgba(139,92,246,0.5)" }} />
    <div className="flex items-start justify-between relative">
      <div className="min-w-0">
        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 font-heading">{label}</div>
        <div className="font-heading font-bold text-2xl sm:text-4xl mt-2 sm:mt-3 gradient-text">{value}</div>
      </div>
      <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 shrink-0">
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${accent === "cyan" ? "text-cyan-400" : "text-purple-400"}`} />
      </div>
    </div>
    <div className="mt-3 sm:mt-4 flex items-center gap-1 text-xs text-zinc-500">
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
    queryFn: async () => (await api.get("/admin/activity?limit=10")).data,
    refetchInterval: 12000,
  });

  return (
    <div data-testid="dashboard-page" className="space-y-6 sm:space-y-8 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Overview</div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">Control Panel</h1>
        <p className="text-zinc-400 text-sm mt-2">Manage subscribers, IPTV provider, and activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        <StatCard testid="stat-users-total" label="Total Users" value={isLoading ? "—" : data?.users_total ?? 0} icon={Users} accent="purple" />
        <StatCard testid="stat-users-active" label="Active Users" value={isLoading ? "—" : data?.users_active ?? 0} icon={Sparkles} accent="cyan" />
        <StatCard testid="stat-recent-logins" label="Logins (7d)" value={isLoading ? "—" : data?.users_recent_logins_7d ?? 0} icon={Activity} accent="purple" />
      </div>

      <div className="neon-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-base sm:text-lg">Recent Logins</h3>
          <span className="text-[10px] sm:text-xs text-zinc-500 font-mono">last 10</span>
        </div>
        <div className="divide-y divide-white/5">
          {(act?.activity || []).length === 0 && (
            <div className="text-sm text-zinc-500 py-6 text-center">No logins yet — once a user signs in on the mobile app they'll appear here.</div>
          )}
          {(act?.activity || []).map((a) => (
            <div key={a.id + (a.at || "")} className="py-3 flex items-center gap-3 sm:gap-4">
              <img src="/logo.png" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-white/10 object-cover shrink-0" alt="" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.display_name || a.username}</div>
                <div className="text-xs text-zinc-500 font-mono truncate">@{a.username} · {a.action}</div>
              </div>
              <div className="text-[10px] sm:text-xs text-zinc-500 font-mono shrink-0 text-right">{a.at ? new Date(a.at).toLocaleDateString() : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
