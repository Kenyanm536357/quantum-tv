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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-accent/8 blur-[100px] rounded-full" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-28 h-28 mb-6">
            {/* Animated gradient border */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500 rounded-[2.5rem] p-[3px]" 
              style={{ borderRadius: '2.5rem' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/90 via-purple-600/80 to-background rounded-[2.4rem]" />
            </div>
            {/* Content */}
            <div className="relative flex items-center justify-center w-full h-full">
              <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/3349a49f0_QUANTUMTVLOGOver2.png" 
                alt="Quantum TV" className="h-16 drop-shadow-lg" />
            </div>
            {/* Glow */}
            <div className="absolute -inset-2 bg-gradient-to-br from-violet-500 via-purple-500 to-cyan-500 rounded-[2.5rem] opacity-0 blur-xl -z-10"
              style={{ animation: 'pulse 3s ease-in-out infinite' }} />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Quantum TV
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">Connect your Xtream Codes provider</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl">
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