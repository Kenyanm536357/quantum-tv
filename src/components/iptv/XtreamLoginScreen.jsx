import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';

export default function XtreamLoginScreen({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('fetchPlaylist', {
        action: 'get_live_categories',
        overrideUser: username.trim(),
        overridePass: password.trim(),
      });
      if (res.data && !res.data.error) {
        // Save credentials to localStorage
        localStorage.setItem('qtv_xtream_user', username.trim());
        localStorage.setItem('qtv_xtream_pass', password.trim());
        onLoggedIn({ username: username.trim(), password: password.trim() });
      } else {
        setError('Invalid username or password. Please try again.');
      }
    } catch (err) {
      setError('Unable to connect. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}
    >
      {/* Glow blobs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-20 h-20 rounded-[24px] overflow-hidden shadow-2xl shadow-violet-500/30 border border-white/10 mb-4">
            <img src="/logo.png" alt="Quantum TV" className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; }} />
            <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white bg-gradient-to-br from-violet-600 to-cyan-500">Q</div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Quantum<span className="text-cyan-400">TV</span>
          </h1>
          <p className="text-white/40 text-sm mt-1">Login Required</p>
        </div>

        {/* Login card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5 block">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/60 focus:bg-white/10 transition-all"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl font-bold text-sm text-black bg-gradient-to-r from-cyan-400 to-violet-500 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Connecting…
                </>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Contact your service provider for credentials
        </p>
      </motion.div>
    </div>
  );
}