import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { Server, Globe, Users as UsersIcon } from "lucide-react";

export default function Servers() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-servers"],
    queryFn: async () => (await api.get("/admin/servers")).data,
  });
  return (
    <div data-testid="servers-page" className="space-y-6 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Connected</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Plex Servers</h1>
        <p className="text-zinc-400 text-sm mt-2">Every Plex server connected by your users, in one view.</p>
      </div>
      {isLoading && <div className="text-zinc-500">Loading…</div>}
      {(data?.servers || []).length === 0 && !isLoading && (
        <div className="neon-card p-10 text-center">
          <Server className="w-10 h-10 text-purple-400 mx-auto mb-3" />
          <div className="font-heading font-semibold">No Plex servers yet</div>
          <div className="text-sm text-zinc-400 mt-2">Once a user signs in with Plex on the mobile app, their servers show up here.</div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(data?.servers || []).map((s) => (
          <div key={s.client_identifier} data-testid={`server-${s.client_identifier}`} className="neon-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Server</div>
                <div className="font-heading font-bold text-xl mt-1">{s.name}</div>
              </div>
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <Server className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs break-all"><Globe className="w-3 h-3" />{s.uri || "—"}</div>
              <div className="flex items-center gap-2 text-zinc-400"><UsersIcon className="w-3 h-3" />{s.users?.length || 0} user(s): {s.users?.join(", ") || "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
