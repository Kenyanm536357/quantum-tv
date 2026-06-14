import React, { useState, useEffect } from 'react';
import { RotateCcw, Copy, CheckCircle, Tv2, Monitor, Smartphone } from 'lucide-react';

// Detect platform
function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/Android TV|AFTT|AFTM|AFTB|AFTRS|AFTS|AFTN|Fire TV|Silk/i.test(ua)) return 'firestick';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

// Simple QR code via Google Charts API (no npm needed)
function QRCode({ url, size = 160 }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=0d1220&color=ffffff&margin=10`;
  return (
    <img
      src={qrUrl}
      alt="QR Code"
      width={size}
      height={size}
      className="rounded-xl border border-white/10"
    />
  );
}

export default function CorsBlockedScreen({ src, onRetry }) {
  const [platform] = useState(() => detectPlatform());
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  const vlcUrl = `vlc://${src.replace(/^https?:\/\//, '')}`;
  const intentUrl = `intent:${src}#Intent;type=video/mp4;package=org.videolan.vlc;end`;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-5 text-center">

      {/* Icon + title */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mb-1">
          {platform === 'firestick' ? <Tv2 className="w-7 h-7 text-orange-400" /> :
           platform === 'desktop'   ? <Monitor className="w-7 h-7 text-orange-400" /> :
                                      <Smartphone className="w-7 h-7 text-orange-400" />}
        </div>
        <p className="text-white font-bold text-base">Browser Can't Play This Stream</p>
        <p className="text-white/40 text-xs max-w-[280px] leading-relaxed">
          {platform === 'firestick'
            ? 'Fire Stick browsers block HLS streams. Open it in VLC or MX Player instead.'
            : platform === 'desktop'
            ? 'Your browser blocked this stream (CORS). Open it in VLC on your PC/Mac.'
            : 'Your browser blocked this stream. Open it in VLC to watch it.'}
        </p>
      </div>

      {/* ── Fire Stick ── */}
      {platform === 'firestick' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* Copy URL — user can paste into VLC / MX Player on Fire Stick */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
            <p className="flex-1 text-[10px] text-white/40 truncate text-left font-mono">{src}</p>
            <button onClick={copyUrl} className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/50" />}
            </button>
          </div>

          {/* QR code — scan from phone to get stream URL */}
          <button
            onClick={() => setShowQR(v => !v)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold text-sm hover:bg-violet-500/30 transition-all"
          >
            📱 {showQR ? 'Hide QR Code' : 'Show QR Code (scan from phone)'}
          </button>

          {showQR && (
            <div className="flex flex-col items-center gap-2">
              <QRCode url={src} size={160} />
              <p className="text-[10px] text-white/30">Scan with your phone to open the stream</p>
            </div>
          )}

          <p className="text-[10px] text-white/30 leading-relaxed">
            Copy the URL above and paste it into <span className="text-white/50 font-semibold">VLC</span> or <span className="text-white/50 font-semibold">MX Player</span> on your Fire Stick.
          </p>
        </div>
      )}

      {/* ── Android ── */}
      {platform === 'android' && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <a href={intentUrl}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-400 transition-all">
            🎬 Open in VLC
          </a>
          <a href={src} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all">
            ▶ Open in Native Player
          </a>
        </div>
      )}

      {/* ── iOS ── */}
      {platform === 'ios' && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <a href={vlcUrl}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-400 transition-all">
            🎬 Open in VLC
          </a>
          <a href={src} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-all">
            ▶ Open in Native Player
          </a>
        </div>
      )}

      {/* ── Desktop ── */}
      {platform === 'desktop' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href={vlcUrl}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-400 transition-all">
            🎬 Open in VLC
          </a>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
            <p className="flex-1 text-[10px] text-white/40 truncate text-left font-mono">{src}</p>
            <button onClick={copyUrl} className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/50" />}
            </button>
          </div>
          <p className="text-[10px] text-white/30">Or copy the URL and open it in VLC → Media → Open Network Stream</p>
        </div>
      )}

      {/* Retry */}
      <button onClick={onRetry}
        className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-white/6 border border-white/10 text-white/40 text-sm hover:bg-white/10 hover:text-white/70 transition-all">
        <RotateCcw className="w-3.5 h-3.5" /> Try Again
      </button>

      {platform !== 'firestick' && (
        <p className="text-[10px] text-white/20">
          Don't have VLC? Free at <span className="text-white/35">videolan.org</span>
        </p>
      )}
    </div>
  );
}