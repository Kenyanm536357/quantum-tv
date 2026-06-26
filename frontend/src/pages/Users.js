import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Search, Ban, ShieldCheck, Trash2 } from "lucide-react";

const StatusPill = ({ status }) => {
  const map = {
    active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    banned: "bg-red-500/10 text-red-300 border-red-500/20",
    revoked: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${map[status] || map.active}`}>{status || "active"}</span>;
};

export default function UsersPage() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["users", q],
    queryFn: async () => (await api.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)).data,
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/admin/users/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  const del = useMutation({
    mutationFn: async (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div data-testid="users-page" className="space-y-6 fade-in">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Members</div>
          <h1 className="font-heading text-3xl font-bold mt-1">Users</h1>
          <p className="text-zinc-400 text-sm mt-2">Manage Plex-linked accounts and access.</p>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            data-testid="users-search"
            className="qtv-input pl-10" placeholder="Search by username or email"
            value={q} onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="neon-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 text-xs uppercase tracking-[0.2em] text-zinc-400">
              <th className="text-left py-3 px-5 font-heading font-semibold">User</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Email</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Server</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Status</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Last Login</th>
              <th className="text-right py-3 px-5 font-heading font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && <tr><td colSpan={6} className="py-10 text-center text-zinc-500">Loading…</td></tr>}
            {(data?.users || []).length === 0 && !isLoading && (
              <tr><td colSpan={6} className="py-10 text-center text-zinc-500">No users yet. They appear after signing in with Plex on the mobile app.</td></tr>
            )}
            {(data?.users || []).map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.03]" data-testid={`user-row-${u.id}`}>
                <td className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar || "/logo.png"} className="w-9 h-9 rounded-full border border-white/10 object-cover" alt="" />
                    <div className="font-medium">{u.username || "—"}</div>
                  </div>
                </td>
                <td className="py-3 px-5 text-sm text-zinc-300">{u.email || "—"}</td>
                <td className="py-3 px-5 text-sm text-zinc-300">{u.selected_server || "—"}</td>
                <td className="py-3 px-5"><StatusPill status={u.status} /></td>
                <td className="py-3 px-5 text-sm text-zinc-400 font-mono">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                <td className="py-3 px-5">
                  <div className="flex justify-end gap-2">
                    {u.status !== "banned" ? (
                      <button data-testid={`ban-${u.id}`} onClick={() => setStatus.mutate({ id: u.id, status: "banned" })}
                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-300" title="Ban">
                        <Ban className="w-4 h-4" />
                      </button>
                    ) : (
                      <button data-testid={`unban-${u.id}`} onClick={() => setStatus.mutate({ id: u.id, status: "active" })}
                        className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-emerald-300" title="Restore">
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button data-testid={`delete-${u.id}`} onClick={() => { if (window.confirm(`Delete ${u.username}?`)) del.mutate(u.id); }}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
