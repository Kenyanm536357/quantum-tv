/**
 * Playlist hook — fetches from public iptv-org M3U (Americas region).
 * No credentials needed. Stream URLs are direct from the M3U.
 */
import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';
import { parseM3U } from './m3u-parser';
import { base44 } from '@/api/base44Client';

const CACHE_KEY = 'qtv_m3u_cache_v3';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const M3U_URL = 'https://iptv-org.github.io/iptv/regions/amer.m3u';

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

async function fetchM3UPlaylist() {
  // Use backend proxy to avoid CORS issues
  const res = await base44.functions.invoke('fetchPlaylist', { fetchM3U: true, m3uUrl: M3U_URL });
  const text = res.data;
  if (!text || typeof text !== 'string') throw new Error('Empty playlist response.');
  return parseM3U(text);
}

export function resolveStreamUrl(stream) {
  return stream?.direct_url || null;
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
      const data = await fetchM3UPlaylist();
      safeCacheSet(data);
      setPlaylist(data);
    } catch (e) {
      setError(e.message || 'Failed to load channels. Please try again.');
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
  const src = stream?.direct_url;
  if (src) {
    setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
  }
}