import React from "react";

/** Pure-CSS preview of the Quantum TV app rendered at 16:9 Fire TV ratio,
 *  showing D-pad focus rings on the highlighted element of each screen. */

const TV_W = 480;
const TV_H = Math.round(TV_W * 9 / 16);

const TV = ({ title, children, sub }) => (
  <div className="flex flex-col items-center gap-3">
    <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">{title}</div>
    {sub && <div className="text-[10px] text-zinc-600 font-mono -mt-2">{sub}</div>}
    {/* Mock TV bezel */}
    <div className="rounded-[14px] bg-zinc-950 p-2 shadow-[0_30px_80px_rgba(6,182,212,0.15)] border border-white/5">
      <div
        style={{ width: TV_W, height: TV_H }}
        className="rounded-md overflow-hidden relative bg-[#060714]"
      >
        {children}
      </div>
    </div>
    {/* Mock stand */}
    <div className="w-32 h-1.5 bg-zinc-800 rounded-b-md" />
    <div className="w-44 h-1 bg-zinc-900 rounded-full -mt-2" />
  </div>
);

const Focus = ({ children, className = "" }) => (
  <div
    className={`relative transform-gpu scale-[1.04] ${className}`}
    style={{
      boxShadow: "0 0 0 3px #06B6D4, 0 0 28px rgba(6,182,212,0.6)",
      borderRadius: 14,
      transition: "all 200ms",
    }}
  >
    {children}
  </div>
);

const liveBg = "linear-gradient(135deg, #ec4899 10%, #8b5cf6 40%, #06b6d4 90%)";

function FireTVHome() {
  return (
    <div className="h-full w-full bg-gradient-to-br from-[#0c111f] via-[#0a0e1a] to-[#070a13] p-4">
      <div className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 mb-1">YOUR APPS & CHANNELS</div>
      <div className="flex gap-2 mt-2">
        {[
          { name: "Netflix", c: "#e50914" },
          { name: "Prime Video", c: "#00a8e1" },
          { name: "Quantum TV", c: "logo", focused: true },
          { name: "YouTube", c: "#ff0000" },
          { name: "Disney+", c: "#1a1d29" },
          { name: "Hulu", c: "#1ce783" },
        ].map((app, i) => {
          const node = (
            <div className="w-16 h-20 rounded-md overflow-hidden flex flex-col items-center justify-end pb-1" style={{ background: app.c === "logo" ? "#060714" : app.c }}>
              {app.c === "logo" ? (
                <img src="/logo.png" className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="text-[8px] text-white font-bold text-center px-1">{app.name}</div>
              )}
            </div>
          );
          return app.focused ? (
            <div key={i} className="relative">
              <Focus className="rounded-md">{node}</Focus>
              <div className="absolute -bottom-5 left-0 right-0 text-center text-[8px] text-cyan-400 font-heading">Quantum TV</div>
            </div>
          ) : (
            <div key={i}>{node}</div>
          );
        })}
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[9px] text-zinc-500">
        <span>Press OK to launch</span>
        <span className="font-mono">Fire TV Home</span>
      </div>
    </div>
  );
}

function LoginTV() {
  return (
    <div className="h-full w-full flex">
      <div className="flex-1 flex flex-col justify-center px-12">
        <img src="/logo.png" className="w-16 h-16 rounded-2xl mb-3 shadow-[0_0_24px_rgba(139,92,246,0.6)]" alt="" />
        <div className="font-heading font-extrabold text-3xl gradient-text">Quantum TV</div>
        <div className="text-zinc-400 text-xs mt-1">Sign in to your account</div>
      </div>
      <div className="flex-1 flex flex-col justify-center pr-12 gap-3">
        <div className="text-[8px] uppercase tracking-[0.25em] text-zinc-400">USERNAME</div>
        <div className="h-9 rounded-xl bg-white/[0.05] border border-white/10 px-3 flex items-center text-zinc-300 text-xs">wesley</div>
        <div className="text-[8px] uppercase tracking-[0.25em] text-zinc-400">PASSWORD</div>
        <div className="h-9 rounded-xl bg-white/[0.05] border border-white/10 px-3 flex items-center text-zinc-500 text-xs">•••••••••</div>
        <Focus className="rounded-full mt-2">
          <div className="h-10 rounded-full flex items-center justify-center text-white font-heading font-bold text-xs"
               style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
            Sign In
          </div>
        </Focus>
      </div>
    </div>
  );
}

