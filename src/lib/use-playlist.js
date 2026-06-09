/**
 * Unified playlist hook supporting Xtream Codes, M3U, and MAC/Stalker portals.
 * Exposes the same { loading, error, fetchAction, resolveStreamUrl } interface
 * so all section components work unchanged (except using this hook instead of useXtream).
 */

import { useState, useCallback } from 'react';
import { apiUrl, streamUrl, vodUrl, episodeUrl } from './iptv-store';

// ─── Stalker / MAG portal helpers ────────────────────────────────────────────

async function stalkerGetToken(credentials) {
  const key = `stalker_token_${credentials.mac}`;
  let token = sessionStorage.getItem(key);
  if (!token) {
    const base = credentials.portalUrl.replace(/\/+$/, '');
    const res = await fetch(
      `${base}/portal.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`,
      { headers: stalkerBaseHeaders(credentials) }
    );
    const data = await res.json();
    token = data.js?.token ?? '';
    if (token) sessionStorage.setItem(key, token);
  }
  return token;
}

function stalkerBaseHeaders(credentials) {
  return {
    Cookie: `mac=${credentials.mac}; stb_lang=en; timezone=GMT`,
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
  };
}

function stalkerHeaders(credentials, token) {
  return { ...stalkerBaseHeaders(credentials), Authorization: `Bearer ${token}` };
}

async function stalkerAction(credentials, action, extra) {
  const base = credentials.portalUrl.replace(/\/+$/, '');
  const token = await stalkerGetToken(credentials);
  const h = stalkerHeaders(credentials, token);

  if (action === 'get_live_categories') {
    const res = await fetch(`${base}/portal.php?type=itv&action=get_genres&JsHttpRequest=1-xml`, { headers: h });
    const data = await res.json();
    return (data.js ?? []).map(g => ({ category_id: g.id, category_name: g.title }));
  }
  if (action === 'get_live_streams') {
    const res = await fetch(
      `${base}/portal.php?type=itv&action=get_ordered_list&genre=${extra.category_id}&p=1&JsHttpRequest=1-xml`,
      { headers: h }
    );
    const data = await res.json();
    return (data.js?.data ?? []).map(ch => ({
      stream_id: ch.id,
      name: ch.name,
      stream_icon: ch.logo,
      _stalker_cmd: ch.cmd,
    }));
  }
  if (action === 'get_vod_categories') {
    const res = await fetch(`${base}/portal.php?type=vod&action=get_categories&JsHttpRequest=1-xml`, { headers: h });
    const data = await res.json();
    return (data.js ?? []).map(g => ({ category_id: g.id, category_name: g.title }));
  }
  if (action === 'get_vod_streams') {
    const res = await fetch(
      `${base}/portal.php?type=vod&action=get_ordered_list&category=${extra.category_id}&p=1&JsHttpRequest=1-xml`,
      { headers: h }
    );
    const data = await res.json();
    return (data.js?.data ?? []).map(v => ({
      stream_id: v.id,
      name: v.name,
      stream_icon: v.screenshot_uri,
      _stalker_cmd: v.cmd,
    }));
  }
  return null;
}

export async function stalkerCreateLink(credentials, cmd) {
  const base = credentials.portalUrl.replace(/\/+$/, '');
  const token = await stalkerGetToken(credentials);
  const h = stalkerHeaders(credentials, token);
  const encoded = encodeURIComponent(cmd);
  const res = await fetch(
    `${base}/portal.php?type=itv&action=create_link&cmd=${encoded}&JsHttpRequest=1-xml`,
    { headers: h }
  );
  const data = await res.json();
  // Strip the "ffrt " prefix if present
  const raw = data.js?.cmd ?? cmd;
  return raw.replace(/^ffrt\s+/, '');
}

// ─── M3U helpers ──────────────────────────────────────────────────────────────

function m3uAction(action, extra) {
  const raw = localStorage.getItem('m3u_parsed');
  if (!raw) return [];
  const { categories, streams } = JSON.parse(raw);
  if (action === 'get_live_categories' || action === 'get_vod_categories') return categories;
  if (action === 'get_live_streams' || action === 'get_vod_streams') {
    return streams.filter(s => s.category_id === extra.category_id);
  }
  return [];
}

// ─── Xtream Codes helpers ─────────────────────────────────────────────────────

async function xtreamAction(credentials, action, extra) {
  const url = apiUrl(credentials, action, extra);
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Public hook ──────────────────────────────────────────────────────────────

export function usePlaylist(credentials) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAction = useCallback(async (action, extra = {}) => {
    if (!credentials) return null;
    setLoading(true);
    setError(null);
    try {
      const type = credentials.type ?? 'xtream';
      if (type === 'm3u') return m3uAction(action, extra);
      if (type === 'mac') return await stalkerAction(credentials, action, extra);
      return await xtreamAction(credentials, action, extra);
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  /** Returns the final playable URL for a stream item (may be async for MAC portals). */
  const resolveStreamUrl = useCallback(async (item, streamType) => {
    const type = credentials?.type ?? 'xtream';
    if (type === 'm3u') return item.direct_url;
    if (type === 'mac') return stalkerCreateLink(credentials, item._stalker_cmd);
    // Xtream Codes
    if (streamType === 'live') return streamUrl(credentials, item.stream_id);
    if (streamType === 'vod') return vodUrl(credentials, item.stream_id);
    return episodeUrl(credentials, item.id ?? item.stream_id);
  }, [credentials]);

  return { loading, error, fetchAction, resolveStreamUrl };
}