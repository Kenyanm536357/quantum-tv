import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';

const BASE_URL  = 'http://thisiptv.com:8080';
const USERNAME  = '9998220347';
const PASSWORD  = '2576958008';
const API_BASE  = `${BASE_URL}/player_api.php?username=${USERNAME}&password=${PASSWORD}`;
const STREAM_BASE = `${BASE_URL}/live/${USERNAME}/${PASSWORD}`;

const CACHE_KEY = 'qtv_xtream_cache_v1';
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

async function fetchXtream() {
  const [catsRes, streamsRes] = await Promise.all([
    fetch(`${API_BASE}&action=get_live_categories`),
    fetch(`${API_BASE}&action=get_live_streams`),
  ]);

  if (!catsRes.ok || !streamsRes.ok) throw new Error('Failed to reach Xtream Codes server.');

  const [categories, rawStreams] = await Promise.all([catsRes.json(), streamsRes.json()]);

  if (!Array.isArray(categories) || !Array.isArray(rawStreams)) {
    const msg = categories?.error || rawStreams?.error || 'Invalid response from server.';
    throw new Error(msg);
  }

  const streams = rawStreams.map(s => ({
    stream_id:    s.stream_id,
    name:         s.name,
    stream_icon:  s.stream_icon,
    category_id:  s.category_id,
    direct_url:   `${STREAM_BASE}/${s.stream_id}.m3u8`,
    url:          `${STREAM_BASE}/${s.stream_id}.m3u8`,
  }));

  return { categories, streams };
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
      const data = await fetchXtream();
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
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