import { useState, useEffect, useCallback } from 'react';
import { parseM3U } from './m3u-parser';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';

const QUANTUM_M3U_URL = 'http://thisiptv.com:8080/get.php?username=9998220347&password=2576958008&type=m3u_plus';
const CACHE_KEY = 'qtv_browse_cache_v2';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function fetchWithProxy(url, timeout = 30000) {
  // 1. Try direct (works for GitHub raw URLs which allow CORS)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) return text;
    }
  } catch (_) {}

  // 2. corsproxy.io
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(timeout) });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) return text;
    }
  } catch (_) {}

  // 3. allorigins
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(timeout) });
    if (res.ok) {
      const json = await res.json();
      if (json.contents?.includes('#EXTINF')) return json.contents;
    }
  } catch (_) {}

  // 4. jsonp.su (another open proxy)
  try {
    const res = await fetch(`https://jsonp.su/proxy?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(timeout) });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF') || text.includes('#EXTM3U')) return text;
    }
  } catch (_) {}

  throw new Error('Could not load playlist. Please check your internet connection or sync the playlist from the Admin panel.');
}

function getCachedPlaylist() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch (_) {}
  return null;
}

export function useM3UPlaylist() {
  const [playlist, setPlaylist] = useState(() => getCachedPlaylist());
  const [loading, setLoading] = useState(!getCachedPlaylist());
  const [error, setError] = useState(null);

  const load = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCachedPlaylist();
      if (cached) { setPlaylist(cached); setLoading(false); return; }
    }
    setLoading(true);
    setError(null);
    try {
      const text = await fetchWithProxy(QUANTUM_M3U_URL);
      const parsed = parseM3U(text);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: parsed, ts: Date.now() }));
      setPlaylist(parsed);
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