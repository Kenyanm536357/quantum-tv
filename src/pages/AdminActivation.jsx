import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';


import {
  Monitor, CheckCircle, XCircle, Plus, Trash2, Loader2,
  RefreshCw, Shield, Lock, LockOpen, Calendar,
  Tv2, Signal, AlertTriangle, Wifi, ShieldCheck, Database, AlertCircle
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

function LegendItem({ color, label, count, pulse }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs font-bold text-white/70">{count}</span>
    </div>
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

function getInitials(username) {
  if (!username) return '??';
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function DeviceCard({ dev, onRenew, onDelete, onLock, onEdit, isLoading }) {
  const expired = isExpired(dev.expires_at);
  const days    = daysLeft(dev.expires_at);
  const active  = dev.activated && !expired;
  const locked  = !!dev.locked;

  const [showRenew, setShowRenew] = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);
  const [editUser,  setEditUser]  = useState(dev.username || '');
  const [renewMonths, setRenewMonths] = useState(1);

  const handleRenew = () => { onRenew(dev.id, renewMonths, dev.expires_at); setShowRenew(false); };
  const handleEdit  = () => { onEdit(dev.id, { username: editUser.trim() }); setShowEdit(false); };

  const statusColor = locked
    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    : active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : expired ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    : 'bg-red-500/20 text-red-300 border-red-500/30';
  const statusLabel = locked ? 'Locked' : active ? 'Active' : expired ? 'Expired' : 'Inactive';

  const daysColor = days === null ? '' : days <= 0 ? 'text-orange-400' : days <= 7 ? 'text-red-400' : days <= 30 ? 'text-yellow-400' : 'text-white/60';

  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#111827' }}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-3 sm:px-5 py-3 sm:py-4">
        {/* Avatar */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
          {getInitials(dev.username)}
        </div>

        {/* Name + MAC */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white leading-tight">{dev.username || '—'}</p>
          {dev.phone && <p className="text-xs text-white/35 mt-0.5">📞 {dev.phone}</p>}
          {dev.notes && <p className="text-xs text-white/30 mt-0.5 truncate italic">"{dev.notes}"</p>}
        </div>

        {/* Status badge */}
        <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
          {statusLabel}
        </span>

        {/* Days left */}
        {dev.expires_at && (
          <div className="flex-shrink-0 text-right hidden sm:block">
            <p className={`text-sm font-bold ${daysColor}`}>
              {days !== null ? (days > 0 ? `${days} days left` : 'Expired') : '—'}
            </p>
          </div>
        )}

        {/* Expiry date */}
        {dev.expires_at && (
          <div className="flex-shrink-0 hidden md:block text-right">
            <p className="text-[11px] text-white/35">Expiry on</p>
            <p className="text-sm font-semibold text-white/70">{formatDate(dev.expires_at)}</p>
          </div>
        )}

        {/* Action icon buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
          ) : (
            <>
              <button onClick={() => onLock(dev.id, !locked)} title={locked ? 'Unlock' : 'Lock'}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-yellow-400 hover:border-yellow-500/30 transition-colors">
                {locked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setShowRenew(s => !s); setShowEdit(false); }} title="Renew"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(dev.id)} title="Delete"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-500/30 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Renew panel */}
      {showRenew && (
        <div className="px-5 pb-4 pt-0">
          <div className="p-3 rounded-xl bg-cyan-500/8 border border-cyan-500/20 space-y-2">
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
              <button onClick={handleRenew}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-colors">
                <CheckCircle className="w-3.5 h-3.5" /> Confirm
              </button>
              <button onClick={() => setShowRenew(false)}
                className="px-3 py-2 bg-white/4 border border-white/8 text-white/30 rounded-lg text-xs font-bold hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminActivation() {
  const { } = useAuth();
  const navigate = useNavigate();
  const [authed, setAuthed]           = useState(false);
  const [passcode, setPasscode]       = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [devices, setDevices]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [actionId, setActionId]       = useState(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone,    setNewPhone]    = useState('');
  const [newNotes,    setNewNotes]    = useState('');
  const [newMonths,   setNewMonths]   = useState(1);
  const [sysChecking, setSysChecking] = useState(null); // 'playlist'|'proxies'|'security'|null
  const [sysResults,  setSysResults]  = useState({});   // { playlist, proxies, security }

  const runCheck = async (type) => {
    setSysChecking(type);
    try {
      const res = await base44.functions.invoke('systemCheck', { check: type });
      setSysResults(prev => ({ ...prev, [type]: res.data }));
    } catch (e) {
      setSysResults(prev => ({ ...prev, [type]: { ok: false, error: e.message } }));
    } finally {
      setSysChecking(null);
    }
  };

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

  const renew = async (id, months, currentExpiry) => {
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
    if (!newUsername.trim()) return;
    setAdding(true);
    const expires = addMonths(new Date(), newMonths);
    await base44.entities.DeviceActivation.create({
      mac:          newUsername.trim(),
      username:     newUsername.trim(),
      password:     newPassword.trim() || undefined,
      phone:        newPhone.trim() || undefined,
      notes:        newNotes.trim() || undefined,
      activated:    true,
      activated_at: new Date().toISOString(),
      expires_at:   expires,
    });
    setNewUsername(''); setNewPassword(''); setNewPhone(''); setNewNotes(''); setNewMonths(1);
    await loadDevices();
    setAdding(false);
  };

  const activeCount   = devices.filter(d => d.activated && !isExpired(d.expires_at)).length;
  const expiredCount  = devices.filter(d => isExpired(d.expires_at)).length;
  const inactiveCount = devices.filter(d => !d.activated && !isExpired(d.expires_at)).length;

  // ── Passcode Gate ─────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}>
        {/* Glow blobs — match login screen */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[30%] w-[600px] h-[400px] rounded-full blur-[130px]"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(99,51,220,0.15) 60%, transparent 100%)' }} />
          <div className="absolute bottom-0 right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px]"
            style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(14,116,196,0.1) 60%, transparent 100%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <motion.form
          onSubmit={handlePasscode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-xs flex flex-col items-center gap-5"
        >
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
            className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3.5 text-base text-white placeholder-white/30 outline-none focus:border-violet-500/60 focus:bg-white/15 tracking-widest text-center transition-all"
            style={{ caretColor: '#a78bfa', WebkitTextFillColor: 'white' }}
          />
          {passcodeError && <p className="text-xs text-red-400 -mt-2 text-center">{passcodeError}</p>}
          <button type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity"
            style={{ boxShadow: '0 0 30px rgba(139,92,246,0.4)' }}>
            Enter Admin Panel
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-3 text-center text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Back to Login
          </button>
        </motion.form>
      </div>
    );
  }

  // ── Main Panel ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: '#07090f' }}>
      {/* Top header bar */}
      <div className="sticky top-0 z-10 border-b border-white/6 bg-[#07090f]/90 backdrop-blur-xl flex-shrink-0">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/7cb772c8e_QUANTUMTVLOGOver2.png" alt="Quantum TV" className="w-full h-full object-cover rounded-lg" />
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

      {/* Two-column layout: stacked on mobile, side-by-side on lg+ */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

        {/* ── Main content: Device list ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

          {/* Stats banner */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Monitor}       label="Total Devices" value={devices.length} color="bg-white/5" />
            <StatCard icon={Signal}        label="Active"        value={activeCount}    color="bg-emerald-500/15" />
            <StatCard icon={AlertTriangle} label="Expired"       value={expiredCount}   color="bg-orange-500/15" />
            <StatCard icon={XCircle}       label="Inactive"      value={inactiveCount}  color="bg-red-500/15" />
          </div>

          {/* Status Summary Dashboard */}
          {devices.length > 0 && !loading && (() => {
            const expiringSoon  = devices.filter(d => { const dl = daysLeft(d.expires_at); return d.activated && dl !== null && dl > 0 && dl <= 7; });
            const expiringMonth = devices.filter(d => { const dl = daysLeft(d.expires_at); return d.activated && dl !== null && dl > 7 && dl <= 30; });
            const healthy       = devices.filter(d => { const dl = daysLeft(d.expires_at); return d.activated && dl !== null && dl > 30; });
            const locked        = devices.filter(d => d.locked);
            const totalActive   = devices.filter(d => d.activated && !isExpired(d.expires_at)).length;

            return (
              <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: '#0d1117' }}>
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-white/6 flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Status Overview</p>
                  <span className="text-xs text-white/30">{totalActive} active of {devices.length} total</span>
                </div>

                {/* Progress bar */}
                <div className="px-5 pt-4">
                  <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                    {healthy.length > 0 && (
                      <div className="bg-emerald-500 transition-all" style={{ width: `${(healthy.length / devices.length) * 100}%` }} title={`${healthy.length} healthy`} />
                    )}
                    {expiringMonth.length > 0 && (
                      <div className="bg-yellow-400 transition-all" style={{ width: `${(expiringMonth.length / devices.length) * 100}%` }} title={`${expiringMonth.length} expiring soon`} />
                    )}
                    {expiringSoon.length > 0 && (
                      <div className="bg-red-500 animate-pulse transition-all" style={{ width: `${(expiringSoon.length / devices.length) * 100}%` }} title={`${expiringSoon.length} critical`} />
                    )}
                    {expiredCount > 0 && (
                      <div className="bg-orange-500/60 transition-all" style={{ width: `${(expiredCount / devices.length) * 100}%` }} />
                    )}
                    {inactiveCount > 0 && (
                      <div className="bg-white/10 transition-all" style={{ width: `${(inactiveCount / devices.length) * 100}%` }} />
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="px-5 py-4 flex flex-wrap gap-4">
                  <LegendItem color="bg-emerald-500" label="Healthy" count={healthy.length} />
                  <LegendItem color="bg-yellow-400" label="Expiring ≤30d" count={expiringMonth.length} />
                  <LegendItem color="bg-red-500" label="Critical ≤7d" count={expiringSoon.length} pulse />
                  <LegendItem color="bg-orange-500/70" label="Expired" count={expiredCount} />
                  <LegendItem color="bg-white/15" label="Inactive" count={inactiveCount} />
                  {locked.length > 0 && <LegendItem color="bg-yellow-500" label="Locked" count={locked.length} />}
                </div>

                {/* Critical alerts */}
                {expiringSoon.length > 0 && (
                  <div className="mx-5 mb-4 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
                    <p className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> {expiringSoon.length} device{expiringSoon.length > 1 ? 's' : ''} expiring within 7 days
                    </p>
                    <div className="space-y-1">
                      {expiringSoon.map(d => (
                        <div key={d.id} className="flex items-center justify-between">
                          <span className="text-xs text-white/60">{d.username || '—'}</span>
                          <span className="text-xs font-bold text-red-400">{daysLeft(d.expires_at)}d left</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Device list header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-white">Registered Devices <span className="text-white/25 font-normal text-sm">({devices.length})</span></h2>
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
            <div className="space-y-3">
              {devices.map(dev => (
                <DeviceCard
                  key={dev.id}
                  dev={dev}
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

        {/* ── Sidebar: Activate New Device ── */}
        <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-white/6 overflow-y-auto p-4 sm:p-5 space-y-5"
          style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.06) 0%, transparent 50%)' }}>

          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-bold text-white">Activate New Device</p>
          </div>

          <div className="space-y-3">
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
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Password</label>
              <input
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="customer_password"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-violet-300 placeholder-white/15 outline-none focus:border-violet-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/15 outline-none focus:border-violet-500/40 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Notes</label>
              <textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Any notes about this customer…"
                rows={3}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/15 outline-none focus:border-violet-500/40 transition-all resize-none"
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
              disabled={adding || !newUsername.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-all hover:opacity-90"
              style={{ boxShadow: adding || !newUsername.trim() ? 'none' : '0 0 24px rgba(139,92,246,0.35)' }}
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Activating…' : `Activate · ${DURATION_OPTIONS.find(o => o.months === newMonths)?.label}`}
            </button>
          </div>

          {/* System Dashboard */}
          <div className="border-t border-white/6 pt-5 space-y-4">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-400" /> System Dashboard
            </p>

            {/* Playlist Refresh */}
            <div className="rounded-xl bg-white/3 border border-white/8 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-xs font-bold text-white">Playlist Refresh</p>
                </div>
                <button onClick={() => runCheck('playlist')} disabled={sysChecking === 'playlist'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-bold hover:bg-cyan-500/20 transition-colors disabled:opacity-40">
                  {sysChecking === 'playlist' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Run
                </button>
              </div>
              {sysResults.playlist && (
                <div className={`text-[11px] rounded-lg px-2.5 py-2 ${sysResults.playlist.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {sysResults.playlist.ok
                    ? `✓ ${sysResults.playlist.categories} categories loaded · ${sysResults.playlist.latency}ms`
                    : `✗ ${sysResults.playlist.error}`}
                </div>
              )}
            </div>

            {/* Proxy Health */}
            <div className="rounded-xl bg-white/3 border border-white/8 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-xs font-bold text-white">Backup Proxies</p>
                </div>
                <button onClick={() => runCheck('proxies')} disabled={sysChecking === 'proxies'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold hover:bg-blue-500/20 transition-colors disabled:opacity-40">
                  {sysChecking === 'proxies' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Check
                </button>
              </div>
              {sysResults.proxies && (
                <div className="space-y-1">
                  <p className={`text-[11px] font-bold ${sysResults.proxies.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {sysResults.proxies.alive}/{sysResults.proxies.total} proxies online
                  </p>
                  {sysResults.proxies.results?.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-[10px]">
                      <span className="text-white/40">{r.id}</span>
                      <span className={r.ok ? 'text-emerald-400' : 'text-red-400/70'}>
                        {r.ok ? `✓ ${r.latency}ms` : '✗ offline'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Self-Check */}
            <div className="rounded-xl bg-white/3 border border-white/8 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-xs font-bold text-white">Security Check</p>
                </div>
                <button onClick={() => runCheck('security')} disabled={sysChecking === 'security'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-bold hover:bg-violet-500/20 transition-colors disabled:opacity-40">
                  {sysChecking === 'security' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                  Scan
                </button>
              </div>
              {sysResults.security && (
                <div className="space-y-1">
                  {sysResults.security.checks?.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {c.ok
                          ? <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          : <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        <span className="text-white/50">{c.label}</span>
                      </div>
                      <span className={`text-right flex-shrink-0 ${c.ok ? 'text-white/30' : 'text-red-400 font-bold'}`}>{c.detail}</span>
                    </div>
                  ))}
                  {!sysResults.security.checks && (
                    <p className="text-[11px] text-red-400">✗ {sysResults.security.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}