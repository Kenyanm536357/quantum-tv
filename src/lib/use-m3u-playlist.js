import { useState, useEffect, useCallback } from 'react';
import { parseM3U } from './m3u-parser';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';

const QUANTUM_M3U_URL = 'https://iptv-org.github.io/iptv/index.m3u';
const CACHE_KEY = 'qtv_browse_cache_v4'; // bumped to clear old oversized cache

// Clear any old cache keys that may be bloating localStorage
['qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3'].forEach(k => {
  try { localStorage.removeItem(k); } catch(_) {}
});
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function getCachedPlaylist() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch (_) {}
  return null;
}

async function fetchPlaylist() {
  const res = await fetch(QUANTUM_M3U_URL);
  if (!res.ok) throw new Error('Failed to load playlist.');
  const text = await res.text();
  if (!text.includes('#EXTM3U')) throw new Error('Invalid playlist format.');
  return parseM3U(text);
}

function safeCacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {
    // Quota exceeded — skip caching, data stays in memory only
  }
}

export function useM3UPlaylist() {
  const [playlist, setPlaylist] = useState(() => getCachedPlaylist());
  const [loading, setLoading]   = useState(!getCachedPlaylist());
  const [error, setError]       = useState(null);

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCachedPlaylist();
      if (cached) { setPlaylist(cached); setLoading(false); return; }
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlaylist();
      safeCacheSet(CACHE_KEY, data);
      setPlaylist(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { playlist, loading, error, refresh: () => load(true) };
}

export function playM3UStream(stream) {
  const src = stream.direct_url || stream.url;
  setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
}