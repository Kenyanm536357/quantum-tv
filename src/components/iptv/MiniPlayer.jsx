import React, { useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { X, Maximize2 } from 'lucide-react';
import { setState } from '@/lib/iptv-store';
import { cleanName } from '@/lib/clean-name';

/**
 * Floating mini-player shown on EPG page while a stream is active.
 * Clicking "expand" reopens the full-screen VideoPlayer.
 */
export default function MiniPlayer({ src, title, type }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const init = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.onloadedmetadata = () => video.play().catch(() => {});
    }
  }, [src]);

  useEffect(() => {
    init();
    return () => { hlsRef.current?.destroy(); };
  }, [init]);

  const isLive = type === 'live';

  return (
    <div className="fixed bottom-6 right-6 z-40 w-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          muted
        />

        {/* Badges */}
        <div className="absolute top-2 left-2">
          {isLive && (
            <span className="inline-flex items-center gap-1 bg-destructive px-2 py-0.5 rounded-full text-[10px] font-bold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => setState({ player: { src, title, type } })}
            className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-3 h-3 text-white" />
          </button>
          <button
            onClick={() => setState({ player: null })}
            className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>

      {/* Title bar */}
      <div className="px-3 py-2 bg-[#0d1117]">
        <p className="text-xs font-semibold text-white truncate">{cleanName(title)}</p>
        <p className="text-[10px] text-white/40 mt-0.5">Now Playing</p>
      </div>
    </div>
  );
}