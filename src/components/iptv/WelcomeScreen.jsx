import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Film, Plus, ChevronRight, ArrowLeft } from 'lucide-react';
import LoginScreen from './LoginScreen';

const PLAYLIST_TYPES = [
  {
    id: 'live',
    icon: Radio,
    label: 'Live TV',
    description: 'Watch live channels from your provider',
    color: 'from-violet-500/20 to-violet-600/10',
    border: 'border-violet-500/30',
    iconColor: 'text-violet-400',
    glow: 'rgba(139,92,246,0.4)',
  },
  {
    id: 'vod',
    icon: Film,
    label: 'Video on Demand',
    description: 'Movies, series and on-demand content',
    color: 'from-cyan-500/20 to-cyan-600/10',
    border: 'border-cyan-500/30',
    iconColor: 'text-cyan-400',
    glow: 'rgba(56,189,248,0.4)',
  },
];

const BG = (
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
);

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
};

export default function WelcomeScreen() {
  // step: 'welcome' | 'pick' | 'login'
  const [step, setStep] = useState('welcome');
  const [pickedType, setPickedType] = useState(null);

  const handlePick = (type) => {
    setPickedType(type);
    setStep('login');
  };

  // Once logged in, LoginScreen calls saveCredentials which triggers re-render in Home
  // so we just need to show it
  if (step === 'login') {
    return <LoginScreen onBack={() => setStep('pick')} contentType={pickedType} />;
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)' }}
    >
      {BG}

      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div key="welcome" variants={slide} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-sm flex flex-col items-center text-center gap-6">

            {/* Logo */}
            <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-violet-500/50"
              style={{ boxShadow: '0 0 50px rgba(167,139,250,0.6), 0 0 100px rgba(139,92,246,0.25)' }}>
              <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/3349a49f0_QUANTUMTVLOGOver2.png"
                alt="Quantum TV" className="w-full h-full object-cover scale-110" />
            </div>

            <div>
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Quantum TV
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Your personal IPTV player</p>
            </div>

            <button
              onClick={() => setStep('pick')}
              style={{ minHeight: 52 }}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-violet-500/30 active:scale-[0.98] transition-all select-none"
            >
              <Plus className="w-5 h-5" />
              Add Playlist
            </button>

          </motion.div>
        )}

        {step === 'pick' && (
          <motion.div key="pick" variants={slide} initial="initial" animate="animate" exit="exit"
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-sm flex flex-col gap-5">

            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('welcome')} style={{ minHeight: 40, minWidth: 40 }}
                className="rounded-xl bg-white/5 border border-white/10 flex items-center justify-center select-none">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <h2 className="text-xl font-black text-foreground">Add Playlist</h2>
                <p className="text-xs text-muted-foreground">Choose your content type</p>
              </div>
            </div>

            {/* Type cards */}
            <div className="flex flex-col gap-3">
              {PLAYLIST_TYPES.map(pt => {
                const Icon = pt.icon;
                return (
                  <button key={pt.id} onClick={() => handlePick(pt.id)}
                    style={{ minHeight: 80 }}
                    className={`flex items-center gap-4 p-5 rounded-2xl border bg-gradient-to-r ${pt.color} ${pt.border} transition-all active:scale-[0.97] select-none text-left`}
                    style={{ minHeight: 80, boxShadow: `0 0 0 0 ${pt.glow}` }}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${pt.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-foreground text-base">{pt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pt.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}