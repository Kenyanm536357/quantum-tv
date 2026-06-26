import { useState, useCallback } from 'react';
import { apiUrl } from './iptv-store';

/**
 * Generic hook to fetch from Xtream Codes API.
 * Returns { data, loading, error, fetch }
 */
export function useXtream(creds) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAction = useCallback(async (action, extra = {}) => {
    if (!creds) return null;
    setLoading(true);
    setError(null);
    try {
      const url = apiUrl(creds, action, extra);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [creds]);

  return { loading, error, fetchAction };
}