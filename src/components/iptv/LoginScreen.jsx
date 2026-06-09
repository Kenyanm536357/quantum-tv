import React, { useState } from 'react';
import { saveCredentials, apiUrl } from '@/lib/iptv-store';
import { parseM3U } from '@/lib/m3u-parser';
import { Globe, User, Lock, Eye, EyeOff, ArrowRight, List, Cpu } from 'lucide-react';

const TABS = [
  { id: 'xtream', label: 'Xtream Codes' },
  { id: 'm3u',    label: 'M3U Playlist' },
  { id: 'mac',    label: 'MAC Address'  },
];

export default function LoginScreen() {
  const [tab, setTab] = useState('xtream');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Xtream
  const [xt, setXt] = useState({ baseUrl: '', username: '', password: '', label: '' });
  // M3U
  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uLabel, setM3uLabel] = useState('');
  // MAC
  const [mac, setMac] = useState({ portalUrl: '', macAddr: '', label: '' });

  const setX = (k, v) => setXt(f => ({ ...f, [k]: v }));
  const setM = (k, v) => setMac(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      if (tab === 'xtream') {
        const url = apiUrl(xt, 'get_live_categories');
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`Server returned ${res.status}.`);
        const data = await res.json();
        if (Array.isArray(data) || data?.user_info) {
          saveCredentials({ ...xt, type: 'xtream' });
        } else {
          throw new Error('Invalid response. Check your credentials.');
        }
      } else if (tab === 'm3u') {
        const res = await fetch(m3uUrl, { signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`Could not fetch playlist (HTTP ${res.status}).`);
        const text = await res.text();
        if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
          throw new Error('Not a valid M3U playlist.');
        }
        const parsed = parseM3U(text);
        localStorage.setItem('m3u_parsed', JSON.stringify(parsed));
        saveCredentials({ type: 'm3u', baseUrl: m3uUrl, label: m3uLabel || 'M3U Playlist', username: '', password: '' });
      } else {
        // MAC / Stalker portal — attempt handshake
        const base = mac.portalUrl.replace(/\/+$/, '');
        const res = await fetch(
          `${base}/portal.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`,
          {
            signal: AbortSignal.timeout(10000),
            headers: { Cookie: `mac=${mac.macAddr}; stb_lang=en; timezone=GMT`, 'X-User-Agent': 'Model: MAG250; Link: WiFi' },
          }
        );
        const data = await res.json();
        if (!data?.js?.token) throw new Error('Portal handshake failed. Check the URL and MAC address.');
        saveCredentials({ type: 'mac', portalUrl: mac.portalUrl, mac: mac.macAddr, label: mac.label || 'MAC Portal', baseUrl: mac.portalUrl, username: '', password: '' });
      }
    } catch (e) {
      if (e.name === 'TimeoutError' || e.name === 'AbortError') setErr('Connection timed out. Check the URL.');
      else setErr(e.message || 'Could not connect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center p-3 sm:p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}>
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] left-[30%] w-[600px] h-[400px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(99,51,220,0.15) 60%, transparent 100%)' }} />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(14,116,196,0.1) 60%, transparent 100%)' }} />
        <div className="absolute bottom-0 left-[10%] w-[500px] h-[300px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative w-full max-w-[420px] flex flex-col justify-center">
        {/* Logo */}
        <div className="text-center mb-3 sm:mb-5">
          <div className="relative inline-block mb-2 sm:mb-3">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl sm:rounded-[2rem] overflow-hidden border-2 border-violet-500/50"
              style={{ boxShadow: '0 0 50px rgba(167,139,250,0.6), 0 0 100px rgba(139,92,246,0.25), inset 0 0 20px rgba(139,92,246,0.15)' }}>
              <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/3349a49f0_QUANTUMTVLOGOver2.png"
                alt="Quantum TV" className="w-full h-full object-cover scale-110" />
            </div>
          </div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Quantum TV
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Connect your provider</p>
        </div>

        {/* Card */}
        <div className="rounded-xl sm:rounded-2xl shadow-2xl border border-violet-500/20"
          style={{ background: 'rgba(15, 10, 40, 0.75)', backdropFilter: 'blur(20px)' }}>

          {/* Tabs */}
          <div className="flex border-b border-violet-500/15">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => { setTab(t.id); setErr(''); }}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? 'text-violet-300 border-b-2 border-violet-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-3 sm:p-5 space-y-2.5">
            {tab === 'xtream' && (
              <>
                <Field label="Server URL" icon={Globe} required>
                  <input type="url" placeholder="http://provider.com:8080"
                    value={xt.baseUrl} onChange={e => setX('baseUrl', e.target.value)}
                    required className="input-base font-mono text-sm" />
                </Field>
                <Field label="Username" icon={User} required>
                  <input type="text" placeholder="xtream_username"
                    value={xt.username} onChange={e => setX('username', e.target.value)}
                    required autoComplete="username" className="input-base" />
                </Field>
                <Field label="Password" icon={Lock} required>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} placeholder="••••••••••"
                      value={xt.password} onChange={e => setX('password', e.target.value)}
                      required autoComplete="current-password" className="input-base pr-10" />
                    <button type="button" onClick={() => setShowPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
              </>
            )}

            {tab === 'm3u' && (
              <>
                <Field label="Playlist URL" icon={List} required>
                  <input type="url" placeholder="http://provider.com/playlist.m3u"
                    value={m3uUrl} onChange={e => setM3uUrl(e.target.value)}
                    required className="input-base font-mono text-sm" />
                </Field>
                <Field label="Label (optional)" icon={Globe}>
                  <input type="text" placeholder="My Playlist"
                    value={m3uLabel} onChange={e => setM3uLabel(e.target.value)}
                    className="input-base" />
                </Field>
              </>
            )}

            {tab === 'mac' && (
              <>
                <Field label="Portal URL" icon={Globe} required>
                  <input type="url" placeholder="http://portal.provider.com:8080"
                    value={mac.portalUrl} onChange={e => setM('portalUrl', e.target.value)}
                    required className="input-base font-mono text-sm" />
                </Field>
                <Field label="MAC Address" icon={Cpu} required>
                  <input type="text" placeholder="00:1A:79:XX:XX:XX"
                    value={mac.macAddr} onChange={e => setM('macAddr', e.target.value)}
                    required className="input-base font-mono" />
                </Field>
                <Field label="Label (optional)" icon={Globe}>
                  <input type="text" placeholder="My MAG Box"
                    value={mac.label} onChange={e => setM('label', e.target.value)}
                    className="input-base" />
                </Field>
              </>
            )}

            {err && (
              <div className="bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2 text-xs text-destructive">
                {err}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full h-10 sm:h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-violet-600 hover:to-cyan-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-violet-500/30">
              {loading
                ? <><span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Connecting...</>
                : <>Connect <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-2">
          Saved locally. Never shared.
        </p>
      </div>

      <style>{`
        .input-base {
          width: 100%;
          background: hsl(var(--input));
          border: 1px solid hsl(var(--border));
          border-radius: 0.625rem;
          padding: 0.5rem 0.875rem;
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
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        <Icon className="w-3 h-3" />
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      {children}
    </div>
  );
}