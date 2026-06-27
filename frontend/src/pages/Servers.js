import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Server, Globe, Users as UsersIcon, CheckCircle2, Crown } from "lucide-react";

export default function Servers() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-servers"],
    queryFn: async () => (await api.get("/admin/servers")).data,
  });
  const select = useMutation({
    mutationFn: async (cid) => api.post("/admin/plex/servers/select", { client_identifier: cid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-servers"] });
      qc.invalidateQueries({ queryKey: ["plex-status"] });
    },
  });

  return (
    <div data-testid="servers-page" className="space-y-6 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Plex</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Servers</h1>
        <p className="text-zinc-400 text-sm mt-2">Every Plex server reachable from your linked account. Click one to make it the active source for all users.</p>
      </div>
      {isLoading && <div className="text-zinc-500">Loading…</div>}
      {(data?.servers || []).length === 0 && !isLoading && (
        <div className="neon-card p-10 text-center">
          <Server className="w-10 h-10 text-purple-400 mx-auto mb-3" />
          <div className="font-heading font-semibold">No Plex servers found</div>
          <div className="text-sm text-zinc-400 mt-2">Link a Plex account in Dashboard → Plex Connection to populate this list.</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(data?.servers || []).map((s) => (
          <button
            key={s.client_identifier}
            data-testid={`server-${s.client_identifier}`}
            onClick={() => select.mutate(s.client_identifier)}
            className={`neon-card p-6 text-left transition-all ${s.active ? "ring-2 ring-cyan-400/40 bg-cyan-500/5" : "hover:bg-white/[0.03]"}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Server</div>
                  {s.owned && <span title="Owned by you"><Crown className="w-3 h-3 text-yellow-400" /></span>}
                </div>
                <div className="font-heading font-bold text-xl mt-1 truncate">{s.name}</div>
              </div>
              {s.active ? (
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                  Click to use
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs break-all"><Globe className="w-3 h-3" />{s.uri || "—"}</div>
              <div className="flex items-center gap-2 text-zinc-400">
                <UsersIcon className="w-3 h-3" />
                {s.active
                  ? <>{s.user_count} active user{s.user_count === 1 ? "" : "s"} streaming{s.user_count > 0 ? `: ${s.users.slice(0, 3).join(", ")}${s.users.length > 3 ? "…" : ""}` : ""}</>
                  : <>Inactive — pick this server to route users here</>
                }
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
