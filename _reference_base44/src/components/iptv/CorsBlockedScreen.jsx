import React, { useState } from 'react';
import { RotateCcw, Copy, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CorsBlockedScreen({ src, onRetry }) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
      <AlertTriangle className="w-10 h-10 text-orange-400" />
      <div>
        <p className="text-white font-bold text-sm mb-1">Stream Blocked</p>
        <p className="text-white/40 text-xs max-w-[280px] leading-relaxed">
          The browser is blocking this stream. This is usually a CORS or mixed-content restriction from the stream provider.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 w-full max-w-xs">
        <p className="flex-1 text-[10px] text-white/40 truncate text-left font-mono">{src}</p>
        <button onClick={copyUrl} className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors">
          {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/50" />}
        </button>
      </div>

      <button onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all">
        <RotateCcw className="w-4 h-4" /> Retry
      </button>
    </div>
  );
}