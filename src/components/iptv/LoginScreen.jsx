import React, { useState } from 'react';
import { saveCredentials, apiUrl } from '@/lib/iptv-store';
import { Tv2, Globe, User, Lock, Eye, EyeOff, ArrowRight, Wifi } from 'lucide-react';

export default function LoginScreen() {
  const [form, setForm] = useState({ baseUrl: '', username: '', password: '', label: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const url = apiUrl(form, 'get_live_categories');
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Server returned ${res.status}.`);
      const data = await res.json();
      if (Array.isArray(data) || data?.user_info) {
        saveCredentials(form);
      } else {
        throw new Error('Invalid response. Check your credentials.');
      }
    } catch (e) {
      if (e.name === 'TimeoutError') setErr('Connection timed out. Check the URL.');
      else setErr(e.message || 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}>
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] left-[30%] w-[600px] h-[400px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(99,51,220,0.15) 60%, transparent 100%)' }} />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(14,116,196,0.1) 60%, transparent 100%)' }} />
        <div className="absolute bottom-0 left-[10%] w-[500px] h-[300px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)' }} />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-2 border-violet-500/50"
              style={{ boxShadow: '0 0 50px rgba(167,139,250,0.6), 0 0 100px rgba(139,92,246,0.25), inset 0 0 20px rgba(139,92,246,0.15)' }}>
              <img
                src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/3349a49f0_QUANTUMTVLOGOver2.png"
                alt="Quantum TV"
                className="w-full h-full object-cover scale-110"
              />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Quantum TV
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">Connect your Xtream Codes provider</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 shadow-2xl border border-violet-500/20"
          style={{ background: 'rgba(15, 10, 40, 0.75)', backdropFilter: 'blur(20px)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Server URL" icon={Globe} required>
              <input
                type="url" placeholder="http://provider.com:8080"
                value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)}
                required className="input-base font-mono text-sm"
              />
            </Field>

            <Field label="Username" icon={User} required>
              <input
                type="text" placeholder="xtream_username"
                value={form.username} onChange={e => set('username', e.target.value)}
                required autoComplete="username" className="input-base"
              />
            </Field>

            <Field label="Password" icon={Lock} required>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'} placeholder="••••••••••"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  required autoComplete="current-password" className="input-base pr-10"
                />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field label="Label (optional)" icon={Wifi}>
              <input
                type="text" placeholder="My IPTV"
                value={form.label} onChange={e => set('label', e.target.value)}
                className="input-base"
              />
            </Field>

            {err && (
              <div className="bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-2.5 text-sm text-destructive">
                {err}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-violet-600 hover:to-cyan-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-violet-500/30 mt-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Connecting...</>
                : <>Connect<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Credentials saved locally. Never shared with third parties.
        </p>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          background: hsl(var(--input));
          border: 1px solid hsl(var(--border));
          border-radius: 0.625rem;
          padding: 0.6rem 0.875rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-base::placeholder { color: hsl(var(--muted-foreground)); }
        .input-base:focus {
          border-color: hsl(var(--primary) / 0.5);
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.08);
        }
      `}</style>
    </div>
  );
}

function Field({ label, icon: Icon, required, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        <Icon className="w-3 h-3" />
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      {children}
    </div>
  );
}