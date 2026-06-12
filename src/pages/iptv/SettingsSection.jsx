import React, { useState } from 'react';
import { useStore } from '@/lib/use-store';
import { saveCredentials, clearCredentials, apiUrl } from '@/lib/iptv-store';
import { base44 } from '@/api/base44Client';
import { Settings, Globe, User, Lock, Eye, EyeOff, CheckCircle, XCircle, Loader2, LogOut, RefreshCw, Github, ExternalLink } from 'lucide-react';

export default function SettingsSection() {
  const { credentials } = useStore();
  const [form, setForm] = useState({ baseUrl: credentials?.baseUrl || '', username: credentials?.username || '', password: credentials?.password || '', label: credentials?.label || '' });
  const [showPwd, setShowPwd] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [repoName, setRepoName] = useState('quantum-tv-iptv');
  const [repoDesc, setRepoDesc] = useState('Quantum TV IPTV Media Player');
  const [repoPrivate, setRepoPrivate] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [repoResult, setRepoResult] = useState(null);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setTestResult(null); setSaved(false); };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const url = apiUrl(form, 'get_live_categories');
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      if (Array.isArray(data) || data?.user_info) {
        const exp = data?.user_info?.exp_date ? new Date(data.user_info.exp_date * 1000).toLocaleDateString() : null;
        setTestResult({ ok: true, msg: `Connected successfully!${exp ? ` Expires: ${exp}` : ''}` });
      } else {
        setTestResult({ ok: false, msg: 'Invalid credentials or server response.' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Connection failed. Check the URL.' });
    } finally {
      setTesting(false);
    }
  };

  const createRepo = async () => {
    setCreatingRepo(true);
    setRepoResult(null);
    try {
      const res = await base44.functions.invoke('createGithubRepo', {});
      setRepoResult({ ok: true, url: res.data.url, full_name: res.data.full_name, created: res.data.created });
    } catch (e) {
      setRepoResult({ ok: false, msg: e?.response?.data?.error || e.message });
    } finally {
      setCreatingRepo(false);
    }
  };

  const handleSave = () => {
    setSaving(true);
    saveCredentials(form);
    setTimeout(() => { setSaving(false); setSaved(true); }, 400);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" /> Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connected via: <span className="text-foreground font-medium capitalize">{credentials?.type ?? 'xtream'}</span>
          {credentials?.label ? ` — ${credentials.label}` : ''}
        </p>
      </div>

      {/* Connection info */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Server Configuration</p>

        <div className="space-y-3">
          <InputRow label="Server URL" icon={Globe}>
            <input type="url" value={form.baseUrl} onChange={e => set('baseUrl', e.target.value)}
              placeholder="http://provider.com:8080"
              className="field-input font-mono text-sm" />
          </InputRow>
          {(credentials?.type === 'xtream' || !credentials?.type) && (
            <>
              <InputRow label="Username" icon={User}>
                <input type="text" value={form.username} onChange={e => set('username', e.target.value)}
                  placeholder="xtream_username" autoComplete="username" className="field-input" />
              </InputRow>
              <InputRow label="Password" icon={Lock}>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" className="field-input pr-10" />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </InputRow>
            </>
          )}
          <InputRow label="Label" icon={Globe}>
            <input type="text" value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="My IPTV" className="field-input" />
          </InputRow>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
            {testResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {testResult.msg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={testConnection} disabled={testing || !form.baseUrl}
            className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary/80 transition-all disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test
          </button>
          <button onClick={handleSave} disabled={saving || !form.baseUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 glow-cyan">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* GitHub Repository */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Github className="w-4 h-4 text-primary" /> Create GitHub Repository
        </p>
        <p className="text-xs text-muted-foreground">Create a new GitHub repo for your IPTV project.</p>

        <div className="space-y-3">
          <InputRow label="Repository Name" icon={Github}>
            <input type="text" value={repoName} onChange={e => setRepoName(e.target.value)}
              placeholder="quantum-tv-iptv" className="field-input font-mono text-sm" />
          </InputRow>
          <InputRow label="Description" icon={Globe}>
            <input type="text" value={repoDesc} onChange={e => setRepoDesc(e.target.value)}
              placeholder="My IPTV project" className="field-input text-sm" />
          </InputRow>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
            <input type="checkbox" checked={repoPrivate} onChange={e => setRepoPrivate(e.target.checked)}
              className="accent-primary w-4 h-4 rounded" />
            Private repository
          </label>
        </div>

        {repoResult && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${repoResult.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
            {repoResult.ok
              ? <><CheckCircle className="w-4 h-4 flex-shrink-0" />
                  {repoResult.created ? 'Repo created!' : 'Found repo!'}&nbsp;
                  <a href={repoResult.url} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1">
                    {repoResult.full_name} <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              : <><XCircle className="w-4 h-4 flex-shrink-0" /> {repoResult.msg}</>}
          </div>
        )}

        <button onClick={createRepo} disabled={creatingRepo}
          className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary/80 transition-all disabled:opacity-50">
          {creatingRepo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
          {creatingRepo ? 'Connecting…' : 'Find / Create quantum-tv Repo'}
        </button>
      </div>

      {/* Free IPTV Sources */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Free IPTV Playlist
        </p>
        <p className="text-xs text-muted-foreground">
          Community-maintained M3U playlists from iptv-org with thousands of live channels.
        </p>
        <a
          href="https://iptv-org.github.io/iptv/index.m3u"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/25 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all w-full truncate"
        >
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">iptv-org.github.io/iptv/index.m3u</span>
        </a>
        <p className="text-[11px] text-muted-foreground">
          Go to <span className="text-primary font-medium">Browse</span> to load & explore these playlists with a Netflix-style grid interface.
        </p>
      </div>

      {/* Danger zone */}
      <div className="bg-card border border-destructive/20 rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-1">Danger Zone</p>
        <p className="text-xs text-muted-foreground mb-4">Remove all credentials and return to login screen.</p>
        <button onClick={clearCredentials}
          className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium hover:bg-destructive/20 transition-all">
          <LogOut className="w-4 h-4" /> Disconnect & Clear
        </button>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          background: hsl(var(--input));
          border: 1px solid hsl(var(--border));
          border-radius: 0.625rem;
          padding: 0.55rem 0.875rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input::placeholder { color: hsl(var(--muted-foreground)); }
        .field-input:focus {
          border-color: hsl(var(--primary) / 0.45);
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.08);
        }
      `}</style>
    </div>
  );
}

function InputRow({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );
}