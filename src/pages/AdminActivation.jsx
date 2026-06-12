import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const ALLOWED_EMAILS = ['kenyan@quantumtek.net', 'kenyanmcgarr@gmail.com'];
import {
  Monitor, CheckCircle, XCircle, Plus, Trash2, Loader2,
  RefreshCw, Shield, Lock, LockOpen, User, Calendar, Clock,
  Tv2, Signal, AlertTriangle, ChevronDown, Pencil, X,
  LayoutGrid, List, Columns2
} from 'lucide-react';

const ADMIN_PASSCODE = 'quantum-admin-2024';

const DURATION_OPTIONS = [
  { label: '1 Month',   months: 1,  color: 'from-slate-600 to-slate-500' },
  { label: '6 Months',  months: 6,  color: 'from-violet-600 to-purple-500' },
  { label: '12 Months', months: 12, color: 'from-cyan-600 to-teal-500' },
];

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpired(expires_at) {
  if (!expires_at) return false;
  return new Date(expires_at) < new Date();
}

function daysLeft(expires_at) {
  if (!expires_at) return null;
  return Math.ceil((new Date(expires_at) - new Date()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ activated, expires_at, locked }) {
  const expired = isExpired(expires_at);
  const days = daysLeft(expires_at);

  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
        <Lock className="w-3 h-3" /> LOCKED
      </span>
    );
  }
  if (activated && !expired) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        ACTIVE {days !== null && days <= 30 ? `· ${days}d left` : ''}
      </span>
    );
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/15 border border-orange-500/30 text-orange-400">
        <AlertTriangle className="w-3 h-3" /> EXPIRED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 border border-red-500/30 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> INACTIVE
    </span>
  );
}

function StatCard({ icon: IconComp, label, value, color }) {
  const Icon = IconComp;
  return (
    <div className="bg-white/3 border border-white/8 rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        <p className="text-xs text-white/40">{label}</p>
      </div>
    </div>
  );
}

