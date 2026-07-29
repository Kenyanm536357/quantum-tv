import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useParams, Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Grid3X3, Radio, Film, Search, Bookmark, Heart, LogOut, Play,
  ChevronLeft, ChevronRight, X, Plus, Check, Loader2, Star,
} from "lucide-react";
import api, { ASSET_BASE } from "../api";
import VideoPlayer from "../components/VideoPlayer";

// ---------- Helpers ----------
function userInfo() {
  try { return JSON.parse(localStorage.getItem("qtv_user") || "null"); } catch { return null; }
}

function logout() {
  localStorage.removeItem("qtv_user_token");
  localStorage.removeItem("qtv_user");
  window.location.href = "/login";
}

const RequireUser = ({ children }) => {
  const t = localStorage.getItem("qtv_user_token");
  if (!t) return <Navigate to="/login" replace />;
  return children;
};

// ---------- Layout ----------
function WatchShell({ children }) {
  const u = userInfo();
  const tabs = [
    { to: "/watch",         label: "Browse",    icon: Grid3X3,  end: true },
    { to: "/watch/live",    label: "Live TV",   icon: Radio },
    { to: "/watch/movies",  label: "Movies",    icon: Film },
    { to: "/watch/watchlist", label: "Watchlist", icon: Bookmark },
    { to: "/watch/favorites", label: "Favorites", icon: Heart },
    { to: "/watch/search",  label: "Search",    icon: Search },
  ];
  return (
    <div className="min-h-screen relative z-10">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060714]/85 border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-6">
          <Link to="/watch" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img src="/logo.png" alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-glow" />
            <div className="font-heading font-bold gradient-text text-sm sm:text-base hidden xs:block">QUANTUM TV</div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4 flex-1">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-testid={`watch-nav-${label.toLowerCase().replace(" ", "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-body transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-purple-500/30 to-cyan-500/20 text-white border border-cyan-400/30"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <div className="hidden sm:flex flex-col items-end">
              <div className="text-xs text-zinc-500">Signed in as</div>
              <div className="text-sm font-medium truncate max-w-[140px]">{u?.display_name || u?.username}</div>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-heading font-bold text-sm shrink-0">
              {(u?.display_name || u?.username || "?").slice(0, 1).toUpperCase()}
            </div>
            <button data-testid="watch-logout" onClick={logout} className="p-2 rounded-lg text-zinc-400 hover:text-red-300 hover:bg-red-500/10" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Mobile tabs */}
        <nav className="md:hidden flex overflow-x-auto px-3 py-2 gap-1.5 border-t border-white/5 scrollbar-thin">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              data-testid={`watch-nav-mobile-${label.toLowerCase().replace(" ", "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 ${
                  isActive ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-zinc-400 hover:bg-white/5"
                }`
              }>
              <Icon className="w-3.5 h-3.5" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-24 overflow-x-hidden">{children}</main>
    </div>
  );
}