function BrowseTV() {
  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[8px] uppercase tracking-[0.25em] text-zinc-500">Welcome back</div>
          <div className="font-heading font-extrabold text-xl">Quantum <span style={{ color: "#06B6D4" }}>TV</span></div>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded-full bg-cyan-400 text-[#060714] text-[9px] font-heading font-bold">⚡ Browse</div>
          <div className="text-zinc-500 text-[9px] px-3 py-1">Live</div>
          <div className="text-zinc-500 text-[9px] px-3 py-1">Movies</div>
          <div className="text-zinc-500 text-[9px] px-3 py-1">Series</div>
        </div>
      </div>
      {/* Hero */}
      <div className="flex-1 rounded-xl overflow-hidden relative mb-3" style={{ background: liveBg }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent" />
        <div className="absolute left-3 top-2 bg-red-500 px-1.5 py-0.5 rounded text-[7px] font-heading font-extrabold tracking-widest">LIVE NOW</div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-white font-heading font-extrabold text-lg">Flowers TV USA</div>
          <div className="text-zinc-300 text-[9px] mt-0.5">Featured Channel · Now playing classics</div>
        </div>
      </div>
      {/* Continue Watching row with focused tile */}
      <div className="flex items-center justify-between mb-1">
        <div className="font-heading font-bold text-xs">Continue Watching</div>
        <div className="text-cyan-400 text-[9px]">See all →</div>
      </div>
      <div className="flex gap-2">
        {["#7c3aed", "#06b6d4", "#ec4899", "#f59e0b"].map((c, i) => {
          const node = (
            <div className="w-20 h-12 rounded-md border border-white/5" style={{ background: `linear-gradient(135deg, ${c}, #0D0E23)` }}>
              <div className="h-full bg-gradient-to-t from-black/80 to-transparent flex items-end p-1">
                <div className="text-[7px] text-white font-bold truncate">Title {i+1}</div>
              </div>
            </div>
          );
          return i === 1 ? <Focus key={i} className="rounded-md">{node}</Focus> : <div key={i}>{node}</div>;
        })}
      </div>
    </div>
  );
}

function LiveTVScreen() {
  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[8px] uppercase tracking-[0.25em] text-zinc-500">LIVE</div>
          <div className="font-heading font-extrabold text-xl">All Channels</div>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded-full bg-cyan-400 text-[#060714] text-[9px] font-heading font-bold">⚡ All</div>
          <div className="text-zinc-500 text-[9px] px-2 py-1 border border-white/10 rounded-full">🏆 Sports</div>
          <div className="text-zinc-500 text-[9px] px-2 py-1 border border-white/10 rounded-full">📰 News</div>
          <div className="text-zinc-500 text-[9px] px-2 py-1 border border-white/10 rounded-full">🎬 Movies</div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 flex-1">
        {[liveBg, "linear-gradient(135deg,#16a34a,#84cc16)", "linear-gradient(135deg,#dc2626,#f97316)",
          "linear-gradient(135deg,#7c3aed,#3b82f6)", "linear-gradient(135deg,#0ea5e9,#06b6d4)",
          "linear-gradient(135deg,#a855f7,#ec4899)", "linear-gradient(135deg,#facc15,#f59e0b)",
          "linear-gradient(135deg,#10b981,#06b6d4)", "linear-gradient(135deg,#1f2937,#374151)",
          "linear-gradient(135deg,#be185d,#7e22ce)"].map((g, i) => {
          const card = (
            <div className="h-full rounded-md border border-white/5 relative overflow-hidden" style={{ background: g }}>
              <div className="absolute top-1 left-1 bg-red-500 px-1 rounded text-[6px] font-heading font-extrabold tracking-widest">LIVE</div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
              <div className="absolute bottom-1 left-1 right-1">
                <div className="text-white text-[8px] font-bold truncate">{["Flowers", "MBC 3", "ESPN", "Fox", "CNN", "HBO", "AMC", "Disc.", "TBS", "MTV"][i]}</div>
                <div className="text-zinc-300 text-[6px]">Ch {i+1}</div>
              </div>
            </div>
          );
          return i === 2 ? <Focus key={i} className="rounded-md">{card}</Focus> : <div key={i}>{card}</div>;
        })}
      </div>
    </div>
  );
}

function MoviesTV() {
  return (
    <div className="h-full w-full flex flex-col p-4">
      <div className="mb-3">
        <div className="text-[8px] uppercase tracking-[0.25em] text-zinc-500">LIBRARY</div>
        <div className="font-heading font-extrabold text-xl">Movies <span className="text-zinc-500 text-[10px] font-mono">412 titles</span></div>
      </div>
      <div className="grid grid-cols-6 gap-2 flex-1">
        {[...Array(12)].map((_, i) => {
          const node = (
            <div className="rounded-md border border-white/5 relative overflow-hidden h-full"
                 style={{ background: `linear-gradient(${135 + i*20}deg, hsl(${i*40},60%,40%), #0D0E23)` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
              <div className="absolute bottom-1 left-1 right-1">
                <div className="text-white text-[7px] font-bold truncate">Movie {i+1}</div>
              </div>
            </div>
          );
          return i === 4 ? <Focus key={i} className="rounded-md">{node}</Focus> : <div key={i}>{node}</div>;
        })}
      </div>
    </div>
  );
}

function PlayerTV() {
  return (
    <div className="h-full w-full bg-black relative">
      <div className="absolute inset-0" style={{ background: liveBg }}>
        <div className="absolute inset-0 bg-black/40" />
      </div>
      <div className="absolute top-3 left-3 right-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white text-sm">‹</div>
        <div className="text-white font-heading font-bold text-sm">Flowers TV USA</div>
        <div className="ml-auto bg-red-500 px-2 py-0.5 rounded text-[8px] font-heading font-extrabold tracking-widest">● LIVE</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Focus className="rounded-full">
          <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center text-white text-2xl">▶</div>
        </Focus>
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <div className="h-1 bg-white/20 rounded-full">
          <div className="h-1 bg-cyan-400 rounded-full w-1/3" />
        </div>
        <div className="flex items-center justify-between mt-1 text-[9px] text-white/80 font-mono">
          <span>14:23</span>
          <span>OK = Play/Pause · ← → seek 10s · ↓ shows controls</span>
          <span>-32:11</span>
        </div>
      </div>
    </div>
  );
}

export default function FireTVPreview() {
  return (
    <div data-testid="firetv-preview-page" className="fade-in">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Preview</div>
        <h1 className="font-heading text-3xl font-bold mt-1">How it looks on Fire TV</h1>
        <p className="text-zinc-400 text-sm mt-2 max-w-3xl">
          Quantum TV at 16:9 — landscape, large fonts, and big <span className="text-cyan-400">cyan focus rings</span> so
          you always know which item the D-pad remote is on. The highlighted tile on each screen below is what gets focus when you start.
        </p>
      </div>
      <div className="flex flex-wrap gap-10 justify-center pt-4">
        <TV title="Fire TV Home" sub="Apps & Channels row"><FireTVHome /></TV>
        <TV title="Login" sub="Sign In button focused"><LoginTV /></TV>
        <TV title="Browse" sub="Continue Watching focused"><BrowseTV /></TV>
        <TV title="Live TV" sub="ESPN channel focused"><LiveTVScreen /></TV>
        <TV title="Movies" sub="Poster #5 focused"><MoviesTV /></TV>
        <TV title="Player" sub="Play button focused"><PlayerTV /></TV>
      </div>
    </div>
  );
}
