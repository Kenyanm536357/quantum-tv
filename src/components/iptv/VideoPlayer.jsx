import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { setState } from '@/lib/iptv-store';
import { useStore } from '@/lib/use-store';
import { addToHistory, toggleBookmark, isBookmarked } from '@/lib/user-data';
import {
  X, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, RotateCcw, Radio, AlertTriangle,
  Bookmark, BookmarkCheck
} from 'lucide-react';

export default function VideoPlayer({ src, title, type }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimer = useRef(null);
  const { credentials, player } = useStore();

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fs, setFs] = useState(false);
  const [showCtrl, setShowCtrl] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);

  const isLive = type === 'live';

  useEffect(() => {
    if (credentials && player) setBookmarked(isBookmarked(credentials, player));
  }, [credentials, player]);

  useEffect(() => {
    if (credentials && player && !loading && !err) addToHistory(credentials, player, type);
  }, [loading, err]);

  const bumpControls = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 3500);
  }, []);

  useEffect(() => {
    bumpControls();
    return () => clearTimeout(hideTimer.current);
  }, [bumpControls]);

  const toggleFs = () => {
    const el = containerRef.current;
    if (!document.fullscreenElement) { el?.requestFullscreen(); setFs(true); }
    else { document.exitFullscreen(); setFs(false); }
  };

  const fmt = s => {
    if (!isFinite(s) || s <= 0) return '∞';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <div ref={containerRef} className="relative w-full h-full"
        onMouseMove={bumpControls} onTouchStart={bumpControls}>

        <ReactPlayer
          ref={playerRef}
          url={src}
          playing={playing}
          muted={muted}
          volume={vol}
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
          playsinline
          config={{
            file: {
              forceHLS: true,
              hlsOptions: {
                lowLatencyMode: true,
                enableWorker: true,
                xhrSetup: xhr => { xhr.withCredentials = false; },
              },
            },
          }}
          onReady={() => setLoading(false)}
          onStart={() => setLoading(false)}
          onBuffer={() => setLoading(true)}
          onBufferEnd={() => setLoading(false)}
          onDuration={setDuration}
          onProgress={({ played }) => setPlayed(played)}
          onError={() => setErr('Stream unavailable. Please try another channel.')}
        />

        {/* Loading overlay */}
        {loading && !err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 pointer-events-none">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <Radio className="absolute inset-0 m-auto w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-white/60">Loading stream…</p>
          </div>
        )}

        {/* Error overlay */}
        {err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-white/70">{err}</p>
            <button
              onClick={() => { setErr(null); setLoading(true); setPlaying(true); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* Controls */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 pointer-events-none ${showCtrl ? 'opacity-100' : 'opacity-0'}`}>
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${isLive ? 'bg-destructive/90 text-white' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                {isLive ? 'LIVE' : 'VOD'}
              </span>
              <p className="text-sm font-semibold text-white truncate">{title}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  if (credentials && player) { toggleBookmark(credentials, player, type); setBookmarked(b => !b); }
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                {bookmarked ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4 text-white" />}
              </button>
              <button onClick={() => setState({ player: null })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Click to play/pause */}
          <div className="flex-1 pointer-events-auto cursor-pointer" onClick={() => setPlaying(p => !p)} />

          {/* Bottom bar */}
          <div className="px-5 pb-5 pt-10 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto">
            {!isLive && duration > 0 && (
              <div className="mb-3">
                <input
                  type="range" min={0} max={1} step={0.001} value={played}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setPlayed(val);
                    playerRef.current?.seekTo(val);
                  }}
                  className="w-full h-1 rounded-full cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[11px] text-white/40 mt-1">
                  <span>{fmt(played * duration)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setPlaying(p => !p)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-primary/40 flex items-center justify-center transition-all">
                  {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white" />}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMuted(m => !m)} className="text-white/60 hover:text-white transition-colors">
                    {muted || vol === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol}
                    onChange={e => { setVol(+e.target.value); setMuted(+e.target.value === 0); }}
                    className="w-20 h-1 rounded-full cursor-pointer accent-primary hidden sm:block" />
                </div>
              </div>
              <button onClick={toggleFs} className="text-white/60 hover:text-white transition-colors">
                {fs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}