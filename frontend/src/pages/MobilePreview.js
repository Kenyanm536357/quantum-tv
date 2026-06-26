import React from "react";

/** Pure-CSS preview of the mobile app screens. Renders inside the admin panel
 *  at phone width so you can see what your users see — without Expo Go. */

const PHONE_W = 280;
const PHONE_H = 600;

const Phone = ({ title, children }) => (
  <div className="flex flex-col items-center gap-3">
    <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">{title}</div>
    <div
      style={{ width: PHONE_W, height: PHONE_H }}
      className="rounded-[36px] border border-white/10 overflow-hidden relative shadow-[0_30px_80px_rgba(139,92,246,0.15)] bg-[#060714]"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-2xl z-30" />
      <div className="absolute inset-0 overflow-hidden">{children}</div>
    </div>
  </div>
);

const liveBg = "linear-gradient(135deg, #ec4899 10%, #8b5cf6 40%, #06b6d4 90%)";
const moviesBg1 = "linear-gradient(135deg, #1e293b, #0f172a)";

function LoginScreen() {
  return (
    <div className="h-full w-full px-6 pt-16 flex flex-col items-center">
      <div className="w-24 h-24 rounded-3xl shadow-[0_0_24px_rgba(139,92,246,0.5)] mb-4 overflow-hidden">
        <img src="/logo.png" alt="" className="w-full h-full object-cover" />
      </div>
      <div className="font-heading font-extrabold text-2xl gradient-text">Quantum TV</div>
      <div className="text-zinc-400 text-[11px] mt-2">Sign in to your account</div>
      <div className="w-full mt-7 space-y-3">
        <div className="text-[9px] uppercase tracking-[0.25em] text-zinc-400 font-heading">Username</div>
        <div className="h-11 rounded-xl bg-white/[0.05] border border-white/10 px-3 flex items-center text-zinc-300 text-xs">
          wesley
        </div>
        <div className="text-[9px] uppercase tracking-[0.25em] text-zinc-400 font-heading">Password</div>
        <div className="h-11 rounded-xl bg-white/[0.05] border border-white/10 px-3 flex items-center text-zinc-500 text-xs">
          •••••••••
        </div>
        <div className="h-11 rounded-full mt-3 flex items-center justify-center text-white font-heading font-bold text-sm shadow-[0_6px_22px_rgba(139,92,246,0.35)]"
             style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)" }}>
          Sign In
        </div>
      </div>
    </div>
  );
}

