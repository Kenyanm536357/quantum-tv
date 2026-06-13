import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';
import { base44 } from '@/api/base44Client';

const XTREAM_BASE = 'https://pro.business-cdn-8k.com';
const XTREAM_USER = '17cefb5a42fa';
const XTREAM_PASS = 'ed70795405';

const CACHE_KEY = 'qtv_browse_cache_v11';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Clear old cache keys
['qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3',
 'qtv_browse_cache_v4','qtv_browse_cache_v5','qtv_browse_cache_v6',
 'qtv_browse_cache_v7','qtv_browse_cache_v8','qtv_browse_cache_v9',
 'qtv_browse_cache_v10'].forEach(k => {
  try { localStorage.removeItem(k); } catch(_) {}
});

function getCachedPlaylist() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch (_) {}
  return null;
}

function safeCacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

async function xtreamFetch(action) {
  const url = `${XTREAM_BASE}/player_api.php?username=${XTREAM_USER}&password=${XTREAM_PASS}&action=${action}`;
  const response = await base44.functions.invoke('fetchPlaylist', { url });
  // base44.functions.invoke returns an Axios response; .data is the parsed body
  const raw = response.data;
  if (typeof raw === 'string') return JSON.parse(raw);
  // The backend may wrap in { data: [...] } or return the array directly
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return raw;
}

async function fetchPlaylist() {
  // Fetch live categories + streams in parallel
  const [cats, streams] = await Promise.all([
    xtreamFetch('get_live_categories'),
    xtreamFetch('get_live_streams'),
  ]);

  const categories = (cats || []).filter(c => c && c.category_id != null).map(c => ({
    category_id: String(c.category_id),
    category_name: typeof c.category_name === 'string' ? c.category_name : 'General',
  }));

  const mappedStreams = (streams || []).filter(s => s && s.stream_id != null).map(s => ({
    stream_id: String(s.stream_id),
    name: typeof s.name === 'string' ? s.name : 'Unknown',
    stream_icon: s.stream_icon || null,
    category_id: s.category_id != null ? String(s.category_id) : '',
    direct_url: `${XTREAM_BASE}/live/${XTREAM_USER}/${XTREAM_PASS}/${s.stream_id}.m3u8`,
  }));

  return { categories, streams: mappedStreams };
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

  // Always fetch fresh on launch — never serve stale cache
  useEffect(() => { load(true); }, [load]);

  return { playlist, loading, error, refresh: () => load(true) };
}

export function playM3UStream(stream) {
  const src = stream.direct_url || stream.url;
  setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
}