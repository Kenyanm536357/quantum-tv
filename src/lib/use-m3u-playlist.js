import { useState, useEffect, useCallback } from 'react';
import { setState } from './iptv-store';
import { cleanName } from './clean-name';
import { base44 } from '@/api/base44Client';

const CACHE_KEY = 'qtv_browse_cache_v12';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// M3U source — US channels from iptv-org
const M3U_SOURCE = 'https://iptv-org.github.io/iptv/countries/us.m3u';

// Clear old cache keys
['qtv_browse_cache_v1','qtv_browse_cache_v2','qtv_browse_cache_v3',
 'qtv_browse_cache_v4','qtv_browse_cache_v5','qtv_browse_cache_v6',
 'qtv_browse_cache_v7','qtv_browse_cache_v8','qtv_browse_cache_v9',
 'qtv_browse_cache_v10','qtv_browse_cache_v11'].forEach(k => {
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

// Parse M3U text into { categories, streams }
function parseM3U(text) {
  const lines = text.split('\n');
  const streams = [];
  const categoryMap = {};
  let catIdCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;

    const urlLine = lines[i + 1]?.trim();
    if (!urlLine || urlLine.startsWith('#')) continue;

    // Parse attributes from #EXTINF line
    const nameMatch = line.match(/,(.+)$/);
    const name = nameMatch ? nameMatch[1].trim() : 'Unknown';

    const groupMatch = line.match(/group-title="([^"]*)"/i);
    const group = groupMatch ? groupMatch[1].trim() : 'General';

    const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
    const logo = logoMatch ? logoMatch[1].trim() : null;

    // Build category map
    if (!categoryMap[group]) {
      categoryMap[group] = String(catIdCounter++);
    }
    const category_id = categoryMap[group];

    streams.push({
      stream_id: String(streams.length + 1),
      name,
      stream_icon: logo || null,
      category_id,
      direct_url: urlLine,
    });
  }

  // Build sorted categories array
  const categories = Object.entries(categoryMap)
    .map(([category_name, category_id]) => ({ category_id, category_name }))
    .sort((a, b) => a.category_name.localeCompare(b.category_name));

  return { categories, streams };
}

async function fetchM3UPlaylist() {
  const response = await base44.functions.invoke('fetchPlaylist', {
    fetchM3U: true,
    m3uUrl: M3U_SOURCE,
  });
  const text = response.data;
  if (!text || typeof text !== 'string') throw new Error('Invalid M3U response');
  return parseM3U(text);
}

export async function resolveStreamUrl(stream_id, directUrl) {
  // For M3U streams, return the direct URL immediately
  if (directUrl) return directUrl;
  // Fallback: Xtream stream URL
  const response = await base44.functions.invoke('fetchPlaylist', { getStreamUrl: true, stream_id });
  return response.data?.stream_url || null;
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
      safeCacheSet(CACHE_KEY, data);
      setPlaylist(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  return { playlist, loading, error, refresh: () => load(true) };
}

export async function playM3UStream(stream) {
  // Use direct_url for M3U-sourced streams
  const src = stream.direct_url || await resolveStreamUrl(stream.stream_id || stream.stream_id_ref);
  setState({ player: { src, title: cleanName(stream.name), type: 'live' } });
}