function DeviceCard({ dev, onActivate, onDeactivate, onRenew, onDelete, onLock, onEdit, isLoading }) {
  const expired = isExpired(dev.expires_at);
  const days    = daysLeft(dev.expires_at);
  const active  = dev.activated && !expired;
  const locked  = !!dev.locked;

  const [showRenew, setShowRenew] = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);
  const [editUser,  setEditUser]  = useState(dev.username || '');
  const [editLabel, setEditLabel] = useState(dev.label || '');
  const [renewMonths, setRenewMonths] = useState(1);

  const handleRenew = () => { onRenew(dev.id, dev.mac, renewMonths, dev.expires_at); setShowRenew(false); };
  const handleEdit  = () => { onEdit(dev.id, { username: editUser.trim(), label: editLabel.trim() }); setShowEdit(false); };

  const borderColor = locked
    ? 'border-yellow-500/25'
    : active ? 'border-emerald-500/20' : expired ? 'border-orange-500/15' : 'border-white/8';
  const bgColor = locked
    ? 'bg-gradient-to-br from-yellow-950/30 to-[#080c14]'
    : active ? 'bg-gradient-to-br from-emerald-950/40 to-[#080c14]'
    : expired ? 'bg-gradient-to-br from-orange-950/30 to-[#080c14]'
    : 'bg-gradient-to-br from-[#0d1117] to-[#080c14]';
  const barColor = locked
    ? 'bg-gradient-to-r from-yellow-500 to-amber-400'
    : active ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
    : expired ? 'bg-gradient-to-r from-orange-500 to-amber-400'
    : 'bg-gradient-to-r from-slate-700 to-slate-600';

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all ${bgColor} ${borderColor}`}>
      <div className={`h-0.5 w-full ${barColor}`} />

      <div className="p-5">
        {/* Top row: info + status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <p className="font-mono text-xs text-white/40 truncate">{dev.mac}</p>
            </div>
            {dev.username && (
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <p className="text-base font-black text-white truncate">{dev.username}</p>
              </div>
            )}
          </div>
          <StatusBadge activated={dev.activated} expires_at={dev.expires_at} locked={locked} />
        </div>

        {/* Expiry bar */}
        {dev.expires_at && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/30 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Expires {formatDate(dev.expires_at)}
              </span>
              {days !== null && (
                <span className={`text-[11px] font-bold ${days <= 0 ? 'text-orange-400' : days <= 7 ? 'text-red-400' : days <= 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {days > 0 ? `${days}d left` : 'Expired'}
                </span>
              )}
            </div>
            {days !== null && (
              <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${days <= 0 ? 'bg-orange-400' : days <= 7 ? 'bg-red-400' : days <= 30 ? 'bg-yellow-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Edit panel */}
        {showEdit && (
          <div className="mb-3 p-3 rounded-xl bg-violet-500/8 border border-violet-500/20 space-y-2">
            <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider">Edit Customer</p>
            <input value={editUser} onChange={e => setEditUser(e.target.value)} placeholder="Username"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-violet-300 placeholder-white/15 outline-none focus:border-violet-500/40 transition-all" />
            <div className="flex gap-2">
              <button onClick={handleEdit} disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-500/20 border border-violet-500/40 text-violet-300 rounded-lg text-xs font-bold hover:bg-violet-500/30 transition-colors disabled:opacity-50">
                <CheckCircle className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={() => setShowEdit(false)}
                className="px-3 py-2 bg-white/4 border border-white/8 text-white/30 rounded-lg text-xs font-bold hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Renew panel */}
        {showRenew && (
          <div className="mb-3 p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/20 space-y-2">
            <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Extend Subscription</p>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATION_OPTIONS.map(o => (
                <button key={o.months} onClick={() => setRenewMonths(o.months)}
                  className={`py-2 rounded-lg text-[11px] font-bold border transition-all ${renewMonths === o.months ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-white/4 border-white/8 text-white/40 hover:text-white'}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25">
              New expiry: <span className="text-emerald-400 font-bold">{formatDate(addMonths(dev.expires_at || new Date(), renewMonths))}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={handleRenew} disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-colors disabled:opacity-50">
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Confirm
              </button>
              <button onClick={() => setShowRenew(false)}
                className="px-3 py-2 bg-white/4 border border-white/8 text-white/30 rounded-lg text-xs font-bold hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isLoading && !showRenew && !showEdit ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {/* Renew */}
            <button onClick={() => { setShowRenew(s => !s); setShowEdit(false); }}
              title="Renew"
              className="flex flex-col items-center gap-1 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-bold hover:bg-cyan-500/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Renew
            </button>
            {/* Edit */}
            <button onClick={() => { setShowEdit(s => !s); setShowRenew(false); }}
              title="Edit"
              className="flex flex-col items-center gap-1 py-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl text-[10px] font-bold hover:bg-violet-500/20 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            {/* Lock / Unlock */}
            <button onClick={() => onLock(dev.id, !locked)}
              title={locked ? 'Unlock' : 'Lock'}
              className={`flex flex-col items-center gap-1 py-2 border rounded-xl text-[10px] font-bold transition-colors ${
                locked
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20'
              }`}>
              {locked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {locked ? 'Unlock' : 'Lock'}
            </button>
            {/* Delete */}
            <button onClick={() => onDelete(dev.id)}
              title="Delete"
              className="flex flex-col items-center gap-1 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] font-bold hover:bg-red-500/20 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminActivation() {
  const { user, isLoadingAuth } = useAuth();
  const [authed, setAuthed]           = useState(false);
  const [passcode, setPasscode]       = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [devices, setDevices]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [actionId, setActionId]       = useState(null);

  const [newMac,      setNewMac]      = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newMonths,   setNewMonths]   = useState(1);

  const generateRandomMac = () => {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    setNewMac(`${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`);
  };

  const formatMacInput = (val) => {
    // Strip non-hex chars, uppercase, insert colons every 2 chars
    const clean = val.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 12);
    const parts = clean.match(/.{1,2}/g) || [];
    setNewMac(parts.join(':'));
  };
  const [viewMode,    setViewMode]    = useState('grid3'); // 'grid1' | 'grid2' | 'grid3' | 'list'

  const handlePasscode = (e) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      setAuthed(true);
    } else {
      setPasscodeError('Incorrect passcode.');
      setPasscode('');
    }
  };

  const loadDevices = async () => {
    setLoading(true);
    const data = await base44.entities.DeviceActivation.list('-created_date', 100);
    setDevices(data);
    setLoading(false);
  };

  useEffect(() => { if (authed) loadDevices(); }, [authed]);

  const activate = async (mac, id, months) => {
    setActionId(id);
    await base44.functions.invoke('checkActivation', { mac, action: 'activate', adminKey: ADMIN_PASSCODE });
    const expires = addMonths(new Date(), months || 1);
    await base44.entities.DeviceActivation.update(id, { activated: true, activated_at: new Date().toISOString(), expires_at: expires });
    await loadDevices();
    setActionId(null);
  };

  const renew = async (id, mac, months, currentExpiry) => {
    setActionId(id);
    // Extend from current expiry if still valid, otherwise extend from today
    const base = currentExpiry && new Date(currentExpiry) > new Date() ? currentExpiry : new Date().toISOString();
    const newExpiry = addMonths(base, months);
    await base44.entities.DeviceActivation.update(id, { activated: true, expires_at: newExpiry });
    await loadDevices();
    setActionId(null);
  };

  const deactivate = async (mac, id) => {
    setActionId(id);
    await base44.functions.invoke('checkActivation', { mac, action: 'deactivate', adminKey: ADMIN_PASSCODE });
    await loadDevices();
    setActionId(null);
  };

  const deleteDevice = async (id) => {
    setActionId(id);
    await base44.entities.DeviceActivation.delete(id);
    setDevices(d => d.filter(dev => dev.id !== id));
    setActionId(null);
  };

  const lockDevice = async (id, lock) => {
    setActionId(id);
    await base44.entities.DeviceActivation.update(id, { locked: lock });
    await loadDevices();
    setActionId(null);
  };

  const editDevice = async (id, fields) => {
    setActionId(id);
    await base44.entities.DeviceActivation.update(id, fields);
    await loadDevices();
    setActionId(null);
  };

  const addDevice = async () => {
    if (!newMac.trim()) return;
    setAdding(true);
    const mac = newMac.trim().toUpperCase();
    await base44.functions.invoke('checkActivation', { mac, action: 'activate', adminKey: ADMIN_PASSCODE });
    const expires = addMonths(new Date(), newMonths);
    const records = await base44.entities.DeviceActivation.filter({ mac });
    if (records.length > 0) {
      await base44.entities.DeviceActivation.update(records[0].id, {
        username:     newUsername.trim() || undefined,
        expires_at:   expires,
        activated_at: new Date().toISOString(),
      });
    }
    setNewMac(''); setNewUsername(''); setNewMonths(1);
    await loadDevices();
    setAdding(false);
  };

  const activeCount   = devices.filter(d => d.activated && !isExpired(d.expires_at)).length;
  const expiredCount  = devices.filter(d => isExpired(d.expires_at)).length;
  const inactiveCount = devices.filter(d => !d.activated && !isExpired(d.expires_at)).length;

  // ── Email guard — must be logged in as the allowed account ───
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07090f' }}>
        <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !ALLOWED_EMAILS.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#07090f' }}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-black text-white">Access Denied</h1>
          <p className="text-sm text-white/40 max-w-xs">This panel is restricted to authorized administrators only.</p>
          <a href="/" className="mt-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white transition-colors">
            ← Back to App
          </a>
        </div>
      </div>
    );
  }

  // ── Passcode Gate ─────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: '#07090f' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }} />
        </div>
        <form onSubmit={handlePasscode} className="relative w-full max-w-xs flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center"
            style={{ boxShadow: '0 0 40px rgba(139,92,246,0.3)' }}>
            <Shield className="w-8 h-8 text-violet-400" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-white">Admin Panel</h1>
            <p className="text-xs text-white/30 mt-1">Quantum TV · Device Manager</p>
          </div>
          <input
            type="password" value={passcode}
            onChange={e => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            autoFocus required
            className="w-full bg-white/4 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 tracking-widest text-center transition-all"
          />
          {passcodeError && <p className="text-xs text-red-400 -mt-2 text-center">{passcodeError}</p>}
          <button type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
            Enter Admin Panel
          </button>
        </form>
      </div>
    );
  }

  // ── Main Panel ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#07090f' }}>
      {/* Top header bar */}
      <div className="sticky top-0 z-10 border-b border-white/6 bg-[#07090f]/90 backdrop-blur-xl flex-shrink-0">
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Tv2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white leading-none">Quantum TV</p>
            <p className="text-[11px] text-white/30">Device Activation Manager</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={loadDevices}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/8 rounded-lg text-xs text-white/50 hover:text-white transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Two-column layout: main content left, sidebar right */}
      <div className="flex flex-1 min-h-0">

        {/* ── Main content: Device list (full width) ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Stats banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Monitor}       label="Total Devices" value={devices.length} color="bg-white/5" />
            <StatCard icon={Signal}        label="Active"        value={activeCount}    color="bg-emerald-500/15" />
            <StatCard icon={AlertTriangle} label="Expired"       value={expiredCount}   color="bg-orange-500/15" />
            <StatCard icon={XCircle}       label="Inactive"      value={inactiveCount}  color="bg-red-500/15" />
          </div>

          {/* Device grid header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-white">Registered Devices <span className="text-white/25 font-normal">({devices.length})</span></h2>
            <div className="flex items-center gap-1 bg-white/4 border border-white/8 rounded-xl p-1">
              {[
                { mode: 'list',  icon: List,       title: 'List' },
                { mode: 'grid1', icon: Monitor,    title: '1 col' },
                { mode: 'grid2', icon: Columns2,   title: '2 cols' },
                { mode: 'grid3', icon: LayoutGrid, title: '3 cols' },
              ].map(({ mode, icon: Icon, title }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={title}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    viewMode === mode
                      ? 'bg-violet-500/30 text-violet-300'
                      : 'text-white/25 hover:text-white/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-white/15" />
              </div>
              <p className="text-sm text-white/25">No devices registered yet</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="rounded-2xl border border-white/8 overflow-hidden divide-y divide-white/6">
              {devices.map(dev => {
                const expired = isExpired(dev.expires_at);
                const days = daysLeft(dev.expires_at);
                const active = dev.activated && !expired;
                return (
                  <div key={dev.id} className={`flex items-center gap-4 px-5 py-3.5 ${active ? 'bg-emerald-950/20' : expired ? 'bg-orange-950/15' : 'bg-[#0a0e1a]'}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-emerald-400' : expired ? 'bg-orange-400' : 'bg-white/15'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-white">{dev.username || '—'}</span>
                      <p className="font-mono text-[11px] text-white/30">{dev.mac}</p>
                    </div>
                    <div className="flex-shrink-0 text-right hidden sm:block">
                      <p className={`text-xs font-bold ${days <= 0 ? 'text-orange-400' : days <= 7 ? 'text-red-400' : days <= 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {dev.expires_at ? (days > 0 ? `${days}d left` : 'Expired') : '—'}
                      </p>
                      <p className="text-[11px] text-white/25">{formatDate(dev.expires_at)}</p>
                    </div>
                    <StatusBadge activated={dev.activated} expires_at={dev.expires_at} />
                    <button onClick={() => deleteDevice(dev.id)} className="w-7 h-7 rounded-lg bg-white/3 hover:bg-red-500/10 text-white/15 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`grid gap-4 ${
              viewMode === 'grid1' ? 'grid-cols-1' :
              viewMode === 'grid2' ? 'grid-cols-1 sm:grid-cols-2' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {devices.map(dev => (
                <DeviceCard
                  key={dev.id}
                  dev={dev}
                  onActivate={activate}
                  onDeactivate={deactivate}
                  onRenew={renew}
                  onDelete={deleteDevice}
                  onLock={lockDevice}
                  onEdit={editDevice}
                  isLoading={actionId === dev.id}
                />
              ))}
            </div>
          )}

          <p className="text-center text-xs text-white/10 pb-4">
            Quantum TV Admin · Device Manager
          </p>
        </div>

        {/* ── Right sidebar: Activate New Device ── */}
        <div className="w-72 flex-shrink-0 border-l border-white/6 overflow-y-auto p-5 space-y-5"
          style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.06) 0%, transparent 50%)' }}>

          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-bold text-white">Activate New Device</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Device ID / MAC</label>
                <button onClick={generateRandomMac} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold transition-colors">
                  ↻ Random
                </button>
              </div>
              <input
                value={newMac}
                onChange={e => formatMacInput(e.target.value)}
                placeholder="A1:B2:C3:D4:E5:F6"
                maxLength={17}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-cyan-400 placeholder-white/15 outline-none focus:border-cyan-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Username</label>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="customer_handle"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-violet-300 placeholder-white/15 outline-none focus:border-violet-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Duration</label>
              <div className="grid grid-cols-3 gap-1.5">
                {DURATION_OPTIONS.map(o => (
                  <button
                    key={o.months}
                    onClick={() => setNewMonths(o.months)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      newMonths === o.months
                        ? 'bg-gradient-to-br from-violet-600 to-cyan-600 border-violet-500/50 text-white'
                        : 'bg-white/4 border-white/8 text-white/40 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={addDevice}
              disabled={adding || !newMac.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-all hover:opacity-90"
              style={{ boxShadow: adding || !newMac.trim() ? 'none' : '0 0 24px rgba(139,92,246,0.35)' }}
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Activating…' : `Activate · ${DURATION_OPTIONS.find(o => o.months === newMonths)?.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}