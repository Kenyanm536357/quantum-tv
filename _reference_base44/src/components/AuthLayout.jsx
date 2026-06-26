import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-y-auto"
      style={{
        background: 'radial-gradient(ellipse at 60% 0%, #1a0a3d 0%, #0a0f2e 40%, #060a1a 100%)',
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
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

      <div className="relative w-full max-w-[420px] flex-shrink-0">
        {/* Logo + title */}
        <div className="text-center mb-6">
          <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-2 border-violet-500/50 mx-auto mb-4"
            style={{ boxShadow: '0 0 50px rgba(167,139,250,0.6), 0 0 100px rgba(139,92,246,0.25)' }}>
            <img src="https://media.base44.com/images/public/6a058bb7dcc660a537bc8137/3349a49f0_QUANTUMTVLOGOver2.png"
              alt="Quantum TV" className="w-full h-full object-cover scale-110" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-violet-500/20 p-6 sm:p-8"
          style={{ background: 'rgba(15, 10, 40, 0.75)', backdropFilter: 'blur(20px)' }}>
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-5">{footer}</p>
        )}
      </div>
    </div>
  );
}