// ---------- Shared media card ----------
function MediaCard({ item, size = "md", fluid = false, testid }) {
  const nav = useNavigate();
  const w = size === "lg" ? 220 : size === "sm" ? 130 : 170;
  const h = Math.round(w * 1.5);
  const wrapperStyle = fluid ? undefined : { width: w };
  const posterStyle = fluid ? undefined : { height: h };
  // Shows + Seasons land on the show-detail page; everything else streams directly.
  const goTo = () => {
    if (item.type === "show") {
      nav(`/watch/show/${item.rating_key}`, { state: { item } });
    } else if (item.type === "season") {
      nav(`/watch/show/${item.parent_rating_key || item.rating_key}`, { state: { item } });
    } else {
      nav(`/watch/play/${item.rating_key}`, { state: { item } });
    }
  };
  return (
    <motion.button
      data-testid={testid || `card-${item.rating_key}`}
      onClick={goTo}
      whileHover={{ scale: 1.04, y: -3 }}
      transition={{ duration: 0.18 }}
      style={wrapperStyle}
      className={`text-left group ${fluid ? "w-full" : "shrink-0"}`}
    >
      <div
        style={posterStyle}
        className={`rounded-xl overflow-hidden bg-white/[0.04] border border-white/5 relative ${fluid ? "aspect-[2/3]" : ""}`}
      >
        {item.thumb ? (
          <img src={item.thumb && item.thumb.startsWith("http") ? item.thumb : item.thumb ? `${ASSET_BASE}${item.thumb}` : undefined} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-cyan-900/40 flex items-center justify-center">
            <Film className="w-8 h-8 text-zinc-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cyan-500/90 flex items-center justify-center shadow-cyan">
            <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white" />
          </div>
        </div>
        <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-2 sm:left-2 sm:right-2">
          <div className="text-white text-xs sm:text-sm font-medium truncate">{item.title}</div>
          {item.year && <div className="text-zinc-400 text-[10px] sm:text-xs">{item.year}</div>}
        </div>
      </div>
    </motion.button>
  );
}

// ---------- Hero (featured) ----------
function FeaturedHero({ item }) {
  const nav = useNavigate();
  if (!item) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      className="relative h-[220px] sm:h-[300px] lg:h-[360px] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/5 mb-6 sm:mb-10"
    >
      {item.art ? (
        <img src={`${ASSET_BASE}${item.art}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-700 to-cyan-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#060714] via-[#060714]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#060714] via-[#060714]/40 to-transparent" />
      <div className="relative h-full flex flex-col justify-end p-5 sm:p-8 lg:p-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 self-start bg-red-500 px-2.5 py-1 sm:px-3 rounded-full text-[10px] sm:text-xs font-heading font-bold mb-2 sm:mb-4 tracking-widest">● FEATURED</div>
        <h2 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">{item.title}</h2>
        {item.year && <div className="text-zinc-400 text-xs sm:text-sm mt-1 sm:mt-2">{item.year}</div>}
        {item.summary && <p className="text-zinc-300 text-xs sm:text-sm mt-2 sm:mt-4 line-clamp-2 sm:line-clamp-3 max-w-xl">{item.summary}</p>}
        <button
          data-testid="hero-play"
          onClick={() => {
            if (item.type === "show") nav(`/watch/show/${item.rating_key}`, { state: { item } });
            else nav(`/watch/play/${item.rating_key}`, { state: { item } });
          }}
          className="btn-gradient mt-4 sm:mt-6 px-5 py-2.5 sm:px-7 sm:py-3.5 flex items-center gap-2 self-start text-xs sm:text-sm"
        >
          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" /> Watch Now
        </button>
      </div>
    </motion.div>
  );
}

// ---------- Carousel ----------
function Row({ title, items, size = "md", emptyText = "Nothing here yet" }) {
  const ref = useRef();
  if (!items) {
    return (
      <div className="mb-8 sm:mb-10">
        <h3 className="font-heading text-base sm:text-xl font-bold mb-3 sm:mb-4">{title}</h3>
        <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-thin -mx-4 sm:-mx-2 px-4 sm:px-2 pb-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-32 h-48 sm:w-44 sm:h-64 rounded-xl bg-white/[0.03] animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="mb-8 sm:mb-10">
        <h3 className="font-heading text-base sm:text-xl font-bold mb-2">{title}</h3>
        <div className="text-xs sm:text-sm text-zinc-500">{emptyText}</div>
      </div>
    );
  }
  const scroll = (d) => ref.current?.scrollBy({ left: d, behavior: "smooth" });
  return (
    <div className="mb-8 sm:mb-10">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-heading text-base sm:text-xl font-bold">{title}</h3>
        <div className="hidden sm:flex gap-2">
          <button onClick={() => scroll(-400)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => scroll(400)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-thin -mx-4 sm:-mx-2 px-4 sm:px-2 pb-2 snap-x">
        {items.map((it) => <div key={it.rating_key} className="snap-start"><MediaCard item={it} size={size} /></div>)}
      </div>
    </div>
  );
}

// ---------- Browse ----------
function Browse() {
  const recent = useQuery({ queryKey: ["recent"], queryFn: async () => (await api.get("/recently-added?limit=20")).data });
  const onDeck = useQuery({ queryKey: ["ondeck"], queryFn: async () => (await api.get("/continue-watching?limit=20")).data });
  const featured = (onDeck.data?.items?.[0]) || (recent.data?.items?.[0]);

  return (
    <div className="fade-in">
      {featured && <FeaturedHero item={featured} />}
      <Row title="Continue Watching" items={onDeck.data?.items} emptyText="Once you start watching, picks will land here." />
      <Row title="Recently Added" items={recent.data?.items} size="lg" />
    </div>
  );
}

// ---------- Shared filter / sort menu ----------
function SortMenu({ options, value, onChange, testidPrefix = "sort" }) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.id === value)?.label || "Sort";
  return (
    <div className="relative">
      <button
        data-testid={`${testidPrefix}-button`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
        {current}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 glass rounded-2xl p-1.5 z-30 shadow-xl">
            {options.map((opt) => (
              <button
                key={opt.id}
                data-testid={`${testidPrefix}-${opt.id}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors ${value === opt.id ? "bg-gradient-to-r from-purple-500/30 to-cyan-500/20 text-white" : "text-zinc-300 hover:bg-white/5"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Client-side sort helper for lists
const COMPARERS = {
  "addedAt:desc":     (a, b) => (b.added_at || 0) - (a.added_at || 0),
  "addedAt:asc":      (a, b) => (a.added_at || 0) - (b.added_at || 0),
  "year:desc":        (a, b) => (b.year || 0) - (a.year || 0),
  "year:asc":         (a, b) => (a.year || 0) - (b.year || 0),
  "title:asc":        (a, b) => (a.title || "").localeCompare(b.title || ""),
  "title:desc":       (a, b) => (b.title || "").localeCompare(a.title || ""),
  "rating:desc":      (a, b) => (b.audience_rating || 0) - (a.audience_rating || 0),
};
function applySort(items, key) {
  if (!Array.isArray(items)) return items;
  const cmp = COMPARERS[key];
  return cmp ? [...items].sort(cmp) : items;
}

// ---------- IPTV Movies view ----------
const SORT_OPTIONS = [
  { id: "addedAt:desc", label: "Newest added" },
  { id: "addedAt:asc", label: "Oldest added" },
  { id: "title:asc", label: "Title A → Z" },
  { id: "title:desc", label: "Title Z → A" },
  { id: "year:desc", label: "Newest release" },
  { id: "year:asc", label: "Oldest release" },
  { id: "rating:desc", label: "Highest rated" },
];

function IptvMoviesView() {
  const [sort, setSort] = React.useState("addedAt:desc");
  const { data, isLoading } = useQuery({
    queryKey: ["iptv-vod"],
    queryFn: async () => (await api.get("/iptv/vod/streams")).data,
    staleTime: 60_000,
  });
  const items = applySort(data?.items || [], sort);
  return (
    <div className="fade-in">
      <div className="mb-5 sm:mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 font-heading">IPTV</div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-1">Movies</h1>
          {data && <div className="text-zinc-400 text-xs sm:text-sm mt-2">{(data.total ?? items.length).toLocaleString()} titles</div>}
        </div>
        <SortMenu options={SORT_OPTIONS} value={sort} onChange={setSort} />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-zinc-400 text-sm sm:text-base">No movies available. Connect an IPTV provider in the admin panel.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
          {items.map((it) => <MediaCard key={it.rating_key} item={it} fluid />)}
        </div>
      )}
    </div>
  );
}

// ---------- Live TV ----------
const LIVE_SORT = [
  { id: "channel:asc", label: "Channel ↑" },
  { id: "channel:desc", label: "Channel ↓" },
  { id: "title:asc", label: "Name A → Z" },
  { id: "title:desc", label: "Name Z → A" },
];

// ---- Live TV card (with star-to-favorite in top-right) ----
function LiveChannelCard({ ch, isFav, onOpen, onToggleFav }) {
  return (
    <div className="relative group aspect-video rounded-xl overflow-hidden bg-white/[0.04] border border-white/5" data-testid={`live-${ch.key}`}>
      <motion.button
        whileHover={{ scale: 1.04, y: -3 }}
        onClick={() => onOpen(ch)}
        className="absolute inset-0 text-left"
      >
        {ch.logo ? (
          <img src={ch.logo.startsWith("http") ? ch.logo : `${ASSET_BASE}${ch.logo}`} alt="" className="w-full h-full object-contain p-4 bg-black/40" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-700/40 to-cyan-700/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-red-500 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-heading font-extrabold tracking-widest">● LIVE</div>
        <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-2 sm:left-2 sm:right-2">
          <div className="text-white font-medium text-xs sm:text-sm truncate">{ch.title}</div>
          {ch.number && <div className="text-zinc-300 text-[10px] sm:text-xs">Ch {ch.number}</div>}
        </div>
      </motion.button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(ch); }}
        data-testid={`live-fav-${ch.key}`}
        title={isFav ? "Remove from Favorites" : "Add to Favorites"}
        className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
          isFav ? "bg-yellow-400/95 text-black hover:bg-yellow-300" : "bg-black/50 text-white hover:bg-black/70 opacity-90"
        }`}
      >
        <Star className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}

// ---- Horizontal channel row (Favorites / Recently Watched) ----
function LiveChannelRow({ title, subtitle, items, favKeys, onOpen, onToggleFav, testidPrefix }) {
  const ref = React.useRef(null);
  if (!items || items.length === 0) return null;
  const scroll = (d) => ref.current?.scrollBy({ left: d, behavior: "smooth" });
  return (
    <div className="mb-6 sm:mb-8" data-testid={`${testidPrefix}-row`}>
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base sm:text-xl font-bold">{title}</h3>
          {subtitle && <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
        </div>
        <div className="hidden sm:flex gap-2">
          <button onClick={() => scroll(-400)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => scroll(400)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-thin -mx-4 sm:-mx-2 px-4 sm:px-2 pb-2 snap-x">
        {items.map((ch) => (
          <div key={`${testidPrefix}-${ch.key}`} className="snap-start shrink-0 w-[190px] sm:w-[240px]">
            <LiveChannelCard
              ch={ch}
              isFav={favKeys.has(String(ch.key))}
              onOpen={onOpen}
              onToggleFav={onToggleFav}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveTV() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sort, setSort] = React.useState("channel:asc");
  const [source, setSource] = React.useState("all"); // all | plex | iptv
  const [q, setQ] = React.useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await api.get("/livetv/channels")).data,
  });
  const favQ = useQuery({
    queryKey: ["live-favorites"],
    queryFn: async () => (await api.get("/me/live/favorites")).data,
  });
  const recentQ = useQuery({
    queryKey: ["live-recent"],
    queryFn: async () => (await api.get("/me/live/recent")).data,
  });

  const favKeys = React.useMemo(
    () => new Set((favQ.data?.items || []).map((f) => String(f.key))),
    [favQ.data]
  );

  const toggleFav = useMutation({
    mutationFn: async (ch) => {
      const isFav = favKeys.has(String(ch.key));
      if (isFav) return api.delete(`/me/live/favorites/${encodeURIComponent(ch.key)}`);
      return api.post(`/me/live/favorites`, {
        key: String(ch.key), title: ch.title || "", logo: ch.logo || null,
        number: ch.number ?? null, source: ch.source || null,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-favorites"] }),
  });

  const recordRecent = useMutation({
    mutationFn: async (ch) =>
      api.post(`/me/live/recent`, {
        key: String(ch.key), title: ch.title || "", logo: ch.logo || null,
        number: ch.number ?? null, source: ch.source || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-recent"] }),
  });

  const openChannel = React.useCallback((ch) => {
    recordRecent.mutate(ch); // fire-and-forget; UI navigates immediately
    nav(`/watch/play/${ch.key}`, {
      state: { item: { title: ch.title, rating_key: ch.key, thumb: ch.logo, type: "live" } },
    });
  }, [nav, recordRecent]);

  const channels = React.useMemo(() => {
    let list = data?.channels || [];
    if (source !== "all") list = list.filter((c) => c.source === source);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((c) => (c.title || "").toLowerCase().includes(needle));
    }
    const sorted = [...list];
    if (sort === "channel:asc") sorted.sort((a, b) => Number(a.number || 9999) - Number(b.number || 9999));
    else if (sort === "channel:desc") sorted.sort((a, b) => Number(b.number || 9999) - Number(a.number || 9999));
    else if (sort === "title:asc") sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else if (sort === "title:desc") sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    return sorted;
  }, [data, sort, source, q]);

  const counts = React.useMemo(() => {
    const list = data?.channels || [];
    return {
      all: list.length,
      plex: list.filter((c) => c.source === "plex").length,
      iptv: list.filter((c) => c.source === "iptv").length,
    };
  }, [data]);

  // Only show the first 300 channels in the grid — anything more is
  // basically unusable without search. Users can narrow via the search box.
  const MAX_SHOW = 300;
  const shown = channels.slice(0, MAX_SHOW);
  const overflow = Math.max(0, channels.length - MAX_SHOW);

  // Hide favorites / recent strips when filtering — they'd be misleading if
  // a user typed a search that doesn't match their favorites.
  const showStrips = !q.trim() && source === "all";
  const favItems = favQ.data?.items || [];
  const recentItems = recentQ.data?.items || [];

  return (
    <div className="fade-in">
      <div className="mb-5 sm:mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 font-heading">Live</div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-1">All Channels</h1>
          <div className="text-zinc-400 text-xs sm:text-sm mt-2">
            {channels.length.toLocaleString()} channel{channels.length === 1 ? "" : "s"}
          </div>
        </div>
        <SortMenu options={LIVE_SORT} value={sort} onChange={setSort} testidPrefix="live-sort" />
      </div>

      {/* Source filter chips + search */}
      {(counts.plex > 0 || counts.iptv > 0) && (
        <div className="mb-4 sm:mb-5 flex items-center gap-2 flex-wrap">
          {[
            { id: "all", label: `All (${counts.all.toLocaleString()})` },
            counts.plex > 0 && { id: "plex", label: `Plex (${counts.plex.toLocaleString()})` },
            counts.iptv > 0 && { id: "iptv", label: `IPTV (${counts.iptv.toLocaleString()})` },
          ].filter(Boolean).map((opt) => {
            const active = source === opt.id;
            return (
              <button
                key={opt.id}
                data-testid={`live-source-${opt.id}`}
                onClick={() => setSource(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-colors ${
                  active
                    ? "bg-gradient-to-r from-purple-500/30 to-cyan-500/20 border-cyan-400/40 text-white"
                    : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="relative w-full sm:max-w-md mb-5 sm:mb-6">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          data-testid="live-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search channels…"
          autoCapitalize="none" autoCorrect="off" spellCheck="false"
          className="qtv-input pl-10 py-2.5 text-sm"
        />
      </div>

      {/* Favorites & Recently Watched strips (only when not filtering) */}
      {showStrips && (
        <>
          <LiveChannelRow
            title="⭐ Favorites"
            subtitle={favItems.length ? `${favItems.length} pinned channel${favItems.length === 1 ? "" : "s"}` : null}
            items={favItems}
            favKeys={favKeys}
            onOpen={openChannel}
            onToggleFav={(ch) => toggleFav.mutate(ch)}
            testidPrefix="live-favorites"
          />
          <LiveChannelRow
            title="Recently Watched"
            subtitle={recentItems.length ? `Last ${recentItems.length} channel${recentItems.length === 1 ? "" : "s"} you tuned into` : null}
            items={recentItems}
            favKeys={favKeys}
            onOpen={openChannel}
            onToggleFav={(ch) => toggleFav.mutate(ch)}
            testidPrefix="live-recent"
          />
        </>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
          {[...Array(10)].map((_, i) => <div key={i} className="aspect-video rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-zinc-400 text-sm sm:text-base">No live channels match your filters.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
            {shown.map((ch) => (
              <LiveChannelCard
                key={ch.key}
                ch={ch}
                isFav={favKeys.has(String(ch.key))}
                onOpen={openChannel}
                onToggleFav={(c) => toggleFav.mutate(c)}
              />
            ))}
          </div>
          {overflow > 0 && (
            <div className="mt-5 sm:mt-6 text-center text-xs sm:text-sm text-zinc-500">
              Showing {MAX_SHOW.toLocaleString()} of {channels.length.toLocaleString()} channels — use search to find more.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Search ----------
const SEARCH_SORT = [
  { id: "default", label: "Relevance" },
  { id: "title:asc", label: "Title A → Z" },
  { id: "title:desc", label: "Title Z → A" },
  { id: "year:desc", label: "Newest release" },
  { id: "year:asc", label: "Oldest release" },
  { id: "rating:desc", label: "Highest rated" },
];

function SearchPage() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("default");
  const { data, isFetching } = useQuery({
    enabled: q.trim().length >= 2,
    queryKey: ["search", q],
    queryFn: async () => (await api.get(`/search?q=${encodeURIComponent(q)}`)).data,
  });
  const items = sort === "default" ? (data?.items || []) : applySort(data?.items || [], sort);
  return (
    <div className="fade-in">
      <div className="mb-5 sm:mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 font-heading">Find</div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-1">Search</h1>
        </div>
        {items.length > 0 && <SortMenu options={SEARCH_SORT} value={sort} onChange={setSort} testidPrefix="search-sort" />}
      </div>
      <div className="relative w-full sm:max-w-xl mb-6 sm:mb-8">
        <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          data-testid="search-input"
          value={q} onChange={(e) => setQ(e.target.value)}
          autoFocus placeholder="Search movies, shows, channels…"
          autoCapitalize="none" autoCorrect="off" spellCheck="false"
          className="qtv-input pl-12"
        />
      </div>
      {isFetching && <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
        {items.map((it) => <MediaCard key={it.rating_key} item={it} fluid />)}
      </div>
      {q.length >= 2 && !isFetching && items.length === 0 && (
        <div className="text-zinc-500 text-sm sm:text-base">No matches for "{q}"</div>
      )}
    </div>
  );
}

// ---------- Watchlist / Favorites ----------
const LIST_SORT = [
  { id: "addedAt:desc", label: "Newest added" },
  { id: "addedAt:asc", label: "Oldest added" },
  { id: "year:desc", label: "Newest release" },
  { id: "year:asc", label: "Oldest release" },
  { id: "title:asc", label: "Title A → Z" },
  { id: "title:desc", label: "Title Z → A" },
  { id: "rating:desc", label: "Highest rated" },
];

function ListPage({ endpoint, title, removeUrl, emptyHint }) {
  const qc = useQueryClient();
  const [sort, setSort] = React.useState("addedAt:desc");
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await api.get(endpoint)).data,
  });
  const remove = useMutation({
    mutationFn: async (rk) => api.delete(removeUrl(rk)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint] }),
  });
  const items = applySort(data?.items || [], sort);
  return (
    <div className="fade-in">
      <div className="mb-5 sm:mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.25em] text-zinc-500 font-heading">Your</div>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-1">{title}</h1>
        </div>
        {(data?.items || []).length > 0 && <SortMenu options={LIST_SORT} value={sort} onChange={setSort} testidPrefix={`${title.toLowerCase()}-sort`} />}
      </div>
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      ) : items.length === 0 ? (
        <div className="text-zinc-400 text-sm sm:text-base">{emptyHint}</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-4">
          {items.map((it) => (
            <div key={it.rating_key} className="relative group">
              <MediaCard item={it} fluid />
              <button
                onClick={() => remove.mutate(it.rating_key)}
                className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/70 hover:bg-red-500 backdrop-blur opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center"
                title="Remove"
                data-testid={`remove-${it.rating_key}`}
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Player ----------
function Player() {
  const { rk } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const meta = useQuery({
    queryKey: ["meta", rk],
    queryFn: async () => (await api.get(`/metadata/${rk}`)).data,
    retry: false,
  });
  const stream = useQuery({
    queryKey: ["stream", rk],
    queryFn: async () => (await api.get(`/stream/${rk}?direct=true`)).data,
  });
  const inWl = !!meta.data?.in_watchlist;
  const inFav = !!meta.data?.in_favorites;

  const toggleWl = useMutation({
    mutationFn: async () => inWl ? api.delete(`/me/watchlist/${rk}`) : api.post(`/me/watchlist`, { rating_key: String(rk) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", rk] }),
  });
  const toggleFav = useMutation({
    mutationFn: async () => inFav ? api.delete(`/me/favorites/${rk}`) : api.post(`/me/favorites`, { rating_key: String(rk) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta", rk] }),
  });

  return (
    <div className="fade-in -mt-5 sm:-mt-8 -mx-4 sm:-mx-6">
      <div className="relative aspect-video bg-black max-h-[80vh] w-full">
        <button onClick={() => nav(-1)}
          data-testid="player-back"
          className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        {stream.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
          </div>
        ) : stream.error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-300 px-6 text-center text-sm sm:text-base">
            {stream.error?.response?.data?.detail || "Could not start stream"}
          </div>
        ) : (
          <VideoPlayer
            src={stream.data?.url}
            poster={meta.data?.art ? `${ASSET_BASE}${meta.data.art}` : undefined}
          />
        )}
      </div>
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-10">
        <div className="flex items-start justify-between gap-4 sm:gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight">{meta.data?.title || "—"}</h1>
            <div className="text-zinc-500 text-xs sm:text-sm mt-1 flex items-center flex-wrap gap-x-2 gap-y-1">
              {meta.data?.year && <span>{meta.data.year}</span>}
              {meta.data?.type && <span className="capitalize">· {meta.data.type}</span>}
              {meta.data?.audience_rating && <span>· ★ {meta.data.audience_rating}</span>}
            </div>
            {meta.data?.summary && <p className="text-zinc-300 text-sm sm:text-base mt-3 sm:mt-5 max-w-3xl leading-relaxed">{meta.data.summary}</p>}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button data-testid="toggle-watchlist" onClick={() => toggleWl.mutate()}
              className={`px-3 sm:px-4 py-2 rounded-full border flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors ${inWl ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              {inWl ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span className="truncate">{inWl ? "In Watchlist" : "Add to Watchlist"}</span>
            </button>
            <button data-testid="toggle-favorite" onClick={() => toggleFav.mutate()}
              className={`px-3 sm:px-4 py-2 rounded-full border flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors ${inFav ? "bg-pink-500/20 border-pink-400/40 text-pink-200" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              <Heart className={`w-4 h-4 ${inFav ? "fill-pink-300" : ""}`} />
              <span className="truncate">{inFav ? "Favorited" : "Favorite"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Root ----------
export default function Watch() {
  return (
    <RequireUser>
      <WatchShell>
        <Routes>
          <Route index element={<Browse />} />
          <Route path="live" element={<LiveTV />} />
          <Route path="movies" element={<IptvMoviesView />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="watchlist" element={
            <ListPage endpoint="/me/watchlist" title="Watchlist"
              removeUrl={(rk) => `/me/watchlist/${rk}`}
              emptyHint='Your watchlist is empty. Open any movie or show and tap "Add to Watchlist".' />
          } />
          <Route path="favorites" element={
            <ListPage endpoint="/me/favorites" title="Favorites"
              removeUrl={(rk) => `/me/favorites/${rk}`}
              emptyHint='No favorites yet. Tap the heart on any title to add it.' />
          } />
          <Route path="play/:rk" element={<Player />} />
          <Route path="*" element={<Navigate to="/watch" replace />} />
        </Routes>
      </WatchShell>
    </RequireUser>
  );
}
