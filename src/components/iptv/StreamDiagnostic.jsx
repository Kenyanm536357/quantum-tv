import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function StreamDiagnostic({ url, onClose }) {
  const [status, setStatus] = useState(null); // null | 'checking' | 'ok' | 'fail'
  const [detail, setDetail] = useState('');

  const check = async (e) => {
    e.stopPropagation();
    setStatus('checking');
    setDetail('');
    try {
      const res = await base44.functions.invoke('fetchPlaylist', { url, proxy: true });
      const data = res.data;
      if (typeof data === 'string' && data.includes('#EXTM3U')) {
        setStatus('ok');
        setDetail('Stream is live and responding.');
      } else if (typeof data === 'string' && data.length > 0) {
        setStatus('ok');
        setDetail('Server responded. Stream may be active.');
      } else {
        setStatus('fail');
        setDetail('Empty or unreadable response.');
      }
    } catch (err) {
      setStatus('fail');
      setDetail(err.message || 'Connection failed.');
    }
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20"
      onClick={e => e.stopPropagation()}
    >
      {/* Diagnostic button */}
      {status === null && (
        <button
          onClick={check}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white/60 hover:text-cyan-400 hover:bg-black/90 transition-all"
        >
          <Activity className="w-3 h-3" /> Check Stream
        </button>
      )}

      {/* Checking */}
      {status === 'checking' && (
        <div className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-black/80 text-[10px] text-white/50">
          <Loader2 className="w-3 h-3 animate-spin" /> Checking…
        </div>
      )}

      {/* Result */}
      {(status === 'ok' || status === 'fail') && (
        <div className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 text-[10px] font-semibold ${status === 'ok' ? 'bg-green-900/80 text-green-300' : 'bg-red-900/80 text-red-300'}`}>
          <div className="flex items-center gap-1 truncate">
            {status === 'ok'
              ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
              : <XCircle className="w-3 h-3 flex-shrink-0" />}
            <span className="truncate">{detail}</span>
          </div>
          <button onClick={() => setStatus(null)} className="flex-shrink-0 opacity-60 hover:opacity-100 ml-1">✕</button>
        </div>
      )}
    </div>
  );
}