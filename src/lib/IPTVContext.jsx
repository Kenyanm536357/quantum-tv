import React, { createContext, useContext, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const IPTVContext = createContext(null);

export function IPTVProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [activeSection, setActiveSection] = useState('live'); // live | movies | series | settings
  const [nowPlaying, setNowPlaying] = useState(null);

  const buildUrl = useCallback((action, extra = {}) => {
    if (!config) return null;
    const params = new URLSearchParams({
      username: config.username,
      password: config.password,
      action,
      ...extra,
    });
    const base = config.base_url.replace(/\/$/, '');
    return `${base}/player_api.php?${params.toString()}`;
  }, [config]);

  const streamUrl = useCallback((streamId, type = 'live') => {
    if (!config) return null;
    const base = config.base_url.replace(/\/$/, '');
    if (type === 'live') return `${base}/live/${config.username}/${config.password}/${streamId}.m3u8`;
    if (type === 'movie') return `${base}/movie/${config.username}/${config.password}/${streamId}.mp4`;
    if (type === 'series') return `${base}/series/${config.username}/${config.password}/${streamId}.mp4`;
    return null;
  }, [config]);

  const fetchApi = useCallback(async (action, extra = {}) => {
    const url = buildUrl(action, extra);
    if (!url) throw new Error('No configuration set');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, [buildUrl]);

  return (
    <IPTVContext.Provider value={{
      config, setConfig,
      activeSection, setActiveSection,
      nowPlaying, setNowPlaying,
      fetchApi, buildUrl, streamUrl
    }}>
      {children}
    </IPTVContext.Provider>
  );
}

export function useIPTV() {
  const ctx = useContext(IPTVContext);
  if (!ctx) throw new Error('useIPTV must be used within IPTVProvider');
  return ctx;
}