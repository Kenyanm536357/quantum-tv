/**
 * Playlist hook — fetches live categories + streams directly from Xtream Codes API
 * using credentials stored in localStorage. No backend proxy needed.
 */
import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';

const CACHE_KEY = 'qtv_xtream_cache_v1';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// Clean up ALL old cache keys
const OLD_KEYS = [
  'qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3',
  'qtv_browse_cache_v4','qtv_browse_cache_v5','qtv_browse_cache_v6',
  'qtv_browse_cache_v7','qtv_browse_cache_v8','qtv_browse_cache_v9',
  'qtv_browse_cache_v10','qtv_browse_cache_v11','qtv_browse_cache_v12',
];
OLD_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });

function getStoredCreds() {
  try {
    return JSON.parse(localStorage.getItem('qtv_xtream_creds') || '{}');
  } catch (_) { return {}; }
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

function safeCacheSet(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch (_) {}
  }
}

async function xtreamFetch(action) {
  const { baseUrl, username, password } = getStoredCreds();
  if (!baseUrl || !username || !password) throw new Error('Not logged in.');
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${action}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

async function fetchXtreamPlaylist() {
  const [categories, rawStreams] = await Promise.all([
    xtreamFetch('get_live_categories'),
    xtreamFetch('get_live_streams'),
  ]);

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('No categories returned. Check your connection.');
  }
  if (!Array.isArray(rawStreams)) {
    throw new Error('No streams returned from server.');
  }

  const streams = rawStreams
    .filter(s => s && s.stream_id)
    .map(s => ({
      stream_id:   String(s.stream_id),
      name:        s.name || 'Unknown',
      stream_icon: s.stream_icon || null,
      category_id: String(s.category_id || ''),
      num:         s.num || 0,
    }));

  const normalizedCats = categories
    .filter(c => c && c.category_id)
    .map(c => ({
      category_id:   String(c.category_id),
      category_name: c.category_name || 'General',
    }));

  return { categories: normalizedCats, streams };
}

export function resolveStreamUrl(stream_id) {
  const { baseUrl, username, password } = getStoredCreds();
  if (!baseUrl || !username || !password) return null;
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${stream_id}.m3u8`;
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
      const data = await fetchXtreamPlaylist();
      safeCacheSet(data);
      setPlaylist(data);
    } catch (e) {
      setError(e.message || 'Failed to load channels. Please try again.');
      const stale = (() => {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          return raw ? JSON.parse(raw).data : null;
        } catch (_) { return null; }
      })();
      if (stale) setPlaylist(stale);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  return { playlist, loading, error, refresh: () => load(true) };
}

export async function playM3UStream(stream) {
  const src = resolveStreamUrl(stream.stream_id);
  if (src) {
    setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
  }
}