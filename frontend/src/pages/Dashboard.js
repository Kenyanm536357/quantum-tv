import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Users, Server, Activity, Sparkles, ArrowUpRight, Link as LinkIcon, Unlink, CheckCircle2, ExternalLink } from "lucide-react";

const StatCard = ({ label, value, icon: Icon, accent, testid }) => (
  <div data-testid={testid} className="neon-card p-6 group">
    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity"
      style={{ background: accent === "cyan" ? "rgba(6,182,212,0.5)" : "rgba(139,92,246,0.5)" }} />
    <div className="flex items-start justify-between relative">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">{label}</div>
        <div className="font-heading font-bold text-4xl mt-3 gradient-text">{value}</div>
      </div>
      <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
        <Icon className={`w-5 h-5 ${accent === "cyan" ? "text-cyan-400" : "text-purple-400"}`} />
      </div>
    </div>
    <div className="mt-4 flex items-center gap-1 text-xs text-zinc-500">
      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
      <span>Live</span>
    </div>
  </div>
);

function PlexLinkPanel() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["plex-status"],
    queryFn: async () => (await api.get("/admin/plex/status")).data,
    refetchInterval: 8000,
  });
  const servers = useQuery({
    enabled: !!status.data?.linked,
    queryKey: ["plex-servers"],
    queryFn: async () => (await api.get("/admin/plex/servers")).data,
  });

  const [pin, setPin] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const startLink = async () => {
    const { data } = await api.post("/admin/plex/link/start");
    setPin(data);
    window.open(data.auth_url, "_blank", "noopener");
    pollRef.current = setInterval(async () => {
      try {
        const { data: chk } = await api.get(`/admin/plex/link/check/${data.pin_id}`);
        if (chk.linked) {
          clearInterval(pollRef.current);
          setPin(null);
          qc.invalidateQueries({ queryKey: ["plex-status"] });
          qc.invalidateQueries({ queryKey: ["plex-servers"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
        }
      } catch {}
    }, 2500);
  };

  const unlink = useMutation({
    mutationFn: async () => api.delete("/admin/plex/link"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plex-status"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const selectServer = useMutation({
    mutationFn: async (cid) => api.post("/admin/plex/servers/select", { client_identifier: cid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plex-servers"] });
      qc.invalidateQueries({ queryKey: ["plex-status"] });
    },
  });

  return (
    <div className="neon-card p-6" data-testid="plex-link-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-lg">Plex Connection</h3>
        {status.data?.linked ? (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-300">
            Not connected
          </span>
        )}
      </div>

      {!status.data?.linked && (
        <>
          <p className="text-sm text-zinc-400 mb-4">
            Link your Plex account once. Every user account you create will stream from this server.
          </p>
          {!pin ? (
            <button data-testid="plex-link-start" onClick={startLink} className="btn-gradient px-5 py-2.5 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Connect Plex
            </button>
          ) : (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-zinc-400 mb-2">Waiting for Plex sign-in…</div>
              <div className="font-mono text-2xl tracking-widest gradient-text">{pin.code}</div>
              <a href={pin.auth_url} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                Re-open plex.tv link <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </>
      )}

      {status.data?.linked && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <img src={status.data.avatar || "/logo.png"} className="w-10 h-10 rounded-full border border-white/10 object-cover" alt="" />
            <div>
              <div className="font-medium">{status.data.plex_username}</div>
              <div className="text-xs text-zinc-500">{status.data.plex_email}</div>
            </div>
          </div>
          {servers.data?.servers?.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-heading">Select active server</div>
              {servers.data.servers.map((s) => {
                const active = servers.data.selected === s.client_identifier;
                return (
                  <button
                    key={s.client_identifier}
                    data-testid={`select-server-${s.client_identifier}`}
                    onClick={() => selectServer.mutate(s.client_identifier)}
                    className={`w-full text-left p-3 rounded-xl border flex items-center justify-between transition-all ${active ? "border-cyan-400/40 bg-cyan-500/5" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                  >
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-zinc-500 font-mono truncate max-w-xs">{s.uri}</div>
                    </div>
                    {active && <span className="text-xs text-cyan-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button data-testid="plex-unlink" onClick={() => { if (window.confirm("Unlink Plex account?")) unlink.mutate(); }}
            className="text-sm text-red-300 hover:text-red-200 flex items-center gap-2">
            <Unlink className="w-4 h-4" /> Disconnect Plex
          </button>
        </>
      )}
    </div>
  );
}

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
    <div data-testid="dashboard-page" className="space-y-8 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Overview</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Control Panel</h1>
        <p className="text-zinc-400 text-sm mt-2">Manage your Plex link, accounts, and activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard testid="stat-users-total" label="Total Users" value={isLoading ? "—" : data?.users_total ?? 0} icon={Users} accent="purple" />
        <StatCard testid="stat-users-active" label="Active Users" value={isLoading ? "—" : data?.users_active ?? 0} icon={Sparkles} accent="cyan" />
        <StatCard testid="stat-recent-logins" label="Recent Logins (7d)" value={isLoading ? "—" : data?.users_recent_logins_7d ?? 0} icon={Activity} accent="purple" />
        <StatCard testid="stat-plex" label="Plex" value={data?.plex_linked ? "ON" : "OFF"} icon={Server} accent="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1"><PlexLinkPanel /></div>
        <div className="lg:col-span-2 neon-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-lg">Recent Logins</h3>
            <span className="text-xs text-zinc-500 font-mono">last 10 events</span>
          </div>
          <div className="divide-y divide-white/5">
            {(act?.activity || []).length === 0 && (
              <div className="text-sm text-zinc-500 py-6 text-center">No logins yet — once a user signs in on the mobile app they'll appear here.</div>
            )}
            {(act?.activity || []).map((a) => (
              <div key={a.id + (a.at || "")} className="py-3 flex items-center gap-4">
                <img src="/logo.png" className="w-9 h-9 rounded-full border border-white/10 object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{a.display_name || a.username}</div>
                  <div className="text-xs text-zinc-500 font-mono">@{a.username} · {a.action}</div>
                </div>
                <div className="text-xs text-zinc-500 font-mono">{a.at ? new Date(a.at).toLocaleString() : "—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
