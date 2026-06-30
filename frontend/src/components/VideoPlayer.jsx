import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

/**
 * Cross-device HTML5 video player.
 *
 * - On iOS Safari, HLS (m3u8) is supported natively; we just point <video>
 *   at the URL and the browser handles segment fetching.
 * - On Chrome / Firefox / Edge (desktop + Android), HLS is NOT supported
 *   natively, so we attach hls.js, which buffers segments via MSE.
 * - For non-HLS sources (direct MP4 from Plex), the <video> element handles
 *   the URL natively on every platform.
 *
 * `playsInline` is critical on iPhone — without it the video fullscreens
 * automatically on first play, which is jarring on a 3.5"-6.7" screen.
 */
export default function VideoPlayer({ src, poster, onError }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);

    const isHls = /\.m3u8(\?|$)/i.test(src);
    const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl");

    let hls;
    if (isHls && !canNativeHls && Hls.isSupported()) {
      // hls.js path (Chrome / Firefox / Android)
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          const msg = data?.details || data?.type || "Playback failed";
          setError(`Playback error (${msg})`);
          onError?.(msg);
        }
      });
      hlsRef.current = hls;
    } else {
      // Native path (Safari iOS / direct-MP4 everywhere)
      video.src = src;
    }

    const onVideoError = () => {
      const code = video.error?.code;
      const map = {
        1: "Playback aborted",
        2: "Network error",
        3: "Decoding error (codec not supported on this device)",
        4: "Source not supported",
      };
      const msg = map[code] || "Playback failed";
      setError(msg);
      onError?.(msg);
    };
    video.addEventListener("error", onVideoError);

    // autoplay on mobile requires muted or user gesture; we only call play()
    // — the parent passes autoPlay attr; we don't force unmute.
    const tryPlay = video.play?.();
    if (tryPlay && typeof tryPlay.catch === "function") {
      tryPlay.catch(() => { /* user must tap play; controls are visible */ });
    }

    return () => {
      video.removeEventListener("error", onVideoError);
      if (hls) { try { hls.destroy(); } catch { /* noop */ } }
      hlsRef.current = null;
    };
  }, [src, retryKey, onError]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="w-10 h-10 text-amber-300 mb-3" />
        <div className="text-amber-100 text-sm sm:text-base font-medium" data-testid="player-error">{error}</div>
        <button
          data-testid="player-retry"
          onClick={() => setRetryKey((k) => k + 1)}
          className="mt-4 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-sm flex items-center gap-2 border border-white/15"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      data-testid="video-player"
      controls
      autoPlay
      playsInline
      preload="auto"
      poster={poster}
      className="w-full h-full"
    />
  );
}
