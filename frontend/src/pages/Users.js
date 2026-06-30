import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import {
  Search, UserPlus, Trash2, Power, KeyRound, X, Heart, Bookmark,
  RefreshCw, CheckCircle2, Calendar, Smartphone, StickyNote, Settings2, Hash,
} from "lucide-react";

const StatusPill = ({ status }) => {
  const map = {
    active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    disabled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${map[status] || map.active}`}>{status || "active"}</span>;
};

const SubscriptionPill = ({ status, daysLeft }) => {
  const map = {
    active: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Active" },
    expiring: { cls: "bg-amber-500/15 text-amber-200 border-amber-500/30", label: "Expiring" },
    expired: { cls: "bg-red-500/15 text-red-300 border-red-500/30", label: "Expired" },
    inactive: { cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", label: "—" },
  };
  const m = map[status] || map.inactive;
  return (
    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border font-heading ${m.cls}`} data-testid={`sub-pill-${status}`}>
      {m.label}{status === "active" || status === "expiring" ? ` · ${daysLeft}d` : status === "expired" && daysLeft === 0 ? "" : ""}
    </span>
  );
};

function CreateUserModal({ open, onClose, onCreated }) {
  const [u, setU] = useState("");
  const [pw, setPw] = useState("");
  const [dn, setDn] = useState("");
  const [months, setMonths] = useState(1);
  const [maxDevices, setMaxDevices] = useState(3);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null); // { username, password, account_number }

  const create = useMutation({
    mutationFn: async () => (await api.post("/admin/users", {
      username: u.trim(),
      password: pw,
      display_name: dn || undefined,
      status: "active",
      subscription_months: Number(months),
      max_devices: Number(maxDevices),
    })).data,
    onSuccess: (resp) => {
      setCreated({ username: resp.username || u.trim(), password: pw, account_number: resp.account_number || resp.id });
      setErr("");
      onCreated();
    },
    onError: (e) => setErr(e?.response?.data?.detail || "Could not create user"),
  });

  const reset = () => { setU(""); setPw(""); setDn(""); setMonths(1); setMaxDevices(3); setErr(""); setCreated(null); };
  const closeAndReset = () => { reset(); onClose(); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" data-testid="create-user-modal">
      <div className="glass rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 w-full sm:max-w-md relative max-h-[95vh] overflow-y-auto">
        <button onClick={closeAndReset} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 z-10" data-testid="close-create-modal">
          <X className="w-5 h-5" />
        </button>
        {created ? (
          <div className="text-center py-2" data-testid="create-success">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-300" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2">User Created</h3>
            <p className="text-sm text-zinc-400 mb-5">Use these credentials to sign in on the Quantum TV app:</p>
            <div className="bg-[#0b0c1f] border border-cyan-500/30 rounded-xl p-4 text-left space-y-3 mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-heading mb-1">Account #</div>
                <div className="font-mono text-zinc-300 text-sm">{created.account_number}</div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-heading mb-1">Username</div>
                <div className="font-mono text-cyan-200 break-all">{created.username}</div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-heading mb-1">Password</div>
                <div className="font-mono text-cyan-200 break-all">{created.password}</div>
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
            <p className="text-sm text-zinc-400 mb-5">They'll log into the Quantum TV app with these credentials. Login is case-insensitive.</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Subscription</label>
                  <select data-testid="new-months" value={months} onChange={(e) => setMonths(e.target.value)} className="qtv-input mt-2 appearance-none cursor-pointer">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                      <option key={m} value={m}>{m} {m === 1 ? "month" : "months"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Device Slots</label>
                  <input data-testid="new-max-devices" type="number" min="1" max="20" value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} className="qtv-input mt-2" />
                </div>
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

// -------- Manage drawer (subscription / devices / notes) --------
function ManageDrawer({ userId, onClose }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("sub");
  const { data, refetch } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => (await api.get(`/admin/users/${userId}`)).data,
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });
  if (!userId) return null;
  const refreshAll = async () => { await refetch(); await qc.invalidateQueries({ queryKey: ["users"] }); };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" data-testid="manage-drawer">
      <div className="w-full sm:max-w-lg bg-[#0a0b1e] border-l border-white/10 h-full overflow-y-auto p-5 sm:p-7 relative">
        <button onClick={onClose} data-testid="manage-close" className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        {!data ? <div className="text-zinc-400">Loading…</div> : (
          <>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-heading">{data.account_number}</div>
            <h2 className="font-heading text-2xl font-bold mt-1">{data.display_name}</h2>
            <div className="text-xs text-zinc-500 font-mono">@{data.username}</div>

            <div className="mt-5 flex gap-1.5 text-xs">
              {[
                { k: "sub", label: "Subscription", icon: Calendar },
                { k: "dev", label: `Devices · ${data.devices?.length || 0}/${data.max_devices}`, icon: Smartphone },
                { k: "notes", label: `Notes · ${data.notes?.length || 0}`, icon: StickyNote },
              ].map(({ k, label, icon: Icon }) => (
                <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full ${tab === k ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === "sub" && <SubscriptionTab user={data} userId={userId} onChanged={refreshAll} />}
              {tab === "dev" && <DevicesTab user={data} userId={userId} onChanged={refreshAll} />}
              {tab === "notes" && <NotesTab user={data} userId={userId} onChanged={refreshAll} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SubscriptionTab({ user, userId, onChanged }) {
  const [extend, setExtend] = useState(1);
  const ext = useMutation({
    mutationFn: async () => api.patch(`/admin/users/${userId}`, { extend_months: Number(extend) }),
    onSuccess: onChanged,
  });
  const cap = useMutation({
    mutationFn: async (n) => api.patch(`/admin/users/${userId}`, { max_devices: Number(n) }),
    onSuccess: onChanged,
  });
  return (
    <div className="space-y-5">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between"><span className="text-xs text-zinc-400">Status</span><SubscriptionPill status={user.subscription_status} daysLeft={user.days_left} /></div>
        <div className="flex items-center justify-between"><span className="text-xs text-zinc-400">Days left</span><span className="font-mono text-sm">{user.days_left}</span></div>
        <div className="flex items-center justify-between"><span className="text-xs text-zinc-400">Expires</span><span className="font-mono text-xs">{user.expires_at ? new Date(user.expires_at).toLocaleString() : "—"}</span></div>
        <div className="flex items-center justify-between"><span className="text-xs text-zinc-400">Plan</span><span className="text-sm">{user.subscription_months} month{user.subscription_months === 1 ? "" : "s"}</span></div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="text-xs uppercase tracking-widest text-zinc-400 font-heading mb-3">Extend subscription</div>
        <div className="flex items-center gap-2">
          <select data-testid="extend-months" value={extend} onChange={(e) => setExtend(e.target.value)} className="qtv-input !py-2 flex-1">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => <option key={m} value={m}>+ {m} month{m === 1 ? "" : "s"}</option>)}
          </select>
          <button data-testid="apply-extend" onClick={() => ext.mutate()} disabled={ext.isPending} className="btn-gradient px-4 py-2 text-sm">
            {ext.isPending ? "…" : "Apply"}
          </button>
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="text-xs uppercase tracking-widest text-zinc-400 font-heading mb-3">Device slots</div>
        <div className="flex items-center gap-2">
          <input data-testid="set-max-devices" type="number" min="1" max="20" defaultValue={user.max_devices}
            onBlur={(e) => { const n = Number(e.target.value); if (n !== user.max_devices) cap.mutate(n); }}
            className="qtv-input !py-2 flex-1" />
          <span className="text-xs text-zinc-500">tap outside to save</span>
        </div>
      </div>
    </div>
  );
}

function DevicesTab({ user, userId, onChanged }) {
  const setPrimary = useMutation({
    mutationFn: async (deviceId) => api.patch(`/admin/users/${userId}/devices/${deviceId}`, { primary: true }),
    onSuccess: onChanged,
  });
  const del = useMutation({
    mutationFn: async (deviceId) => api.delete(`/admin/users/${userId}/devices/${deviceId}`),
    onSuccess: onChanged,
  });
  if ((user.devices?.length || 0) === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-zinc-400 text-sm">
        <Smartphone className="w-8 h-8 mx-auto mb-3 text-purple-400" />
        No devices yet. The first time the user signs in on a Fire Stick / phone, that device will auto-register here.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {user.devices.map((d) => (
        <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-4" data-testid={`device-${d.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{d.name || "Device"}</span>
                {d.primary && <span className="text-[9px] uppercase tracking-widest text-cyan-300 bg-cyan-500/15 border border-cyan-400/30 px-1.5 py-0.5 rounded-full">PRIMARY</span>}
              </div>
              <div className="text-xs text-zinc-500 font-mono mt-1 break-all">{d.model || "—"} · {d.id}</div>
              <div className="text-[10px] text-zinc-500 mt-1">Active since {d.registered_at ? new Date(d.registered_at).toLocaleDateString() : "—"} · Last seen {d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}</div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {!d.primary && (
                <button data-testid={`set-primary-${d.id}`} onClick={() => setPrimary.mutate(d.id)} className="px-3 py-1.5 rounded-full text-[10px] bg-white/5 hover:bg-cyan-500/20 text-cyan-300">Set primary</button>
              )}
              <button data-testid={`remove-device-${d.id}`} onClick={() => { if (window.confirm("Remove this device?")) del.mutate(d.id); }} className="px-3 py-1.5 rounded-full text-[10px] bg-white/5 hover:bg-red-500/20 text-red-300">Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ user, userId, onChanged }) {
  const [text, setText] = useState("");
  const add = useMutation({
    mutationFn: async () => api.post(`/admin/users/${userId}/notes`, { text }),
    onSuccess: () => { setText(""); onChanged(); },
  });
  const del = useMutation({
    mutationFn: async (id) => api.delete(`/admin/users/${userId}/notes/${id}`),
    onSuccess: onChanged,
  });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input data-testid="note-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note about this subscriber…" className="qtv-input !py-2 flex-1" />
        <button data-testid="add-note" onClick={() => add.mutate()} disabled={!text.trim() || add.isPending} className="btn-gradient px-4 py-2 text-sm disabled:opacity-50">Add</button>
      </div>
      {(user.notes?.length || 0) === 0 && <div className="text-sm text-zinc-500 text-center py-6">No notes yet.</div>}
      {user.notes?.map((n) => (
        <div key={n.id} className="bg-white/5 border border-white/10 rounded-xl p-4" data-testid={`note-${n.id}`}>
          <div className="text-sm">{n.text}</div>
          <div className="text-[10px] text-zinc-500 mt-2 flex items-center justify-between">
            <span>{new Date(n.created_at).toLocaleString()} · {n.author}</span>
            <button onClick={() => del.mutate(n.id)} className="text-zinc-400 hover:text-red-300">Delete</button>
          </div>
        </div>
      ))}
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
  const [managing, setManaging] = useState(null);
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["users", q],
    queryFn: async () => (await api.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)).data,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 20000,
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

  const users = data?.users || [];

  return (
    <div data-testid="users-page" className="space-y-6 fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Members</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">Subscribers</h1>
          <p className="text-zinc-400 text-sm mt-2">Manage login accounts, subscription length, devices and notes.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input data-testid="users-search" className="qtv-input pl-10" placeholder="Search username / account #" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button data-testid="refresh-users" onClick={() => refetch()} title="Refresh user list" className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 shrink-0 active:bg-white/20" aria-label="Refresh users list">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-cyan-300" : ""}`} />
          </button>
          <button data-testid="open-create-user" onClick={() => setCreating(true)} className="btn-gradient px-4 sm:px-5 py-3 flex items-center gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">New user</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <div className="text-[11px] text-zinc-500 -mt-3" data-testid="users-updated">
        {isFetching ? "Refreshing…" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : ""}
        {data?.users && <span className="ml-2 text-zinc-600">· {data.users.length} {data.users.length === 1 ? "subscriber" : "subscribers"}</span>}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading && <div className="neon-card p-6 text-center text-zinc-500">Loading…</div>}
        {users.length === 0 && !isLoading && (
          <div className="neon-card p-8 text-center" data-testid="users-empty-mobile">
            <UserPlus className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <div className="font-heading font-semibold mb-1">No subscribers yet</div>
            <div className="text-sm text-zinc-400">Tap <span className="text-cyan-300 font-semibold">New</span> above to create your first one.</div>
          </div>
        )}
        {users.map((u) => (
          <div key={u.id} className="neon-card p-4" data-testid={`user-card-${u.username}`}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-heading font-bold shrink-0">
                {(u.display_name || u.username).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.display_name || u.username}</div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">@{u.username} · {u.account_number || "—"}</div>
                <div className="flex items-center flex-wrap gap-1.5 mt-2">
                  <SubscriptionPill status={u.subscription_status} daysLeft={u.days_left} />
                  <StatusPill status={u.status} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1"><Smartphone className="w-3 h-3 text-cyan-400" /> {u.devices_count}/{u.max_devices}</span>
              <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3 text-cyan-400" /> {u.watchlist_count}</span>
              <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3 text-pink-400" /> {u.favorites_count}</span>
              <span className="ml-auto text-[10px] text-zinc-500">Exp {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : "—"}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              {resetting === u.id ? (
                <ResetPasswordPrompt userId={u.id} onDone={() => setResetting(null)} />
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  <button data-testid={`manage-${u.username}-mobile`} onClick={() => setManaging(u.id)} className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 hover:bg-purple-500/20 text-purple-200 text-[10px]">
                    <Settings2 className="w-3 h-3" /> Manage
                  </button>
                  <button data-testid={`reset-${u.username}-mobile`} onClick={() => setResetting(u.id)} className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-cyan-300 text-[10px]">
                    <KeyRound className="w-3 h-3" /> PW
                  </button>
                  <button data-testid={(u.status === "active" ? `disable-${u.username}` : `enable-${u.username}`) + "-mobile"}
                    onClick={() => setStatus.mutate({ id: u.id, status: u.status === "active" ? "disabled" : "active" })}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 text-[10px] ${u.status === "active" ? "hover:bg-yellow-500/20 text-yellow-300" : "hover:bg-emerald-500/20 text-emerald-300"}`}>
                    <Power className="w-3 h-3" /> {u.status === "active" ? "Off" : "On"}
                  </button>
                  <button data-testid={`delete-${u.username}-mobile`} onClick={() => { if (window.confirm(`Delete ${u.username}?`)) del.mutate(u.id); }} className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400 text-[10px]">
                    <Trash2 className="w-3 h-3" /> Del
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block neon-card overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="bg-white/5 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
              <th className="text-left py-3 px-4 font-heading font-semibold"><Hash className="inline w-3 h-3 mr-1 -mt-0.5" /> Acct #</th>
              <th className="text-left py-3 px-4 font-heading font-semibold">Subscriber</th>
              <th className="text-left py-3 px-4 font-heading font-semibold">Status</th>
              <th className="text-left py-3 px-4 font-heading font-semibold">Subscription</th>
              <th className="text-left py-3 px-4 font-heading font-semibold">Expires</th>
              <th className="text-left py-3 px-4 font-heading font-semibold">Devices</th>
              <th className="text-left py-3 px-4 font-heading font-semibold">Last Activity</th>
              <th className="text-right py-3 px-4 font-heading font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && <tr><td colSpan={8} className="py-10 text-center text-zinc-500">Loading…</td></tr>}
            {users.length === 0 && !isLoading && (
              <tr><td colSpan={8} className="py-12 text-center" data-testid="users-empty-desktop">
                <UserPlus className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <div className="font-heading font-semibold mb-1">No subscribers yet</div>
                <div className="text-sm text-zinc-400">Click <span className="text-cyan-300 font-semibold">New user</span> above to create one.</div>
              </td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.03]" data-testid={`user-row-${u.username}`}>
                <td className="py-3 px-4 font-mono text-xs text-zinc-300">{u.account_number || "—"}</td>
                <td className="py-3 px-4">
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
                <td className="py-3 px-4"><StatusPill status={u.status} /></td>
                <td className="py-3 px-4"><SubscriptionPill status={u.subscription_status} daysLeft={u.days_left} /></td>
                <td className="py-3 px-4 text-xs text-zinc-300 font-mono">{u.expires_at ? new Date(u.expires_at).toLocaleDateString() : "—"}</td>
                <td className="py-3 px-4 text-xs text-zinc-300"><span className="inline-flex items-center gap-1"><Smartphone className="w-3 h-3 text-cyan-400" /> {u.devices_count}/{u.max_devices}</span></td>
                <td className="py-3 px-4 text-xs text-zinc-400 font-mono">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1.5 items-center">
                    <button data-testid={`manage-${u.username}`} onClick={() => setManaging(u.id)} title="Manage" className="p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 text-purple-200"><Settings2 className="w-4 h-4" /></button>
                    {resetting === u.id ? (
                      <ResetPasswordPrompt userId={u.id} onDone={() => setResetting(null)} />
                    ) : (
                      <button data-testid={`reset-${u.username}`} onClick={() => setResetting(u.id)} title="Reset password" className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-cyan-300"><KeyRound className="w-4 h-4" /></button>
                    )}
                    <button data-testid={u.status === "active" ? `disable-${u.username}` : `enable-${u.username}`}
                      onClick={() => setStatus.mutate({ id: u.id, status: u.status === "active" ? "disabled" : "active" })}
                      title={u.status === "active" ? "Disable" : "Enable"}
                      className={`p-2 rounded-lg bg-white/5 ${u.status === "active" ? "hover:bg-yellow-500/20 text-yellow-300" : "hover:bg-emerald-500/20 text-emerald-300"}`}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button data-testid={`delete-${u.username}`} onClick={() => { if (window.confirm(`Delete ${u.username}?`)) del.mutate(u.id); }} className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-400" title="Delete">
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
          await qc.invalidateQueries({ queryKey: ["users"] });
          await refetch();
        }}
      />
      {managing && <ManageDrawer userId={managing} onClose={() => setManaging(null)} />}
    </div>
  );
}
