import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useParams, Navigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Grid3X3, Radio, Film, Tv2, Search, Bookmark, Heart, User, LogOut, Play,
  ChevronLeft, ChevronRight, X, Plus, Check, Loader2,
} from "lucide-react";
import api, { ASSET_BASE } from "../api";

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
    { to: "/watch/series",  label: "Series",    icon: Tv2 },
    { to: "/watch/watchlist", label: "Watchlist", icon: Bookmark },
    { to: "/watch/favorites", label: "Favorites", icon: Heart },
    { to: "/watch/search",  label: "Search",    icon: Search },
  ];
  return (
    <div className="min-h-screen relative z-10">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#060714]/85 border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center gap-6">
          <Link to="/watch" className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl shadow-glow" />
            <div className="font-heading font-bold gradient-text">QUANTUM TV</div>
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
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex flex-col items-end">
              <div className="text-xs text-zinc-500">Signed in as</div>
              <div className="text-sm font-medium">{u?.display_name || u?.username}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-heading font-bold">
              {(u?.display_name || u?.username || "?").slice(0, 1).toUpperCase()}
            </div>
            <button data-testid="watch-logout" onClick={logout} className="p-2 rounded-lg text-zinc-400 hover:text-red-300 hover:bg-red-500/10" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Mobile tabs */}
        <nav className="md:hidden flex overflow-x-auto px-4 py-2 gap-1 border-t border-white/5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                  isActive ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-400"
                }`
              }>
              <Icon className="w-3.5 h-3.5" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-[1500px] mx-auto px-6 py-8 pb-24">{children}</main>
    </div>
  );
}

// ---------- Shared media card ----------
function MediaCard({ item, size = "md", testid }) {
  const nav = useNavigate();
  const w = size === "lg" ? 220 : size === "sm" ? 130 : 170;
  const h = Math.round(w * 1.5);
  return (
    <motion.button
      data-testid={testid || `card-${item.rating_key}`}
      onClick={() => nav(`/watch/play/${item.rating_key}`, { state: { item } })}
      whileHover={{ scale: 1.04, y: -3 }}
      transition={{ duration: 0.18 }}
      style={{ width: w }}
      className="text-left shrink-0 group"
    >
      <div style={{ height: h }} className="rounded-xl overflow-hidden bg-white/[0.04] border border-white/5 relative">
        {item.thumb ? (
          <img src={`${ASSET_BASE}${item.thumb}`} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-cyan-900/40 flex items-center justify-center">
            <Film className="w-8 h-8 text-zinc-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <div className="w-14 h-14 rounded-full bg-cyan-500/90 flex items-center justify-center shadow-cyan">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <div className="text-white text-sm font-medium truncate">{item.title}</div>
          {item.year && <div className="text-zinc-400 text-xs">{item.year}</div>}
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
      className="relative h-[360px] rounded-3xl overflow-hidden border border-white/5 mb-10"
    >
      {item.art ? (
        <img src={`${ASSET_BASE}${item.art}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-700 to-cyan-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#060714] via-[#060714]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#060714] via-[#060714]/40 to-transparent" />
      <div className="relative h-full flex flex-col justify-end p-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 self-start bg-red-500 px-3 py-1 rounded-full text-xs font-heading font-bold mb-4 tracking-widest">● FEATURED</div>
        <h2 className="font-heading text-5xl font-extrabold">{item.title}</h2>
        {item.year && <div className="text-zinc-400 mt-2">{item.year}</div>}
        {item.summary && <p className="text-zinc-300 mt-4 line-clamp-3 max-w-xl">{item.summary}</p>}
        <button
          data-testid="hero-play"
          onClick={() => nav(`/watch/play/${item.rating_key}`, { state: { item } })}
          className="btn-gradient mt-6 px-7 py-3.5 flex items-center gap-2 self-start text-sm"
        >
          <Play className="w-4 h-4 fill-white" /> Watch Now
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
      <div className="mb-10">
        <h3 className="font-heading text-xl font-bold mb-4">{title}</h3>
        <div className="flex gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-44 h-64 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="mb-10">
        <h3 className="font-heading text-xl font-bold mb-2">{title}</h3>
        <div className="text-sm text-zinc-500">{emptyText}</div>
      </div>
    );
  }
  const scroll = (d) => ref.current?.scrollBy({ left: d, behavior: "smooth" });
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-xl font-bold">{title}</h3>
        <div className="flex gap-2">
          <button onClick={() => scroll(-400)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => scroll(400)} className="p-2 rounded-full bg-white/5 hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto scrollbar-thin -mx-2 px-2 pb-2 snap-x">
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

  // Show a friendly "Plex not connected" banner if the server errors
  const noPlex = recent.error?.response?.status === 503 || onDeck.error?.response?.status === 503;

  return (
    <div className="fade-in">
      {noPlex && (
        <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-yellow-200">
          <div className="font-heading font-bold">Plex isn't connected yet</div>
          <div className="text-sm mt-1">The admin needs to connect a Plex account in the Control Panel before content can stream.</div>
        </div>
      )}
      {featured && <FeaturedHero item={featured} />}
      <Row title="Continue Watching" items={onDeck.data?.items} emptyText="Once you start watching, picks will land here." />
      <Row title="Recently Added" items={recent.data?.items} size="lg" />
    </div>
  );
}

