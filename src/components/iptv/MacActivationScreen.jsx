import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Copy, CheckCircle, Loader2, Shield, Tv2 } from 'lucide-react';
import { getDeviceMAC, activateDevice } from '@/lib/mac-auth';
import { base44 } from '@/api/base44Client';

const POLL_INTERVAL = 10000; // check every 10 seconds

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

export default function MacActivationScreen({ onActivated }) {
  const [mac, setMac] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('waiting'); // 'waiting' | 'checking' | 'activated' | 'error'
  const [dotCount, setDotCount] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    const m = getDeviceMAC();
    setMac(m);
    startPolling(m);

    // Animated dots
    const dotTimer = setInterval(() => setDotCount(d => (d + 1) % 4), 600);

    return () => {
      clearInterval(dotTimer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkActivation = async (macAddr) => {
    try {
      setStatus('checking');
      const res = await base44.functions.invoke('checkActivation', { mac: macAddr });
      if (res.data?.activated) {
        setStatus('activated');
        if (pollRef.current) clearInterval(pollRef.current);
        activateDevice(macAddr);
        setTimeout(() => onActivated(), 1500);
      } else {
        setStatus('waiting');
      }
    } catch {
      setStatus('waiting'); // silently retry
    }
  };

  const startPolling = (macAddr) => {
    // Check immediately
    checkActivation(macAddr);
    // Then poll every 10s
    pollRef.current = setInterval(() => checkActivation(macAddr), POLL_INTERVAL);
  };

  const copyMAC = async () => {
    try {
      await navigator.clipboard.writeText(mac);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const dots = '.'.repeat(dotCount);

  const isActivated = status === 'activated';

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}
    >
      {BG}

      <AnimatePresence mode="wait">
        {isActivated ? (
          <motion.div
            key="activated"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex flex-col items-center text-center gap-5"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/50 flex items-center justify-center"
              style={{ boxShadow: '0 0 40px rgba(52,211,153,0.4)' }}>
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Device Activated!</h2>
              <p className="text-sm text-emerald-400 mt-1">Loading Quantum TV…</p>
            </div>
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="relative w-full max-w-sm flex flex-col items-center text-center gap-6"
          >
            {/* Logo */}
            <div className="w-20 h-20 rounded-[1.5rem] overflow-hidden border-2 border-violet-500/50"
              style={{ boxShadow: '0 0 40px rgba(167,139,250,0.5), 0 0 80px rgba(139,92,246,0.2)' }}>
              <img
                src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/3349a49f0_QUANTUMTVLOGOver2.png"
                alt="Quantum TV"
                className="w-full h-full object-cover scale-110"
              />
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Quantum TV
              </h1>
              <p className="text-xs text-white/40 mt-1">Device Activation Required</p>
            </div>

            {/* MAC Address Card */}
            <div className="w-full bg-white/4 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">

              {/* Pulsing status icon */}
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border border-violet-500/40 animate-ping" />
                  <div className="absolute inset-[-6px] rounded-full border border-violet-500/20 animate-ping" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>

              {/* MAC display */}
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Your Device ID</p>
                <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono text-base font-bold tracking-widest text-cyan-400 select-all">
                    {mac || '···:···:···:···'}
                  </span>
                  <button
                    onClick={copyMAC}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    {copied
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <Copy className="w-4 h-4 text-white/40" />
                    }
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2.5 text-left">
                <Shield className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/55 leading-relaxed">
                  Share this Device ID with <span className="text-violet-300 font-semibold">QuantumTek</span> to activate your subscription. The app will unlock automatically once approved.
                </p>
              </div>
            </div>

            {/* Polling status */}
            <div className="w-full flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white/4 border border-white/8 rounded-xl">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />
                <span className="text-sm text-white/50">
                  Waiting for activation{dots}
                </span>
              </div>
              <p className="text-[11px] text-white/20">
                Checking automatically every 10 seconds
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}