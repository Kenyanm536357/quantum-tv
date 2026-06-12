import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Copy, CheckCircle, RefreshCw, Wifi, Shield } from 'lucide-react';
import { getDeviceMAC, activateDevice } from '@/lib/mac-auth';

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
  const [checking, setChecking] = useState(false);
  const [pulseRing, setPulseRing] = useState(true);

  useEffect(() => {
    setMac(getDeviceMAC());
  }, []);

  const copyMAC = async () => {
    try {
      await navigator.clipboard.writeText(mac);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback — select the text
    }
  };

  // Admin-side activation: once you activate in Multi-Player,
  // you send the customer a code or they tap "I'm Activated"
  const handleActivationConfirm = () => {
    setChecking(true);
    setTimeout(() => {
      activateDevice(mac);
      onActivated();
    }, 1200);
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-5 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}
    >
      {BG}

      <motion.div
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
          {/* Pulsing indicator */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-violet-400" />
              </div>
              {pulseRing && (
                <>
                  <div className="absolute inset-0 rounded-full border border-violet-500/40 animate-ping" />
                  <div className="absolute inset-[-6px] rounded-full border border-violet-500/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-2">Your Device ID</p>
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
              <span className="flex-1 font-mono text-lg font-bold tracking-widest text-cyan-400 select-all">
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

          <div className="flex items-start gap-2.5 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2.5 text-left">
            <Shield className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/55 leading-relaxed">
              Share this Device ID with <span className="text-violet-300 font-semibold">QuantumTek</span> to activate your subscription. Once activated, the app will load automatically.
            </p>
          </div>
        </div>

        {/* Status / Actions */}
        <div className="w-full flex flex-col gap-3">
          {/* Already activated button */}
          <button
            onClick={handleActivationConfirm}
            disabled={checking}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-violet-500/30 active:scale-[0.98] transition-all select-none disabled:opacity-60"
            style={{ minHeight: 52 }}
          >
            {checking ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Activating…
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5" />
                I've Been Activated — Enter App
              </>
            )}
          </button>

          <p className="text-[11px] text-white/25 leading-relaxed">
            Contact support if you haven't received your activation yet
          </p>
        </div>
      </motion.div>
    </div>
  );
}