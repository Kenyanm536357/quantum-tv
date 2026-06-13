import React, { useState } from 'react';
import { X, Copy, ChevronDown, ChevronUp, Bug } from 'lucide-react';

export default function DebugPanel({ logs, onClose }) {
  const [expanded, setExpanded] = useState(true);

  const copyLogs = () => {
    const text = logs.map(l =>
      `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()} | ${l.event} | ${JSON.stringify(l.detail)}`
    ).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="absolute bottom-16 left-3 right-3 z-50 rounded-xl border border-yellow-500/30 bg-black/95 backdrop-blur-sm overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
        <div className="flex items-center gap-2 text-yellow-400 font-bold">
          <Bug className="w-3.5 h-3.5" />
          Stream Debug Log
          <span className="text-yellow-500/50 font-normal">({logs.length} events)</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLogs} className="text-yellow-400/60 hover:text-yellow-300 transition-colors px-1.5 py-0.5 rounded border border-yellow-500/20 hover:border-yellow-400/40 text-[10px]">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="text-yellow-400/60 hover:text-yellow-300 transition-colors">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="text-yellow-400/60 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log entries */}
      {expanded && (
        <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
          {logs.length === 0 && (
            <p className="text-white/30 text-center py-4">No events yet…</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`rounded-lg px-2.5 py-2 border ${
              log.level === 'error'   ? 'bg-red-950/60 border-red-500/25 text-red-300' :
              log.level === 'warn'    ? 'bg-yellow-950/60 border-yellow-500/25 text-yellow-300' :
              log.level === 'success' ? 'bg-green-950/60 border-green-500/25 text-green-300' :
                                        'bg-white/4 border-white/8 text-white/60'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-[10px] uppercase tracking-wider opacity-80">{log.event}</span>
                <span className="text-[9px] opacity-40">{new Date(log.ts).toLocaleTimeString()}</span>
              </div>
              {log.detail && Object.keys(log.detail).length > 0 && (
                <div className="space-y-0.5">
                  {Object.entries(log.detail).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="opacity-50 flex-shrink-0">{k}:</span>
                      <span className="break-all">{String(v ?? 'null')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}