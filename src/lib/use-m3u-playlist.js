/**
 * Playlist hook — fetches live categories + streams from Xtream Codes API
 * via the backend fetchPlaylist function (no credentials exposed to client).
 * Falls back to cached data if the network is unavailable.
 */
import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';
import { base44 } from '@/api/base44Client';

const CACHE_KEY = 'qtv_xtream_cache_v1';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// Clean up ALL old cache keys from previous M3U-based versions
const OLD_KEYS = [
  'qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3',
  'qtv_browse_cache_v4','qtv_browse_cache_v5','qtv_browse_cache_v6',
  'qtv_browse_cache_v7','qtv_browse_cache_v8','qtv_browse_cache_v9',
  'qtv_browse_cache_v10','qtv_browse_cache_v11','qtv_browse_cache_v12',
];
OLD_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });

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
    // Storage full — clear old cache and retry
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch (_) {}
  }
}

async function fetchXtreamPlaylist() {
  // Step 1: fetch categories
  const catRes = await base44.functions.invoke('fetchPlaylist', {
    action: 'get_live_categories',
  });

  const categories = catRes.data;
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('No categories returned from server. Check your credentials.');
  }

  // Step 2: fetch all live streams
  const streamRes = await base44.functions.invoke('fetchPlaylist', {
    action: 'get_live_streams',
  });

  const rawStreams = streamRes.data;
  if (!Array.isArray(rawStreams)) {
    throw new Error('No streams returned from server.');
  }

  // Normalize streams — guard every field
  const streams = rawStreams
    .filter(s => s && s.stream_id)
    .map(s => ({
      stream_id:    String(s.stream_id),
      name:         s.name || 'Unknown',
      stream_icon:  s.stream_icon || null,
      category_id:  String(s.category_id || ''),
      num:          s.num || 0,
    }));

  // Normalize categories
  const normalizedCats = categories
    .filter(c => c && c.category_id)
    .map(c => ({
      category_id:   String(c.category_id),
      category_name: c.category_name || 'General',
    }));

  return { categories: normalizedCats, streams };
}

export async function resolveStreamUrl(stream_id) {
  const res = await base44.functions.invoke('fetchPlaylist', {
    getStreamUrl: true,
    stream_id: String(stream_id),
  });
  return res.data?.stream_url || null;
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
      // Serve stale cache if available so the UI is never blank
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
  // Resolve the HLS URL via backend (keeps credentials server-side)
  const src = await resolveStreamUrl(stream.stream_id);
  if (src) {
    setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
  }
}