function BrowseScreen() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-5 pt-14">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Welcome back</div>
        <div className="font-heading font-extrabold text-2xl mt-1">Quantum <span style={{ color: "#06B6D4" }}>TV</span></div>
      </div>
      {/* Hero */}
      <div className="mx-5 mt-4 h-32 rounded-2xl overflow-hidden relative" style={{ background: liveBg }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent" />
        <div className="absolute left-3 top-3 bg-red-500 px-2 py-0.5 rounded text-[8px] font-heading font-extrabold tracking-widest">LIVE NOW</div>
        <div className="absolute bottom-3 left-3">
          <div className="text-white font-heading font-extrabold text-base">Flowers TV USA</div>
          <div className="text-zinc-300 text-[9px] mt-0.5">Featured Channel</div>
        </div>
      </div>
      {/* Continue Watching */}
      <div className="px-5 mt-4 flex items-center justify-between">
        <div className="font-heading font-bold text-sm">Continue Watching</div>
        <div className="text-cyan-400 text-[10px]">See all →</div>
      </div>
      <div className="px-5 flex gap-2 mt-2">
        {["#7c3aed", "#06b6d4", "#ec4899"].map((c, i) => (
          <div key={i} className="w-20 h-28 rounded-xl border border-white/5" style={{ background: `linear-gradient(135deg, ${c}, #0D0E23)` }} />
        ))}
      </div>
      {/* Recently */}
      <div className="px-5 mt-4 font-heading font-bold text-sm">Recently Added</div>
      <div className="px-5 flex gap-2 mt-2">
        {["#1e293b", "#312e81", "#0f766e"].map((c, i) => (
          <div key={i} className="w-20 h-28 rounded-xl border border-white/5" style={{ background: c }}>
            <div className="h-full bg-gradient-to-t from-black/80 to-transparent flex items-end p-1.5">
              <div className="text-[8px] text-white font-bold">Movie {i+1}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Tab bar */}
      <TabBar active="browse" />
    </div>
  );
}

function LiveTVScreen() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-5 pt-14">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Live</div>
        <div className="font-heading font-extrabold text-2xl mt-1">All Channels</div>
      </div>
      <div className="px-5 mt-3">
        <div className="h-9 rounded-xl bg-white/[0.05] border border-white/10 px-3 flex items-center text-[11px] text-zinc-500">🔍 Search channels…</div>
      </div>
      <div className="px-5 mt-3 flex gap-2">
        <div className="px-3 py-1 rounded-full bg-cyan-400 text-[#060714] text-[10px] font-heading font-bold">⚡ All</div>
        <div className="px-3 py-1 rounded-full border border-white/20 text-[10px]">🏆 Sports</div>
        <div className="px-3 py-1 rounded-full border border-white/20 text-[10px]">📰 News</div>
      </div>
      <div className="px-5 mt-3 grid grid-cols-2 gap-2 flex-1 overflow-hidden">
        {[liveBg, "linear-gradient(135deg,#16a34a,#84cc16)", "linear-gradient(135deg,#dc2626,#f97316)", "linear-gradient(135deg,#7c3aed,#3b82f6)"].map((g, i) => (
          <div key={i} className="h-24 rounded-xl border border-white/5 relative overflow-hidden" style={{ background: g }}>
            <div className="absolute top-1.5 left-1.5 bg-red-500 px-1.5 py-0.5 rounded text-[7px] font-heading font-extrabold tracking-widest">LIVE</div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            <div className="absolute bottom-1.5 left-1.5 right-1.5">
              <div className="text-white text-[10px] font-bold truncate">{["Flowers USA", "MBC 3", "ESPN HD", "Discovery"][i]}</div>
              <div className="text-zinc-300 text-[8px]">Ch {i + 1}</div>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="livetv" />
    </div>
  );
}

function MoviesScreen() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-5 pt-14">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Library</div>
        <div className="font-heading font-extrabold text-2xl mt-1">Movies</div>
        <div className="text-zinc-400 text-[10px] mt-1">412 items in Movies</div>
      </div>
      <div className="px-5 mt-4 grid grid-cols-3 gap-2 flex-1">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-lg border border-white/5 relative overflow-hidden"
               style={{ background: `linear-gradient(${135 + i*20}deg, hsl(${i*40},60%,40%), #0D0E23)` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            <div className="absolute bottom-1.5 left-1.5 right-1.5">
              <div className="text-white text-[8px] font-bold truncate">Movie {i+1}</div>
              <div className="text-zinc-400 text-[7px]">202{i%6}</div>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="movies" />
    </div>
  );
}

function PlayerScreen() {
  return (
    <div className="h-full w-full flex flex-col bg-black">
      <div className="flex-1 relative" style={{ background: liveBg }}>
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute top-12 left-3 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white">‹</div>
        <div className="absolute top-14 left-16 right-4 text-white font-heading font-bold text-sm">Flowers TV USA</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white text-3xl">▶</div>
        </div>
        <div className="absolute bottom-20 left-3 right-3">
          <div className="h-1 bg-white/20 rounded-full">
            <div className="h-1 bg-cyan-400 rounded-full w-1/3" />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-white/70">
            <span>14:23</span><span>-32:11</span>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-around">
          <div className="text-white/70 text-lg">⏮</div>
          <div className="text-white text-2xl">⏸</div>
          <div className="text-white/70 text-lg">⏭</div>
        </div>
      </div>
    </div>
  );
}

function TabBar({ active }) {
  const items = [
    { id: "browse", icon: "▦", label: "Browse" },
    { id: "livetv", icon: "📡", label: "Live TV" },
    { id: "movies", icon: "🎬", label: "Movies" },
    { id: "series", icon: "📺", label: "Series" },
    { id: "more", icon: "≡", label: "More" },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#060714]/95 border-t border-white/5 flex items-center justify-around backdrop-blur-md">
      {items.map((it) => (
        <div key={it.id} className="flex flex-col items-center gap-0.5">
          <div className={`text-base ${active === it.id ? "text-cyan-400" : "text-zinc-500"}`}>{it.icon}</div>
          <div className={`text-[8px] font-heading ${active === it.id ? "text-cyan-400" : "text-zinc-500"}`}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function MobilePreview() {
  return (
    <div data-testid="mobile-preview-page" className="fade-in">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Preview</div>
        <h1 className="font-heading text-3xl font-bold mt-1">What your users see</h1>
        <p className="text-zinc-400 text-sm mt-2">The native Quantum TV mobile app, rendered at phone size so you can review the design.</p>
      </div>
      <div className="flex flex-wrap gap-10 justify-center pt-4">
        <Phone title="Login"><LoginScreen /></Phone>
        <Phone title="Browse"><BrowseScreen /></Phone>
        <Phone title="Live TV"><LiveTVScreen /></Phone>
        <Phone title="Movies"><MoviesScreen /></Phone>
        <Phone title="Player"><PlayerScreen /></Phone>
      </div>
    </div>
  );
}
