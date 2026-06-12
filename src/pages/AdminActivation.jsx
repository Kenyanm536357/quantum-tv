import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Monitor, CheckCircle, XCircle, Plus, Trash2, Loader2,
  RefreshCw, Shield, Lock, User, Calendar, Clock,
  Tv2, Signal, AlertTriangle, ChevronDown
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

function StatusBadge({ activated, expires_at }) {
  const expired = isExpired(expires_at);
  const days = daysLeft(expires_at);

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

function DeviceCard({ dev, onActivate, onDeactivate, onDelete, isLoading }) {
  const expired = isExpired(dev.expires_at);
  const days    = daysLeft(dev.expires_at);
  const active  = dev.activated && !expired;

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all ${
      active
        ? 'bg-gradient-to-br from-emerald-950/40 to-[#080c14] border-emerald-500/20'
        : expired
          ? 'bg-gradient-to-br from-orange-950/30 to-[#080c14] border-orange-500/15'
          : 'bg-gradient-to-br from-[#0d1117] to-[#080c14] border-white/8'
    }`}>
      {/* Top color bar */}
      <div className={`h-0.5 w-full ${active ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : expired ? 'bg-gradient-to-r from-orange-500 to-amber-400' : 'bg-gradient-to-r from-slate-700 to-slate-600'}`} />

      <div className="p-5">
        {/* Top row: MAC + status */}
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
            {dev.label && (
              <p className="text-xs text-white/40 truncate">{dev.label}</p>
            )}
          </div>
          <StatusBadge activated={dev.activated} expires_at={dev.expires_at} />
        </div>

        {/* Expiry bar */}
        {dev.expires_at && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/30 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Expires {formatDate(dev.expires_at)}
              </span>
              {days !== null && (
                <span className={`text-[11px] font-bold ${days <= 7 ? 'text-orange-400' : days <= 30 ? 'text-yellow-400' : 'text-white/30'}`}>
                  {days > 0 ? `${days} days remaining` : 'Expired'}
                </span>
              )}
            </div>
            {days !== null && (
              <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    days <= 7 ? 'bg-orange-400' : days <= 30 ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (days / 365) * 100))}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
            </div>
          ) : active ? (
            <button
              onClick={() => onDeactivate(dev.mac, dev.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Deactivate
            </button>
          ) : (
            <button
              onClick={() => onActivate(dev.mac, dev.id, 1)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Activate
            </button>
          )}
          <button
            onClick={() => onDelete(dev.id)}
            className="w-9 h-9 rounded-xl bg-white/4 hover:bg-red-500/10 text-white/20 hover:text-red-400 flex items-center justify-center transition-colors border border-white/6"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminActivation() {
  const [authed, setAuthed]           = useState(false);
  const [passcode, setPasscode]       = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [devices, setDevices]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [actionId, setActionId]       = useState(null);

  const [newMac,      setNewMac]      = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newLabel,    setNewLabel]    = useState('');
  const [newMonths,   setNewMonths]   = useState(1);

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

  const addDevice = async () => {
    if (!newMac.trim()) return;
    setAdding(true);
    const mac = newMac.trim().toUpperCase();
    await base44.functions.invoke('checkActivation', { mac, action: 'activate', adminKey: ADMIN_PASSCODE });
    const expires = addMonths(new Date(), newMonths);
    const records = await base44.entities.DeviceActivation.filter({ mac });
    if (records.length > 0) {
      await base44.entities.DeviceActivation.update(records[0].id, {
        label:        newLabel.trim() || undefined,
        username:     newUsername.trim() || undefined,
        expires_at:   expires,
        activated_at: new Date().toISOString(),
      });
    }
    setNewMac(''); setNewUsername(''); setNewLabel(''); setNewMonths(1);
    await loadDevices();
    setAdding(false);
  };

  const activeCount   = devices.filter(d => d.activated && !isExpired(d.expires_at)).length;
  const expiredCount  = devices.filter(d => isExpired(d.expires_at)).length;
  const inactiveCount = devices.filter(d => !d.activated && !isExpired(d.expires_at)).length;

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
    <div className="min-h-screen" style={{ background: '#07090f' }}>
      {/* Top header bar */}
      <div className="sticky top-0 z-10 border-b border-white/6 bg-[#07090f]/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
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

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Monitor}      label="Total Devices"  value={devices.length} color="bg-white/5" />
          <StatCard icon={Signal}       label="Active"         value={activeCount}    color="bg-emerald-500/15" />
          <StatCard icon={AlertTriangle} label="Expired"       value={expiredCount}   color="bg-orange-500/15" />
          <StatCard icon={XCircle}      label="Inactive"       value={inactiveCount}  color="bg-red-500/15" />
        </div>

        {/* Add new device form */}
        <div className="rounded-2xl border border-violet-500/20 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(8,12,20,1) 60%)' }}>
          <div className="px-5 py-4 border-b border-violet-500/15 flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-bold text-white">Activate New Device</p>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Device ID / MAC</label>
              <input
                value={newMac}
                onChange={e => setNewMac(e.target.value)}
                placeholder="A1:B2:C3:D4:E5:F6"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-400 placeholder-white/15 outline-none focus:border-cyan-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Username</label>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="customer_handle"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-violet-300 placeholder-white/15 outline-none focus:border-violet-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Customer Name</label>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Full name (optional)"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/15 outline-none focus:border-white/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Subscription Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map(o => (
                  <button
                    key={o.months}
                    onClick={() => setNewMonths(o.months)}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
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
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={addDevice}
              disabled={adding || !newMac.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-all hover:opacity-90"
              style={{ boxShadow: adding || !newMac.trim() ? 'none' : '0 0 30px rgba(139,92,246,0.3)' }}
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Activating…' : `Activate · ${DURATION_OPTIONS.find(o => o.months === newMonths)?.label}`}
            </button>
          </div>
        </div>

        {/* Device grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Registered Devices</h2>
            <span className="text-xs text-white/25">{devices.length} total</span>
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map(dev => (
                <DeviceCard
                  key={dev.id}
                  dev={dev}
                  onActivate={activate}
                  onDeactivate={deactivate}
                  onDelete={deleteDevice}
                  isLoading={actionId === dev.id}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/10 pb-4">
          Quantum TV Admin · Device Manager
        </p>
      </div>
    </div>
  );
}