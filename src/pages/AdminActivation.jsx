import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Monitor, CheckCircle, XCircle, Plus, Trash2, Loader2, RefreshCw, Shield, Lock, User, Calendar, Clock } from 'lucide-react';

const ADMIN_PASSCODE = 'quantum-admin-2024';

const DURATION_OPTIONS = [
  { label: '1 Month',   months: 1  },
  { label: '6 Months',  months: 6  },
  { label: '12 Months', months: 12 },
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
  const diff = Math.ceil((new Date(expires_at) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function AdminActivation() {
  const [authed, setAuthed]           = useState(false);
  const [passcode, setPasscode]       = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [devices, setDevices]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);
  const [actionId, setActionId]       = useState(null);

  // New device form
  const [newMac,      setNewMac]      = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newLabel,    setNewLabel]    = useState('');
  const [newMonths,   setNewMonths]   = useState(1);

  const handlePasscode = (e) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      setAuthed(true);
      setPasscodeError('');
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
    setActionId(id || mac);
    await base44.functions.invoke('checkActivation', { mac, action: 'activate', adminKey: ADMIN_PASSCODE });
    const expires = addMonths(new Date(), months || 1);
    await base44.entities.DeviceActivation.update(id, { activated: true, activated_at: new Date().toISOString(), expires_at: expires });
    await loadDevices();
    setActionId(null);
  };

  const deactivate = async (mac, id) => {
    setActionId(id || mac);
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
    setNewMac('');
    setNewUsername('');
    setNewLabel('');
    setNewMonths(1);
    await loadDevices();
    setAdding(false);
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#07090f' }}>
        <form onSubmit={handlePasscode} className="w-full max-w-xs flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <Lock className="w-6 h-6 text-violet-400" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-black text-white">Admin Access</h1>
            <p className="text-xs text-white/30 mt-1">Quantum TV · Device Manager</p>
          </div>
          <input
            type="password"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            placeholder="Enter passcode"
            autoFocus
            required
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 tracking-widest text-center"
          />
          {passcodeError && <p className="text-xs text-red-400 -mt-2 text-center">{passcodeError}</p>}
          <button type="submit"
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold rounded-xl text-sm">
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: '#07090f' }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Device Activation Manager</h1>
            <p className="text-xs text-white/40">Manage customer devices and subscriptions</p>
          </div>
          <button onClick={loadDevices} className="ml-auto w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Add new device */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-bold text-white">Activate New Device</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={newMac}
              onChange={e => setNewMac(e.target.value)}
              placeholder="Device ID / MAC (e.g. A1:B2:C3:D4:E5:F6)"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-cyan-400 placeholder-white/20 outline-none focus:border-violet-500/50"
            />
            <input
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="Username (your internal ID)"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-violet-300 placeholder-white/20 outline-none focus:border-violet-500/50"
            />
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Customer name (optional)"
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50"
            />
            <div className="flex gap-2">
              <select
                value={newMonths}
                onChange={e => setNewMonths(Number(e.target.value))}
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                style={{ backgroundImage: 'none' }}
              >
                {DURATION_OPTIONS.map(o => (
                  <option key={o.months} value={o.months} style={{ background: '#0d1117' }}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={addDevice}
                disabled={adding || !newMac.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-sm rounded-xl disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Activate
              </button>
            </div>
          </div>
        </div>

        {/* Device list */}
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
            <p className="text-sm font-bold text-white">Registered Devices</p>
            <span className="text-xs text-white/30">{devices.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
              <Monitor className="w-10 h-10" />
              <p className="text-sm">No devices registered yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {devices.map(dev => {
                const expired = isExpired(dev.expires_at);
                const days    = daysLeft(dev.expires_at);
                return (
                  <div key={dev.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      dev.activated && !expired
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        : expired && dev.activated
                          ? 'bg-orange-400'
                          : 'bg-red-500/60'
                    }`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-sm font-bold text-cyan-400">{dev.mac}</p>
                        {dev.username && (
                          <span className="flex items-center gap-1 text-xs text-violet-300 font-semibold bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
                            <User className="w-3 h-3" /> {dev.username}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {dev.label && <span className="text-xs text-white/50">{dev.label}</span>}
                        {dev.label && <span className="text-white/20">·</span>}
                        <span className={`text-xs font-semibold ${
                          dev.activated && !expired ? 'text-emerald-400' : expired ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {dev.activated && !expired ? 'Active' : expired ? 'Expired' : 'Inactive'}
                        </span>
                        {dev.expires_at && (
                          <>
                            <span className="text-white/20">·</span>
                            <span className={`text-xs flex items-center gap-1 ${days !== null && days <= 7 ? 'text-orange-400' : 'text-white/30'}`}>
                              <Calendar className="w-3 h-3" />
                              Expires {formatDate(dev.expires_at)}
                              {days !== null && days > 0 && <span className="text-white/20">({days}d left)</span>}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {actionId === dev.id ? (
                        <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                      ) : dev.activated && !expired ? (
                        <button
                          onClick={() => deactivate(dev.mac, dev.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => activate(dev.mac, dev.id, 1)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Activate
                        </button>
                      )}
                      <button
                        onClick={() => deleteDevice(dev.id)}
                        className="w-8 h-8 rounded-lg bg-white/4 hover:bg-red-500/10 text-white/20 hover:text-red-400 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/15">
          Quantum TV Admin · Device Manager
        </p>
      </div>
    </div>
  );
}