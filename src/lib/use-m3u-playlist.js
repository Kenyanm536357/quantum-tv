import { useState, useEffect, useCallback } from 'react';
import { parseM3U } from './m3u-parser';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';
import { base44 } from '@/api/base44Client';

const QUANTUM_M3U_URL = 'http://pro.business-cdn-8k.com/get.php?username=17cefb5a42fa&password=ed70795405&type=m3u_plus&output=m3u8';
const CACHE_KEY = 'qtv_browse_cache_v6'; // bumped to clear old oversized cache

// Clear any old cache keys that may be bloating localStorage
['qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3','qtv_browse_cache_v4','qtv_browse_cache_v5'].forEach(k => {
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
  const response = await base44.functions.invoke('fetchPlaylist', { url: QUANTUM_M3U_URL });
  const text = response.data;
  if (!text || !text.includes('#EXTM3U')) throw new Error('Invalid playlist format received.');
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