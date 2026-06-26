import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Github, Upload, CheckCircle, AlertCircle, Loader2, FileCode } from 'lucide-react';

// All source files to export
const SOURCE_FILES = [
  { path: 'App.jsx' },
  { path: 'index.css' },
  { path: 'tailwind.config.js' },
  { path: 'index.html' },
  { path: 'main.jsx' },
  { path: 'api/base44Client.js' },
  { path: 'lib/iptv-store.js' },
  { path: 'lib/use-m3u-playlist.js' },
  { path: 'lib/use-playlist.js' },
  { path: 'lib/use-store.js' },
  { path: 'lib/user-data.js' },
  { path: 'lib/clean-name.js' },
  { path: 'lib/use-xtream.js' },
  { path: 'lib/m3u-parser.js' },
  { path: 'lib/mac-auth.js' },
  { path: 'lib/query-client.js' },
  { path: 'lib/utils.js' },
  { path: 'lib/app-params.js' },
  { path: 'lib/AuthContext.jsx' },
  { path: 'lib/PageNotFound.jsx' },
  { path: 'pages/Home.jsx' },
  { path: 'pages/Login.jsx' },
  { path: 'pages/AdminActivation.jsx' },
  { path: 'pages/iptv/BrowseSection.jsx' },
  { path: 'pages/iptv/LiveSection.jsx' },
  { path: 'pages/iptv/MoviesSection.jsx' },
  { path: 'pages/iptv/SeriesSection.jsx' },
  { path: 'pages/iptv/EPGSection.jsx' },
  { path: 'pages/iptv/SettingsSection.jsx' },
  { path: 'pages/iptv/BookmarksSection.jsx' },
  { path: 'pages/iptv/HistorySection.jsx' },
  { path: 'pages/iptv/RemindersSection.jsx' },
  { path: 'components/iptv/VideoPlayer.jsx' },
  { path: 'components/iptv/MacActivationScreen.jsx' },
  { path: 'components/iptv/AppTopbar.jsx' },
  { path: 'components/iptv/AppSidebar.jsx' },
  { path: 'components/iptv/MiniPlayer.jsx' },
  { path: 'components/iptv/MobileNavbar.jsx' },
  { path: 'components/iptv/CorsBlockedScreen.jsx' },
  { path: 'components/iptv/DebugPanel.jsx' },
  { path: 'components/iptv/StreamDiagnostic.jsx' },
  { path: 'components/iptv/SearchInput.jsx' },
  { path: 'components/iptv/MediaCard.jsx' },
  { path: 'components/iptv/CategoryGrid.jsx' },
  { path: 'components/iptv/SkeletonGrid.jsx' },
  { path: 'components/iptv/WelcomeScreen.jsx' },
  { path: 'components/iptv/ReminderModal.jsx' },
  { path: 'components/iptv/PullToRefresh.jsx' },
  { path: 'components/ProtectedRoute.jsx' },
  { path: 'components/UserNotRegisteredError.jsx' },
  { path: 'functions/fetchPlaylist.js' },
  { path: 'functions/validateDevice.js' },
  { path: 'functions/systemCheck.js' },
  { path: 'functions/checkActivation.js' },
  { path: 'functions/syncIPTVConfig.js' },
  { path: 'functions/createGithubRepo.js' },
  { path: 'entities/DeviceActivation.json' },
  { path: 'entities/IPTVConfig.json' },
];

export default function ExportToGitHub() {
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const handleExport = async () => {
    setStatus('loading');
    setError('');
    setResult(null);

    try {
      setProgress('Reading source files…');

      // Fetch all files via the app's own static serving
      const files = [];
      for (const { path } of SOURCE_FILES) {
        try {
          const res = await fetch(`/src/${path}`);
          if (res.ok) {
            const content = await res.text();
            files.push({ path, content });
          }
        } catch (_) {
          // skip files that don't exist
        }
      }

      if (files.length === 0) {
        throw new Error('Could not read any source files. Try the GitHub Sync feature in Dashboard → Settings → GitHub instead.');
      }

      setProgress(`Pushing ${files.length} files to GitHub…`);

      const res = await base44.functions.invoke('createGithubRepo', { files });

      if (res.data?.error) throw new Error(res.data.error);

      setResult(res.data);
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}>
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-6 text-center">

        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
          <Github className="w-8 h-8 text-white" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-white">Export to GitHub</h1>
          <p className="text-sm text-white/50 mt-2">
            Push all Quantum TV source files to a private GitHub repo so you can copy, edit, and re-import them.
          </p>
        </div>

        {status === 'idle' && (
          <button
            onClick={handleExport}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Export Source Code to GitHub
          </button>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            <p className="text-sm text-white/60">{progress}</p>
          </div>
        )}

        {status === 'done' && result && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center gap-2 justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Success!</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-sm space-y-2">
              <div className="flex justify-between text-white/60">
                <span>Files pushed:</span>
                <span className="text-emerald-400 font-bold">{result.pushed}</span>
              </div>
              {result.failed > 0 && (
                <div className="flex justify-between text-white/60">
                  <span>Failed:</span>
                  <span className="text-red-400 font-bold">{result.failed}</span>
                </div>
              )}
              <div className="flex justify-between text-white/60">
                <span>Repo:</span>
                <span className="text-white font-mono text-xs">{result.full_name}</span>
              </div>
            </div>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/15 transition-all flex items-center justify-center gap-2"
            >
              <Github className="w-4 h-4" />
              Open on GitHub
            </a>
            <button
              onClick={() => setStatus('idle')}
              className="text-white/40 text-sm hover:text-white/60 transition-colors"
            >
              Export again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-xs text-white/50 space-y-1">
              <p className="font-bold text-white/70">💡 Recommended alternative:</p>
              <p>Go to <strong className="text-white">Dashboard → Settings → GitHub</strong> and use the built-in 2-way GitHub Sync — it automatically exports ALL files reliably.</p>
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm hover:bg-white/15 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-white/30">
          <FileCode className="w-3 h-3" />
          <span>{SOURCE_FILES.length} source files</span>
        </div>
      </div>
    </div>
  );
}