// ---------- Library grid (movies / shows) ----------
function LibraryView({ type, label }) {
  const libs = useQuery({ queryKey: ["libs"], queryFn: async () => (await api.get("/libraries")).data });
  const lib = (libs.data?.libraries || []).find((l) => l.type === type);
  const items = useQuery({
    enabled: !!lib,
    queryKey: ["libitems", lib?.key],
    queryFn: async () => (await api.get(`/libraries/${lib.key}/items?limit=200`)).data,
  });
  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Library</div>
        <h1 className="font-heading text-4xl font-extrabold mt-1">{label}</h1>
        {lib && <div className="text-zinc-400 text-sm mt-2">{items.data?.total ?? "—"} titles in {lib.title}</div>}
      </div>
      {libs.isLoading || items.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : !lib ? (
        <div className="text-zinc-400">No {label.toLowerCase()} library found on the connected Plex server.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {(items.data?.items || []).map((it) => <MediaCard key={it.rating_key} item={it} size="md" />)}
        </div>
      )}
    </div>
  );
}

// ---------- Live TV ----------
function LiveTV() {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await api.get("/livetv/channels")).data,
  });
  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Live</div>
        <h1 className="font-heading text-4xl font-extrabold mt-1">All Channels</h1>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <div key={i} className="aspect-video rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : (data?.channels || []).length === 0 ? (
        <div className="text-zinc-400">No live channels available. Plex DVR or Plex's free live TV must be set up on the connected server.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data.channels.map((ch) => (
            <motion.button
              key={ch.key}
              whileHover={{ scale: 1.04, y: -3 }}
              onClick={() => nav(`/watch/play/${ch.key}`, { state: { item: { title: ch.title, rating_key: ch.key, thumb: ch.logo, type: "live" } } })}
              className="aspect-video rounded-xl overflow-hidden bg-white/[0.04] border border-white/5 relative group text-left"
              data-testid={`live-${ch.key}`}
            >
              {ch.logo ? (
                <img src={ch.logo.startsWith("http") ? ch.logo : `${ASSET_BASE}${ch.logo}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-700/40 to-cyan-700/40" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent" />
              <div className="absolute top-2 left-2 bg-red-500 px-2 py-0.5 rounded text-[10px] font-heading font-extrabold tracking-widest">● LIVE</div>
              <div className="absolute bottom-2 left-2 right-2">
                <div className="text-white font-medium truncate">{ch.title}</div>
                {ch.number && <div className="text-zinc-300 text-xs">Channel {ch.number}</div>}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Search ----------
function SearchPage() {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    enabled: q.trim().length >= 2,
    queryKey: ["search", q],
    queryFn: async () => (await api.get(`/search?q=${encodeURIComponent(q)}`)).data,
  });
  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Find</div>
        <h1 className="font-heading text-4xl font-extrabold mt-1">Search</h1>
      </div>
      <div className="relative max-w-xl mb-8">
        <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          data-testid="search-input"
          value={q} onChange={(e) => setQ(e.target.value)}
          autoFocus placeholder="Search movies, shows, channels…"
          className="qtv-input pl-12"
        />
      </div>
      {isFetching && <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {(data?.items || []).map((it) => <MediaCard key={it.rating_key} item={it} />)}
      </div>
      {q.length >= 2 && !isFetching && (data?.items || []).length === 0 && (
        <div className="text-zinc-500">No matches for "{q}"</div>
      )}
    </div>
  );
}

// ---------- Watchlist / Favorites ----------
function ListPage({ endpoint, title, removeUrl, emptyHint }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await api.get(endpoint)).data,
  });
  const remove = useMutation({
    mutationFn: async (rk) => api.delete(removeUrl(rk)),
    onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint] }),
  });
  return (
    <div className="fade-in">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Your</div>
        <h1 className="font-heading text-4xl font-extrabold mt-1">{title}</h1>
      </div>
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      ) : (data?.items || []).length === 0 ? (
        <div className="text-zinc-400">{emptyHint}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data.items.map((it) => (
            <div key={it.rating_key} className="relative group">
              <MediaCard item={it} />
              <button
                onClick={() => remove.mutate(it.rating_key)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 hover:bg-red-500 backdrop-blur opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                title="Remove"
                data-testid={`remove-${it.rating_key}`}
              >
                <X className="w-4 h-4" />
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
    <div className="fade-in -mt-8 -mx-6">
      <div className="relative aspect-video bg-black max-h-[80vh] w-full">
        <button onClick={() => nav(-1)}
          data-testid="player-back"
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        {stream.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
          </div>
        ) : stream.error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-300 px-6 text-center">
            {stream.error?.response?.data?.detail || "Could not start stream"}
          </div>
        ) : (
          <video
            data-testid="video-player"
            src={stream.data?.url}
            controls
            autoPlay
            playsInline
            className="w-full h-full"
            poster={meta.data?.art ? `${ASSET_BASE}${meta.data.art}` : undefined}
          />
        )}
      </div>
      <div className="max-w-[1500px] mx-auto px-6 pt-8 pb-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-extrabold">{meta.data?.title || "—"}</h1>
            <div className="text-zinc-500 text-sm mt-1 flex items-center gap-3">
              {meta.data?.year && <span>{meta.data.year}</span>}
              {meta.data?.type && <span className="capitalize">· {meta.data.type}</span>}
              {meta.data?.audience_rating && <span>· ★ {meta.data.audience_rating}</span>}
            </div>
            {meta.data?.summary && <p className="text-zinc-300 mt-5 max-w-3xl leading-relaxed">{meta.data.summary}</p>}
          </div>
          <div className="flex gap-2">
            <button data-testid="toggle-watchlist" onClick={() => toggleWl.mutate()}
              className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm transition-colors ${inWl ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              {inWl ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {inWl ? "In Watchlist" : "Add to Watchlist"}
            </button>
            <button data-testid="toggle-favorite" onClick={() => toggleFav.mutate()}
              className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm transition-colors ${inFav ? "bg-pink-500/20 border-pink-400/40 text-pink-200" : "bg-white/5 border-white/10 hover:bg-white/10"}`}>
              <Heart className={`w-4 h-4 ${inFav ? "fill-pink-300" : ""}`} />
              {inFav ? "Favorited" : "Favorite"}
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
          <Route path="movies" element={<LibraryView type="movie" label="Movies" />} />
          <Route path="series" element={<LibraryView type="show" label="TV Shows" />} />
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
