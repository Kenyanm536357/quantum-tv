import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { setState } from '@/lib/iptv-store';
import { useStore } from '@/lib/use-store';
import { addToHistory, updateProgress, toggleBookmark, isBookmarked } from '@/lib/user-data';
import {
  X, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, RotateCcw, Radio, AlertTriangle,
  Bookmark, BookmarkCheck
} from 'lucide-react';

export default function VideoPlayer({ src, title, type }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);
  const progressTimer = useRef(null);
  const { credentials, player } = useStore();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fs, setFs] = useState(false);
  const [showCtrl, setShowCtrl] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [bookmarked, setBookmarked] = useState(false);
  const isLive = type === 'live' || !isFinite(duration) || duration > 86400;

  // Track bookmark state
  useEffect(() => {
    if (credentials && player) {
      setBookmarked(isBookmarked(credentials, player));
    }
  }, [credentials, player]);

  // Add to history on play start
  useEffect(() => {
    if (credentials && player && !loading && !err) {
      addToHistory(credentials, player, type);
    }
  }, [loading, err, credentials]);

  // Save progress every 15s for VOD
  useEffect(() => {
    if (!isLive && credentials && player) {
      progressTimer.current = setInterval(() => {
        const v = videoRef.current;
        if (v && v.duration > 0) {
          updateProgress(credentials, player, v.currentTime / v.duration);
        }
      }, 15000);
    }
    return () => clearInterval(progressTimer.current);
  }, [isLive, credentials, player]);

  // Resume VOD from saved progress
  useEffect(() => {
    if (player?.resumeAt && player.resumeAt > 0) {
      const v = videoRef.current;
      if (v) {
        const onCanPlay = () => { v.currentTime = player.resumeAt; v.removeEventListener('canplay', onCanPlay); };
        v.addEventListener('canplay', onCanPlay);
      }
    }
  }, [player?.resumeAt]);

  const initHls = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setLoading(true);
    setErr(null);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 60,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setLoading(false); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_, d) => {
        console.warn('[HLS Error]', d?.type, d?.details, d?.response?.code, src);
        if (d?.fatal) {
          setErr(`Stream error: ${d?.details ?? 'unknown'} (code: ${d?.response?.code ?? 'N/A'})`);
          setLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.onloadedmetadata = () => { setLoading(false); video.play().catch(() => {}); };
      video.onerror = () => { setErr('Stream unavailable.'); setLoading(false); };
    } else {
      setErr('HLS not supported in this browser.');
      setLoading(false);
    }
  }, [src]);

  useEffect(() => { initHls(); return () => { hlsRef.current?.destroy(); }; }, [initHls]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handlers = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      timeupdate: () => setCurrentTime(v.currentTime),
      durationchange: () => setDuration(v.duration),
      volumechange: () => { setVol(v.volume); setMuted(v.muted); },
    };
    Object.entries(handlers).forEach(([ev, fn]) => v.addEventListener(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => v.removeEventListener(ev, fn));
  }, []);

  const bumpControls = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 3500);
  }, []);

  useEffect(() => { bumpControls(); return () => clearTimeout(hideTimer.current); }, [bumpControls]);

  const togglePlay = () => { const v = videoRef.current; if (v) playing ? v.pause() : v.play(); };
  const toggleMute = () => { const v = videoRef.current; if (v) v.muted = !v.muted; };
  const handleVol = e => { const v = videoRef.current; if (v) { v.volume = +e.target.value; v.muted = +e.target.value === 0; } };
  const handleSeek = e => { const v = videoRef.current; if (v) v.currentTime = +e.target.value; };
  const toggleFs = () => {
    const el = containerRef.current;
    if (!document.fullscreenElement) { el?.requestFullscreen(); setFs(true); }
    else { document.exitFullscreen(); setFs(false); }
  };
  const fmt = s => { if (!isFinite(s)) return '∞'; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div ref={containerRef} className="relative w-full h-full"
        onMouseMove={bumpControls} onTouchStart={bumpControls}>

        <video ref={videoRef} className="w-full h-full object-contain" playsInline />

        {/* Loading */}
        {loading && !err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <Radio className="absolute inset-0 m-auto w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-white/60">Loading stream…</p>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <p className="text-sm text-white/70">{err}</p>
            <button onClick={initHls}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* Controls overlay */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 pointer-events-none ${showCtrl ? 'opacity-100' : 'opacity-0'}`}>
          {/* Top */}
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
                  if (credentials && player) {
                    toggleBookmark(credentials, player, type);
                    setBookmarked(b => !b);
                  }
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                title={bookmarked ? 'Remove bookmark' : 'Bookmark'}>
                {bookmarked
                  ? <BookmarkCheck className="w-4 h-4 text-primary" />
                  : <Bookmark className="w-4 h-4 text-white" />}
              </button>
              <button onClick={() => setState({ player: null })}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Click area */}
          <div className="flex-1 pointer-events-auto cursor-pointer" onClick={togglePlay} />

          {/* Bottom */}
          <div className="px-5 pb-5 pt-10 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto">
            {/* Seek (VOD only) */}
            {!isLive && duration > 0 && (
              <div className="mb-3">
                <input type="range" min={0} max={duration} value={currentTime} onChange={handleSeek}
                  className="w-full h-1 rounded-full cursor-pointer accent-primary" />
                <div className="flex justify-between text-[11px] text-white/40 mt-1">
                  <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Play/pause */}
                <button onClick={togglePlay}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-primary/40 flex items-center justify-center transition-all">
                  {playing
                    ? <Pause className="w-4 h-4 text-white" />
                    : <Play className="w-4 h-4 text-white fill-white" />}
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                    {muted || vol === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : vol} onChange={handleVol}
                    className="w-20 h-1 rounded-full cursor-pointer accent-primary hidden sm:block" />
                </div>
              </div>

              {/* Fullscreen */}
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