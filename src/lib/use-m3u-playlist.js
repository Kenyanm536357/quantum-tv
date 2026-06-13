import { useState, useEffect, useCallback } from 'react';
import { parseM3U } from './m3u-parser';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';

const QUANTUM_M3U_URL = 'http://pro.business-cdn-8k.com/get.php?username=17cefb5a42fa&password=ed70795405&type=m3u_plus&output=ts';
const CACHE_KEY = 'qtv_browse_cache_v5'; // bumped to clear old oversized cache

// Clear any old cache keys that may be bloating localStorage
['qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3','qtv_browse_cache_v4'].forEach(k => {
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
  const proxies = [
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://cors-anywhere.herokuapp.com/${url}`,
  ];

  let lastError;
  // Try direct first
  try {
    const res = await fetch(QUANTUM_M3U_URL, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTM3U')) return parseM3U(text);
    }
  } catch (e) {
    lastError = e;
  }

  // Try each proxy
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy(QUANTUM_M3U_URL), { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('#EXTM3U')) return parseM3U(text);
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error('Failed to load playlist. All sources unavailable.');
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