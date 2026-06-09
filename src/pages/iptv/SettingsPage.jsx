import React, { useState, useEffect } from 'react';
import { useIPTV } from '@/lib/IPTVContext';
import { base44 } from '@/api/base44Client';
import { Settings, Globe, User, Lock, Eye, EyeOff, Check, Trash2, Plus, Server } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SettingsPage() {
  const { config, setConfig } = useIPTV();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ base_url: '', username: '', password: '', label: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);

  useEffect(() => {
    base44.entities.IPTVConfig.list()
      .then(setConfigs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await base44.entities.IPTVConfig.create(form);
      setConfigs(prev => [...prev, created]);
      setForm({ base_url: '', username: '', password: '', label: '' });
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await base44.entities.IPTVConfig.delete(id);
    setConfigs(prev => prev.filter(c => c.id !== id));
  };

  const handleActivate = (cfg) => {
    setConfig({ base_url: cfg.base_url, username: cfg.username, password: cfg.password });
  };

  const handleTest = async (cfg) => {
    setTestingId(cfg.id);
    setTestResult(null);
    try {
      const base = cfg.base_url.replace(/\/$/, '');
      const url = `${base}/player_api.php?username=${encodeURIComponent(cfg.username)}&password=${encodeURIComponent(cfg.password)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.user_info?.auth === 1 || data.user_info?.status === 'Active') {
        setTestResult({ id: cfg.id, ok: true, msg: `Connected — Expires: ${data.user_info.exp_date ? new Date(data.user_info.exp_date * 1000).toLocaleDateString() : 'N/A'}` });
      } else {
        setTestResult({ id: cfg.id, ok: false, msg: 'Authentication failed' });
      }
    } catch {
      setTestResult({ id: cfg.id, ok: false, msg: 'Connection failed' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your IPTV configurations</p>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/20 rounded-2xl p-5"
        >
          <h3 className="font-semibold text-foreground mb-4">New Configuration</h3>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                <input
                  type="text"
                  placeholder="My IPTV"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Server URL <span className="text-primary">*</span></label>
                <input
                  type="url"
                  placeholder="http://provider.com:8080"
                  value={form.base_url}
                  onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))}
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Username <span className="text-primary">*</span></label>
                <input
                  type="text"
                  placeholder="username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Password <span className="text-primary">*</span></label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    className="w-full bg-secondary border border-border rounded-lg px-3 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Config List */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saved Configurations</p>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />)
        ) : configs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm bg-card border border-border rounded-xl">
            No configurations saved yet
          </div>
        ) : (
          configs.map((cfg) => {
            const isActive = config?.base_url === cfg.base_url && config?.username === cfg.username;
            const tr = testResult?.id === cfg.id;
            return (
              <motion.div
                key={cfg.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`bg-card border rounded-xl p-4 transition-all ${isActive ? 'border-primary/40' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary/10' : 'bg-secondary'}`}>
                      <Server className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{cfg.label || 'IPTV Server'}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">{cfg.base_url}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">User: {cfg.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">ACTIVE</span>
                    )}
                    {!isActive && (
                      <button onClick={() => handleActivate(cfg)} className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all font-medium">
                        Use
                      </button>
                    )}
                    <button
                      onClick={() => handleTest(cfg)}
                      disabled={testingId === cfg.id}
                      className="text-xs px-3 py-1.5 bg-secondary text-muted-foreground rounded-lg hover:text-foreground transition-all"
                    >
                      {testingId === cfg.id ? 'Testing...' : 'Test'}
                    </button>
                    <button onClick={() => handleDelete(cfg.id)} className="w-7 h-7 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {tr && (
                  <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                    {testResult.msg}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}