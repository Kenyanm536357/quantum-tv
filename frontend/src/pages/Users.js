import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Search, UserPlus, Trash2, Power, KeyRound, X, Heart, Bookmark, RefreshCw, CheckCircle2 } from "lucide-react";

const StatusPill = ({ status }) => {
  const map = {
    active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    disabled: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${map[status] || map.active}`}>{status || "active"}</span>;
};

function CreateUserModal({ open, onClose, onCreated }) {
  const [u, setU] = useState("");
  const [pw, setPw] = useState("");
  const [dn, setDn] = useState("");
  const [err, setErr] = useState("");
  const [createdUser, setCreatedUser] = useState(null); // {username, password} after success
  const create = useMutation({
    mutationFn: async () => (await api.post("/admin/users", { username: u.trim(), password: pw, display_name: dn || undefined, status: "active" })).data,
    onSuccess: (resp) => {
      setCreatedUser({ username: resp.username || u.trim(), password: pw });
      setErr("");
      onCreated(); // triggers cache invalidation → list re-fetches in background
    },
    onError: (e) => setErr(e?.response?.data?.detail || "Could not create user"),
  });
  const reset = () => { setU(""); setPw(""); setDn(""); setErr(""); setCreatedUser(null); };
  const closeAndReset = () => { reset(); onClose(); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" data-testid="create-user-modal">
      <div className="glass rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 w-full sm:max-w-md relative max-h-[95vh] overflow-y-auto">
        <button onClick={closeAndReset} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 z-10" data-testid="close-create-modal">
          <X className="w-5 h-5" />
        </button>

        {createdUser ? (
          <div className="text-center py-2" data-testid="create-success">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-300" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2">User Created</h3>
            <p className="text-sm text-zinc-400 mb-5">Use these credentials to sign in on the Quantum TV app:</p>
            <div className="bg-[#0b0c1f] border border-cyan-500/30 rounded-xl p-4 text-left space-y-3 mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-heading mb-1">Username</div>
                <div className="font-mono text-cyan-200 break-all">{createdUser.username}</div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-heading mb-1">Password</div>
                <div className="font-mono text-cyan-200 break-all">{createdUser.password}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button data-testid="create-another" onClick={reset} className="flex-1 py-3 rounded-full bg-white/5 hover:bg-white/10 text-sm">Create another</button>
              <button data-testid="done-create" onClick={closeAndReset} className="btn-gradient flex-1 py-3 text-sm">Done</button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-heading text-xl font-bold mb-2">Create User</h3>
            <p className="text-sm text-zinc-400 mb-5">They'll log into the Quantum TV mobile app with these credentials. Login is case-insensitive.</p>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Username</label>
                <input data-testid="new-username" className="qtv-input mt-2" value={u} onChange={(e) => setU(e.target.value)} placeholder="e.g. ben" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Password</label>
                <input data-testid="new-password" className="qtv-input mt-2" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Display Name (optional)</label>
                <input data-testid="new-displayname" className="qtv-input mt-2" value={dn} onChange={(e) => setDn(e.target.value)} placeholder="Ben" />
              </div>
              {err && <div data-testid="create-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}
              <button data-testid="submit-create-user" disabled={!u || !pw || create.isPending}
                onClick={() => create.mutate()} className="btn-gradient w-full py-3 disabled:opacity-50">
                {create.isPending ? "Creating…" : "Create user"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResetPasswordPrompt({ userId, onDone }) {
  const [pw, setPw] = useState("");
  const reset = useMutation({
    mutationFn: async () => api.patch(`/admin/users/${userId}`, { password: pw }),
    onSuccess: () => { setPw(""); onDone(); },
  });
  return (
    <div className="flex items-center gap-2 w-full">
      <input data-testid={`pw-${userId}`} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="new password"
        className="qtv-input !py-2 !px-3 !text-sm flex-1 sm:w-44 sm:flex-none" />
      <button data-testid={`save-pw-${userId}`} disabled={!pw} onClick={() => reset.mutate()}
        className="btn-gradient px-4 py-2 text-sm disabled:opacity-50 shrink-0">Save</button>
      <button onClick={onDone} className="text-zinc-400 hover:text-white text-sm px-2">Cancel</button>
    </div>
  );
}

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["users", q],
    queryFn: async () => (await api.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)).data,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 20000, // poll every 20s so the list stays fresh while the page is open
    staleTime: 0,
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
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Members</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">Users</h1>
          <p className="text-zinc-400 text-sm mt-2">Create login accounts for the mobile app. Disabled users cannot sign in.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input data-testid="users-search" className="qtv-input pl-10" placeholder="Search username"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button
            data-testid="refresh-users"
            onClick={() => refetch()}
            title="Refresh user list"
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 shrink-0 active:bg-white/20"
            aria-label="Refresh users list"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-cyan-300" : ""}`} />
          </button>
          <button data-testid="open-create-user" onClick={() => setCreating(true)} className="btn-gradient px-4 sm:px-5 py-3 flex items-center gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">New user</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Last-updated indicator */}
      <div className="text-[11px] text-zinc-500 -mt-3" data-testid="users-updated">
        {isFetching ? "Refreshing…" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}
        {data?.users && <span className="ml-2 text-zinc-600">· {data.users.length} {data.users.length === 1 ? "user" : "users"}</span>}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading && <div className="neon-card p-6 text-center text-zinc-500">Loading…</div>}
        {(data?.users || []).length === 0 && !isLoading && (
          <div className="neon-card p-8 text-center" data-testid="users-empty-mobile">
            <UserPlus className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <div className="font-heading font-semibold mb-1">No users yet</div>
            <div className="text-sm text-zinc-400">Tap <span className="text-cyan-300 font-semibold">New</span> above to create your first user.</div>
          </div>
        )}
        {(data?.users || []).map((u) => (
          <div key={u.id} className="neon-card p-4" data-testid={`user-card-${u.username}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-heading font-bold shrink-0">
                {(u.display_name || u.username).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.display_name || u.username}</div>
                <div className="text-xs text-zinc-500 font-mono truncate">@{u.username}</div>
              </div>
              <StatusPill status={u.status} />
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400 font-mono">
              <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3 text-cyan-400" /> {u.watchlist_count}</span>
              <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400" /> {u.favorites_count}</span>
              <span className="ml-auto text-zinc-500">{u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              {resetting === u.id ? (
                <ResetPasswordPrompt userId={u.id} onDone={() => setResetting(null)} />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button data-testid={`reset-${u.username}`} onClick={() => setResetting(u.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-cyan-300 text-xs">
                    <KeyRound className="w-3.5 h-3.5" /> Password
                  </button>
                  <button
                    data-testid={u.status === "active" ? `disable-${u.username}` : `enable-${u.username}`}
                    onClick={() => setStatus.mutate({ id: u.id, status: u.status === "active" ? "disabled" : "active" })}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/5 text-xs ${u.status === "active" ? "hover:bg-yellow-500/20 text-yellow-300" : "hover:bg-emerald-500/20 text-emerald-300"}`}>
                    <Power className="w-3.5 h-3.5" /> {u.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button data-testid={`delete-${u.username}`} onClick={() => { if (window.confirm(`Delete ${u.username}?`)) del.mutate(u.id); }}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400 text-xs">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block neon-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 text-xs uppercase tracking-[0.2em] text-zinc-400">
              <th className="text-left py-3 px-5 font-heading font-semibold">User</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Status</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Lists</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Last Login</th>
              <th className="text-right py-3 px-5 font-heading font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && <tr><td colSpan={5} className="py-10 text-center text-zinc-500">Loading…</td></tr>}
            {(data?.users || []).length === 0 && !isLoading && (
              <tr><td colSpan={5} className="py-12 text-center" data-testid="users-empty-desktop">
                <UserPlus className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <div className="font-heading font-semibold mb-1">No users yet</div>
                <div className="text-sm text-zinc-400">Click <span className="text-cyan-300 font-semibold">New user</span> above to create one.</div>
              </td></tr>
            )}
            {(data?.users || []).map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.03]" data-testid={`user-row-${u.username}`}>
                <td className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-heading font-bold text-sm">
                      {(u.display_name || u.username).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{u.display_name || u.username}</div>
                      <div className="text-xs text-zinc-500 font-mono">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-5"><StatusPill status={u.status} /></td>
                <td className="py-3 px-5 text-xs text-zinc-400 font-mono">
                  <span className="inline-flex items-center gap-1 mr-3"><Bookmark className="w-3 h-3 text-cyan-400" /> {u.watchlist_count}</span>
                  <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400" /> {u.favorites_count}</span>
                </td>
                <td className="py-3 px-5 text-sm text-zinc-400 font-mono">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                <td className="py-3 px-5">
                  <div className="flex justify-end gap-2 items-center">
                    {resetting === u.id ? (
                      <ResetPasswordPrompt userId={u.id} onDone={() => setResetting(null)} />
                    ) : (
                      <button data-testid={`reset-${u.username}`} onClick={() => setResetting(u.id)} title="Reset password"
                        className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-cyan-300"><KeyRound className="w-4 h-4" /></button>
                    )}
                    <button
                      data-testid={u.status === "active" ? `disable-${u.username}` : `enable-${u.username}`}
                      onClick={() => setStatus.mutate({ id: u.id, status: u.status === "active" ? "disabled" : "active" })}
                      title={u.status === "active" ? "Disable" : "Enable"}
                      className={`p-2 rounded-lg bg-white/5 ${u.status === "active" ? "hover:bg-yellow-500/20 text-yellow-300" : "hover:bg-emerald-500/20 text-emerald-300"}`}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button data-testid={`delete-${u.username}`} onClick={() => { if (window.confirm(`Delete ${u.username}?`)) del.mutate(u.id); }}
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

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          // Force-refetch immediately and bust any caches so the new user appears.
          await qc.invalidateQueries({ queryKey: ["users"] });
          await refetch();
        }}
      />
    </div>
  );
}
