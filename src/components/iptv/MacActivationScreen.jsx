import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, Settings, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const BG = (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <div className="absolute top-[-10%] left-[30%] w-[600px] h-[400px] rounded-full blur-[130px]"
      style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, rgba(99,51,220,0.15) 60%, transparent 100%)' }} />
    <div className="absolute bottom-0 right-[-10%] w-[400px] h-[400px] rounded-full blur-[120px]"
      style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(14,116,196,0.1) 60%, transparent 100%)' }} />
    <div className="absolute inset-0 opacity-[0.03]"
      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
  </div>
);

// Base URL will be fetched from backend or use default
const getXtreamBase = async () => {
  try {
    const res = await base44.functions.invoke('fetchPlaylist', { action: 'get_live_categories', validateOnly: true });
    return res.data?.baseUrl || 'http://pro.flickhaven.online';
  } catch {
    return 'http://pro.flickhaven.online';
  }
};

let XTREAM_BASE = 'http://pro.flickhaven.online';

export default function MacActivationScreen({ onActivated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Use backend-configured base URL if available
      const baseUrl = XTREAM_BASE;
      const res = await base44.functions.invoke('fetchPlaylist', {
        action: 'get_live_categories',
        baseUrl,
        username: username.trim(),
        password: password.trim(),
        validateOnly: true,
      });

      if (res.data && !res.data.error) {
        // Save credentials to localStorage (Xtream Codes only)
        localStorage.setItem('qtv_xtream_creds', JSON.stringify({
          baseUrl,
          username: username.trim(),
          password: password.trim(),
        }));
        setSuccess(true);
        setTimeout(() => onActivated(), 1400);
      } else {
        setError('Invalid username or password. Please try again.');
      }
    } catch {
      setError('Connection failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center p-5 relative overflow-y-auto"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)', paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
    >
      {BG}

      {/* Admin settings button */}
      <a
        href="/admin/activation"
        className="fixed z-50 w-12 h-12 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-all touch-manipulation"
        style={{ top: 'calc(env(safe-area-inset-top) + 56px)', right: '1rem' }}
      >
        <Settings className="w-5 h-5" />
      </a>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex flex-col items-center text-center gap-5"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50 flex items-center justify-center"
              style={{ boxShadow: '0 0 40px rgba(52,211,153,0.4)' }}>
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Welcome!</h2>
              <p className="text-sm text-emerald-400 mt-1">Loading Quantum TV…</p>
            </div>
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative w-full max-w-sm flex flex-col items-center text-center gap-6"
          >
            {/* Logo */}
            <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden border-2 border-violet-500/50"
              style={{ boxShadow: '0 0 40px rgba(167,139,250,0.5), 0 0 80px rgba(139,92,246,0.2)' }}>
              <img
                src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/7cb772c8e_QUANTUMTVLOGOver2.png"
                alt="Quantum TV"
                className="w-full h-full object-cover scale-110"
              />
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Quantum TV
              </h1>
              <p className="text-xs text-white/40 mt-1">Sign in to your account</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="w-full bg-white/4 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">

              {/* Username */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm font-medium focus:outline-none focus:border-violet-500/60 focus:bg-black/40 transition-all"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pr-11 text-white placeholder-white/20 text-sm font-medium focus:outline-none focus:border-violet-500/60 focus:bg-black/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-sm hover:opacity-90 active:opacity-80 transition-all disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In'}
              </button>
            </form>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}