/**
 * Playlist hook — fetches live categories + streams via backend proxy
 * (needed because browser blocks mixed HTTP/HTTPS content).
 * Stream playback URLs are resolved client-side.
 */
import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';
import { base44 } from '@/api/base44Client';

const CACHE_KEY = 'qtv_xtream_cache_v2';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

const CURRENT_BASE = 'http://pro.business-cdn-8k.com';
const STALE_BASES = ['http://pro.flickhaven.online', 'https://pro.flickhaven.online'];

function getStoredCreds() {
  try {
    const raw = localStorage.getItem('qtv_xtream_creds');
    if (!raw) return {};
    let c = JSON.parse(raw);
    if (c.baseUrl && STALE_BASES.some(s => c.baseUrl.startsWith(s))) {
      c = { ...c, baseUrl: CURRENT_BASE };
      localStorage.setItem('qtv_xtream_creds', JSON.stringify(c));
    }
    return c;
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

export function bustPlaylistCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}

function safeCacheSet(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {
    try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
  }
}

async function fetchXtreamPlaylist() {
  const creds = getStoredCreds();
  if (!creds.username || !creds.password) throw new Error('Not logged in.');

  // Use backend proxy to avoid mixed-content browser blocking
  const [catRes, streamRes] = await Promise.all([
    base44.functions.invoke('fetchPlaylist', {
      action: 'get_live_categories',
      username: creds.username,
      password: creds.password,
    }),
    base44.functions.invoke('fetchPlaylist', {
      action: 'get_live_streams',
      username: creds.username,
      password: creds.password,
    }),
  ]);

  const categories = catRes.data;
  const rawStreams = streamRes.data;

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('No categories returned. Check your credentials.');
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
      // Show stale cache if available
      const stale = (() => {
        try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw).data : null; } catch (_) { return null; }
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