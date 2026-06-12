import { useState, useEffect, useCallback } from 'react';
import { parseM3U } from './m3u-parser';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';

const QUANTUM_M3U_URL = 'https://raw.githubusercontent.com/kenyanmcgarr/quantum-tv/main/index.m3u';
const CACHE_KEY = 'qtv_browse_cache_v2';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function fetchWithProxy(url, timeout = 30000) {
  const proxies = [
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u) => `https://cors-anywhere.herokuapp.com/${u}`,
  ];
  for (const makeProxy of proxies) {
    try {
      const proxyUrl = makeProxy(url);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) continue;
      if (proxyUrl.includes('allorigins')) {
        const json = await res.json();
        if (json.contents?.includes('#EXTINF')) return json.contents;
        continue;
      }
      const text = await res.text();
      if (text.includes('#EXTINF')) return text;
    } catch (_) {}
  }
  throw new Error('Failed to load playlist — all proxies failed.');
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