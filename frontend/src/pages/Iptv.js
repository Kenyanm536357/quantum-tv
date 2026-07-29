import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Cable, CheckCircle2, AlertTriangle, Tv, Film, Loader2, Unlink } from "lucide-react";

export default function Iptv() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["iptv-status"],
    queryFn: async () => (await api.get("/admin/iptv/status")).data,
    refetchOnWindowFocus: true,
  });

  const [url, setUrl] = useState("");
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(null);

  const connect = useMutation({
    mutationFn: async () => (await api.post("/admin/iptv/connect", { url, username: user, password: pw })).data,
    onSuccess: (d) => {
      setErr(""); setOk(d);
      setUrl(""); setUser(""); setPw("");
      qc.invalidateQueries({ queryKey: ["iptv-status"] });
    },
    onError: (e) => { setErr(e?.response?.data?.detail || "Could not connect"); setOk(null); },
  });
  const disconnect = useMutation({
    mutationFn: async () => api.delete("/admin/iptv"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iptv-status"] }),
  });

  const cfg = status.data;
  const ui = cfg?.user_info || {};

  return (
    <div data-testid="iptv-page" className="space-y-6 fade-in max-w-3xl">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">External</div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">IPTV Provider</h1>
        <p className="text-zinc-400 text-sm mt-2">Connect any Xtream Codes line to stream live channels and movies in the Quantum TV apps.</p>
      </div>

      {cfg?.configured ? (
        <div className="neon-card p-5 sm:p-6 space-y-4" data-testid="iptv-connected-card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="font-heading font-semibold text-lg">Connected</div>
                <div className="text-xs text-zinc-500 font-mono">{cfg.url}</div>
              </div>
            </div>
            <button
              data-testid="iptv-disconnect"
              onClick={() => { if (window.confirm("Disconnect IPTV provider?")) disconnect.mutate(); }}
              className="px-4 py-2 rounded-full bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs flex items-center gap-2 border border-red-500/20"
            >
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Status" value={ui.status} accent={ui.status === "Active" ? "emerald" : "amber"} />
            <Stat label="Expires" value={ui.exp_date ? new Date(Number(ui.exp_date) * 1000).toLocaleDateString() : "—"} />
            <Stat label="Connections" value={`${ui.active_cons ?? "?"} / ${ui.max_connections ?? "?"}`} />
            <Stat label="Username" value={<span className="font-mono">{cfg.username}</span>} />
          </div>
          <div className="border-t border-white/5 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChannelCount kind="live" />
            <ChannelCount kind="vod" />
          </div>
          <div className="text-xs text-zinc-500">
            Stream URLs are server-proxied so subscriber credentials never reach the client.
          </div>
        </div>
      ) : (
        <div className="neon-card p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cable className="w-5 h-5 text-purple-400" />
            <h3 className="font-heading font-semibold text-lg">Connect Xtream Codes Line</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Server URL</label>
              <input data-testid="iptv-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://line.example.com" className="qtv-input mt-2" autoCapitalize="none" autoCorrect="off" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Username</label>
                <input data-testid="iptv-username" value={user} onChange={(e) => setUser(e.target.value)} className="qtv-input mt-2" autoCapitalize="none" autoCorrect="off" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Password</label>
                <input data-testid="iptv-password" value={pw} onChange={(e) => setPw(e.target.value)} className="qtv-input mt-2" type="text" autoCapitalize="none" autoCorrect="off" />
              </div>
            </div>
            {err && <div data-testid="iptv-error" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {err}</div>}
            {ok && <div data-testid="iptv-ok" className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/20 rounded-lg px-3 py-2">Connected. {ok.max_connections} max connections, expires {ok.exp_date ? new Date(Number(ok.exp_date) * 1000).toLocaleDateString() : "—"}.</div>}
            <button
              data-testid="iptv-connect"
              disabled={!url || !user || !pw || connect.isPending}
              onClick={() => connect.mutate()}
              className="btn-gradient w-full py-3 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {connect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {connect.isPending ? "Connecting…" : "Connect IPTV provider"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value, accent }) => (
  <div className={`rounded-xl border px-3 py-2 ${accent === "emerald" ? "bg-emerald-500/10 border-emerald-500/30" : accent === "amber" ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10"}`}>
    <div className="text-[9px] uppercase tracking-widest text-zinc-400 font-heading mb-1">{label}</div>
    <div className="text-sm font-medium">{value || "—"}</div>
  </div>
);

const ChannelCount = ({ kind }) => {
  const q = useQuery({
    queryKey: [`iptv-${kind}-count`],
    queryFn: async () => (await api.get(kind === "live" ? "/iptv/live/streams" : "/iptv/vod/streams")).data,
    staleTime: 60_000,
  });
  const Icon = kind === "live" ? Tv : Film;
  const label = kind === "live" ? "Live Channels" : "Movies (VOD)";
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${kind === "live" ? "text-cyan-400" : "text-purple-400"}`} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-heading">{label}</div>
        <div className="text-lg font-heading font-bold">{q.isLoading ? "…" : (q.data?.total ?? 0).toLocaleString()}</div>
      </div>
    </div>
  );
};
