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
import DebugPanel from '@/components/iptv/DebugPanel';
import CorsBlockedScreen from '@/components/iptv/CorsBlockedScreen';

// ── Proxy list — tried in order on failure, working proxy is locked in ────────
const PROXY_LIST = [
  null, // direct (no proxy) — always try first
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
  (url) => `https://cors.sh/${url}`,
];

function applyProxy(rawSrc, proxyIndex) {
  if (proxyIndex === 0 || !PROXY_LIST[proxyIndex]) return rawSrc;
  return PROXY_LIST[proxyIndex](rawSrc);
}

export default function VideoPlayer({ src, title, type }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);
  const progressTimer = useRef(null);
  const { credentials, player } = useStore();

  // Proxy state — locked once a working proxy is found
  const proxyIndexRef = useRef(0);
  const lockedProxyRef = useRef(null); // null = not locked yet

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
  const [corsBlocked, setCorsBlocked] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [proxyStatus, setProxyStatus] = useState('');
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const isLive = type === 'live' || !isFinite(duration) || duration > 86400;

  const addLog = useCallback((level, event, detail = {}) => {
    setDebugLogs(prev => [...prev, { level, event, detail, ts: Date.now() }]);
  }, []);

  // Triple-tap top-left corner to show debug panel
  const handleDebugTap = useCallback(() => {
    tapCountRef.current += 1;
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 600);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      setShowDebug(true);
    }
  }, []);

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

  const tryLoadWithProxy = useCallback((proxyIndex) => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const activeSrc = applyProxy(src, proxyIndex);
    const proxyLabel = proxyIndex === 0 ? 'direct' : `proxy ${proxyIndex}`;
    addLog('info', 'TRY_PROXY', { proxyIndex, activeSrc: activeSrc.slice(-80) });
    setProxyStatus(proxyIndex === 0 ? '' : `Trying proxy ${proxyIndex}/${PROXY_LIST.length - 1}…`);

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 60,
        enableWorker: true,
        xhrSetup: (xhr) => { xhr.withCredentials = false; },
      });
      hlsRef.current = hls;
      hls.loadSource(activeSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        // ✅ This proxy works — lock it in
        lockedProxyRef.current = proxyIndex;
        proxyIndexRef.current = proxyIndex;
        addLog('success', 'MANIFEST_PARSED', { levels: data?.levels?.length ?? 0, proxyLabel });
        setProxyStatus(proxyIndex === 0 ? '' : `Using proxy ${proxyIndex}`);
        setLoading(false);
        setCorsBlocked(false);
        setErr(null);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
        addLog('info', 'LEVEL_LOADED', { level: data?.level, duration: data?.details?.totalduration });
      });

      hls.on(Hls.Events.ERROR, (_, d) => {
        const code = d?.response?.code ?? d?.networkDetails?.status ?? 'N/A';
        addLog(d?.fatal ? 'error' : 'warn', d?.fatal ? 'FATAL_ERROR' : 'HLS_ERROR', {
          type: d?.type, details: d?.details, fatal: d?.fatal, responseCode: code, proxyLabel,
        });

        if (d?.fatal) {
          hls.destroy();
          hlsRef.current = null;

          const nextProxy = proxyIndex + 1;
          if (nextProxy < PROXY_LIST.length && lockedProxyRef.current === null) {
            // Auto-try next proxy
            addLog('info', 'PROXY_FALLBACK', { nextProxy });
            setTimeout(() => tryLoadWithProxy(nextProxy), 300);
          } else {
            // All proxies exhausted (or locked proxy failed — retry locked proxy once)
            if (lockedProxyRef.current !== null && lockedProxyRef.current === proxyIndex) {
              addLog('warn', 'LOCKED_PROXY_FAILED', { retrying: true });
              lockedProxyRef.current = null;
              proxyIndexRef.current = 0;
              setTimeout(() => tryLoadWithProxy(0), 1000);
              return;
            }
            const isCors = d?.details === 'manifestLoadError' && (code === 0 || code === 'N/A');
            setCorsBlocked(isCors);
            setErr(isCors ? 'cors_blocked' : `Stream unavailable (code: ${code})`);
            setLoading(false);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      addLog('info', 'NATIVE_HLS', { src: activeSrc });
      video.src = activeSrc;
      video.onloadedmetadata = () => {
        lockedProxyRef.current = proxyIndex;
        addLog('success', 'METADATA_LOADED', {});
        setLoading(false);
        setProxyStatus(proxyIndex === 0 ? '' : `Using proxy ${proxyIndex}`);
        video.play().catch(() => {});
      };
      video.onerror = () => {
        const nextProxy = proxyIndex + 1;
        if (nextProxy < PROXY_LIST.length && lockedProxyRef.current === null) {
          setTimeout(() => tryLoadWithProxy(nextProxy), 300);
        } else {
          setErr('Stream unavailable.');
          setLoading(false);
        }
      };
    } else {
      setErr('HLS not supported in this browser.');
      setLoading(false);
    }
  }, [src, addLog]);

  const initHls = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setLoading(true);
    setErr(null);
    setCorsBlocked(false);
    setDebugLogs([]);
    setProxyStatus('');

    // If we have a locked working proxy, use it directly; otherwise start from 0
    const startProxy = lockedProxyRef.current !== null ? lockedProxyRef.current : 0;
    addLog('info', 'INIT', { src, startProxy, hlsSupported: Hls.isSupported() });
    tryLoadWithProxy(startProxy);
  }, [src, addLog, tryLoadWithProxy]);

  useEffect(() => {
    // New stream — reset proxy lock so we start fresh
    lockedProxyRef.current = null;
    proxyIndexRef.current = 0;
    initHls();
    return () => { hlsRef.current?.destroy(); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <p className="text-sm text-white/60">{proxyStatus || 'Loading stream…'}</p>
          </div>
        )}

        {/* Error */}
        {err && (
          corsBlocked
            ? <CorsBlockedScreen src={src} onRetry={initHls} />
            : <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-white/70">{err}</p>
                <button onClick={initHls}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
              </div>
        )}

        {/* Hidden debug trigger — triple-tap top-left */}
        <button
          onClick={handleDebugTap}
          className="absolute top-0 left-0 w-16 h-16 z-40 opacity-0"
          aria-hidden="true"
        />

        {/* Debug panel */}
        {showDebug && (
          <DebugPanel logs={debugLogs} onClose={() => setShowDebug(false)} />
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