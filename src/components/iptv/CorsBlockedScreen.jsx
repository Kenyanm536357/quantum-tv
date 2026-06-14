import React, { useState } from 'react';
import { RotateCcw, Copy, CheckCircle, Tv2, Monitor, Smartphone, ChevronDown } from 'lucide-react';
import PlayerPicker, { getPreferredPlayer, setPreferredPlayer, openWithPlayer } from './PlayerPicker';

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/Android TV|AFTT|AFTM|AFTB|AFTRS|AFTS|AFTN|Fire TV|Silk/i.test(ua)) return 'firestick';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

function QRCode({ url, size = 160 }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=0d1220&color=ffffff&margin=10`;
  return <img src={qrUrl} alt="QR Code" width={size} height={size} className="rounded-xl border border-white/10" />;
}

const PLAYER_LABELS = {
  vlc_ios: 'VLC', vlc_android: 'VLC', mxplayer: 'MX Player',
  mxplayer_pro: 'MX Player Pro', infuse: 'Infuse', outplayer: 'Outplayer',
  justplayer: 'Just Player', native: 'Native Player',
};

export default function CorsBlockedScreen({ src, onRetry }) {
  const [platform] = useState(() => detectPlatform());
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [preferredPlayer, setPreferred] = useState(() => getPreferredPlayer());

  const isMobile = platform === 'ios' || platform === 'android' || platform === 'firestick';

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  const handleOpenWithPreferred = () => {
    if (preferredPlayer) {
      openWithPlayer(src, preferredPlayer);
    } else {
      setShowPicker(true);
    }
  };

  const handlePlayerSelected = (id) => {
    setPreferred(id);
    setShowPicker(false);
  };

  const vlcUrl = `vlc://${src.replace(/^https?:\/\//, '')}`;

  return (
    <>
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
              : 'Your browser blocked this stream. Open it in an external player.'}
          </p>
        </div>

        {/* ── Mobile / Fire Stick ── */}
        {isMobile && (
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {/* Open with preferred / choose player */}
            <button
              onClick={handleOpenWithPreferred}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-400 transition-all"
            >
              🎬 {preferredPlayer ? `Open in ${PLAYER_LABELS[preferredPlayer] || 'Player'}` : 'Open in External Player'}
            </button>

            {/* Change player */}
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-white/6 border border-white/10 text-white/50 text-xs hover:bg-white/10 hover:text-white/70 transition-all"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              {preferredPlayer ? 'Change Player' : 'Choose Player'}
            </button>

            {/* Fire Stick extras */}
            {platform === 'firestick' && (
              <>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                  <p className="flex-1 text-[10px] text-white/40 truncate text-left font-mono">{src}</p>
                  <button onClick={copyUrl} className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/50" />}
                  </button>
                </div>
                <button onClick={() => setShowQR(v => !v)}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold text-sm hover:bg-violet-500/30 transition-all">
                  📱 {showQR ? 'Hide QR Code' : 'Scan from Phone'}
                </button>
                {showQR && (
                  <div className="flex flex-col items-center gap-2">
                    <QRCode url={src} size={160} />
                    <p className="text-[10px] text-white/30">Scan with your phone to open the stream</p>
                  </div>
                )}
              </>
            )}
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
            <p className="text-[10px] text-white/30">Or copy URL → VLC → Media → Open Network Stream</p>
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

      {/* Player picker sheet */}
      {showPicker && (
        <PlayerPicker
          src={src}
          platform={platform}
          onClose={() => setShowPicker(false)}
          onSelect={handlePlayerSelected}
        />
      )}
    </>
  );
}