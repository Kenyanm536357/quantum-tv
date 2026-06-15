import React, { useState, useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import { setState } from '@/lib/iptv-store';
import { useStore } from '@/lib/use-store';
import { addToHistory, toggleBookmark, isBookmarked } from '@/lib/user-data';
import {
  X, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, RotateCcw, Radio, AlertTriangle,
  Bookmark, BookmarkCheck, ExternalLink
} from 'lucide-react';

export default function VideoPlayer({ src, title, type }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
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

  // Set up HLS.js or native playback
  useEffect(() => {
    if (!src || !videoRef.current) return;

    setErr(null);
    setLoading(true);

    const video = videoRef.current;

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const onLoaded = () => setLoading(false);
    const onError = () => setErr('Stream unavailable. Please try another channel.');

    // Try native HLS first (iOS Safari supports it natively)
    if (video.canPlayType('application/vnd.apple.mpegurl') && !Hls.isSupported()) {
      video.src = src;
      video.addEventListener('canplay', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.play().catch(() => {});
      return () => {
        video.removeEventListener('canplay', onLoaded);
        video.removeEventListener('error', onError);
      };
    }

    if (!Hls.isSupported()) {
      setErr('HLS not supported in this browser.');
      return;
    }

    const hls = new Hls({
      lowLatencyMode: true,
      enableWorker: true,
      maxBufferLength: 30,
      xhrSetup: xhr => { xhr.withCredentials = false; },
    });
    hlsRef.current = hls;

    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setLoading(false);
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        setErr('Stream unavailable. Please try another channel.');
      }
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // Sync play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing]);

  // Sync mute/volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = vol;
  }, [muted, vol]);

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

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          muted={muted}
          onTimeUpdate={e => {
            const v = e.target;
            if (v.duration) setPlayed(v.currentTime / v.duration);
          }}
          onDurationChange={e => setDuration(e.target.duration)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
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
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <button
                onClick={() => { setErr(null); setLoading(true); setPlaying(true); }}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
              {/* Open in native player — bypasses all browser restrictions */}
              <a href={src} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white/60 text-sm font-medium hover:text-white transition-all">
                <ExternalLink className="w-4 h-4" /> Open in Native Player
              </a>
            </div>
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
                    if (videoRef.current) videoRef.current.currentTime = val * duration;
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