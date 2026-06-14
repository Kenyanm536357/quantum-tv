import React, { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';

// Known mobile video players with their deep link schemes
const PLAYERS = [
  {
    id: 'vlc_ios',
    name: 'VLC',
    icon: '🎬',
    platforms: ['ios'],
    getUrl: (src) => `vlc://${src.replace(/^https?:\/\//, '')}`,
    installUrl: 'https://apps.apple.com/app/vlc-for-mobile/id650377962',
  },
  {
    id: 'vlc_android',
    name: 'VLC',
    icon: '🎬',
    platforms: ['android', 'firestick'],
    getUrl: (src) => `intent:${src}#Intent;type=video/mp4;package=org.videolan.vlc;end`,
    installUrl: 'https://play.google.com/store/apps/details?id=org.videolan.vlc',
  },
  {
    id: 'mxplayer',
    name: 'MX Player',
    icon: '▶️',
    platforms: ['android', 'firestick'],
    getUrl: (src) => `intent:${src}#Intent;package=com.mxtech.videoplayer.ad;end`,
    installUrl: 'https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad',
  },
  {
    id: 'mxplayer_pro',
    name: 'MX Player Pro',
    icon: '▶️',
    platforms: ['android', 'firestick'],
    getUrl: (src) => `intent:${src}#Intent;package=com.mxtech.videoplayer.pro;end`,
    installUrl: 'https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.pro',
  },
  {
    id: 'infuse',
    name: 'Infuse',
    icon: '🔥',
    platforms: ['ios'],
    getUrl: (src) => `infuse://x-callback-url/play?url=${encodeURIComponent(src)}`,
    installUrl: 'https://apps.apple.com/app/infuse-7/id1136220934',
  },
  {
    id: 'outplayer',
    name: 'Outplayer',
    icon: '📺',
    platforms: ['ios'],
    getUrl: (src) => `outplayer://${src}`,
    installUrl: 'https://apps.apple.com/app/outplayer/id1449923287',
  },
  {
    id: 'justplayer',
    name: 'Just Player',
    icon: '⚡',
    platforms: ['android'],
    getUrl: (src) => `intent:${src}#Intent;package=com.brouken.player;end`,
    installUrl: 'https://play.google.com/store/apps/details?id=com.brouken.player',
  },
  {
    id: 'native',
    name: 'Native Player',
    icon: '📱',
    platforms: ['ios', 'android', 'firestick'],
    getUrl: (src) => src,
    openTarget: '_blank',
  },
];

const PLATFORM_PREFS_KEY = 'qtv_preferred_player';

function getPlatform() {
  const ua = navigator.userAgent || '';
  if (/Android TV|AFTT|AFTM|AFTB|AFTRS|AFTS|AFTN|Fire TV|Silk/i.test(ua)) return 'firestick';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

export function getPreferredPlayer() {
  try { return localStorage.getItem(PLATFORM_PREFS_KEY); } catch (_) { return null; }
}

export function setPreferredPlayer(id) {
  try { localStorage.setItem(PLATFORM_PREFS_KEY, id); } catch (_) {}
}

export function openWithPlayer(src, playerId) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return false;
  const url = player.getUrl(src);
  if (player.openTarget === '_blank') {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
  return true;
}

export default function PlayerPicker({ src, platform, onClose, onSelect }) {
  const [saved, setSaved] = useState(false);
  const available = PLAYERS.filter(p => p.platforms.includes(platform));

  const handleSelect = (player) => {
    setPreferredPlayer(player.id);
    setSaved(true);
    onSelect?.(player.id);
    const url = player.getUrl(src);
    setTimeout(() => {
      if (player.openTarget === '_blank') window.open(url, '_blank');
      else window.location.href = url;
      onClose?.();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-[#0d1220] border border-white/10 rounded-t-3xl p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-black text-base">Choose Video Player</h2>
            <p className="text-white/35 text-xs mt-0.5">Your selection will be remembered</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {available.map(player => (
            <button
              key={player.id}
              onClick={() => handleSelect(player)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/20 transition-all text-left"
            >
              <span className="text-2xl w-9 text-center">{player.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{player.name}</p>
                {player.installUrl && (
                  <p className="text-[10px] text-white/30">Tap to open · Install if needed</p>
                )}
              </div>
              {saved && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-white/20 text-center mt-4">
          You can change this anytime in Settings
        </p>
      </div>
    </div>
  );
}