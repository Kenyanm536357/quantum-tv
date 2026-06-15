Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const FETCH_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (SmartTV; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
    };

    const body = await req.json();
    const { action, proxy, url: rawUrl, fetchM3U } = body;

    // Allow per-request credentials (for login validation), fallback to env secrets
    const XTREAM_BASE = (body.baseUrl || Deno.env.get('XTREAM_BASE_URL') || 'http://pro.flickhaven.online').replace(/\/$/, '');
    const XTREAM_USER = body.username || Deno.env.get('XTREAM_USERNAME') || '';
    const XTREAM_PASS = body.password || Deno.env.get('XTREAM_PASSWORD') || '';

    // Helper: fetch with retry on 451/403/503 using alternative approaches
    const fetchWithFallback = async (targetUrl, opts = {}) => {
      // Attempt 1: direct fetch
      const r1 = await fetch(targetUrl, { ...opts, signal: AbortSignal.timeout(30000) });
      if (r1.status !== 451 && r1.status !== 403) return r1;

      // Attempt 2: try HTTPS variant if URL is HTTP
      if (targetUrl.startsWith('http://')) {
        const httpsUrl = targetUrl.replace('http://', 'https://');
        const r2 = await fetch(httpsUrl, { ...opts, signal: AbortSignal.timeout(30000) }).catch(() => null);
        if (r2 && r2.status !== 451 && r2.status !== 403) return r2;
      }

      // Return original response so caller can handle the error code
      return r1;
    };

    // ── Fetch a raw M3U URL and return its text ──────────────────────────────
    if (fetchM3U) {
      const m3uUrl = body.m3uUrl;
      if (!m3uUrl) return Response.json({ error: 'Missing m3uUrl' }, { status: 400 });
      const res = await fetchWithFallback(m3uUrl, { headers: FETCH_HEADERS });
      if (!res.ok) return Response.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
      const text = await res.text();
      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── Build Xtream API URL server-side ─────────────────────────────────────
    const url = action
      ? `${XTREAM_BASE}/player_api.php?username=${XTREAM_USER}&password=${XTREAM_PASS}&action=${action}`
      : rawUrl;

    if (!url) return Response.json({ error: 'Missing url or action' }, { status: 400 });

    // ── Return signed stream URL ─────────────────────────────────────────────
    if (body.getStreamUrl) {
      const streamUrl = `${XTREAM_BASE}/live/${XTREAM_USER}/${XTREAM_PASS}/${body.stream_id}.m3u8`;
      return Response.json({ stream_url: streamUrl });
    }

    // Return a direct M3U stream URL for M3U-sourced streams
    if (body.getM3UStreamUrl) {
      return Response.json({ stream_url: body.directUrl });
    }

    // ── Proxy mode ───────────────────────────────────────────────────────────
    if (proxy) {
      const res = await fetchWithFallback(url, { headers: FETCH_HEADERS });
      if (!res.ok) return Response.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
      const ct = res.headers.get('content-type') || 'application/octet-stream';
      const isM3U8 = ct.includes('mpegurl') || url.includes('.m3u8');
      if (isM3U8) {
        const text = await res.text();
        const base = url.substring(0, url.lastIndexOf('/') + 1);
        const rewritten = text.replace(/^(?!#)(.+\S.*)$/gm, (line) => {
          if (line.startsWith('http')) return line;
          return base + line;
        });
        return new Response(rewritten, {
          headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*' },
        });
      }
      return new Response(res.body, {
        headers: { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ── Normal Xtream API fetch ───────────────────────────────────────────────
    const isLargeAction = action === 'get_live_streams' || action === 'get_vod_streams' || action === 'get_series';
    const res = await fetchWithFallback(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(isLargeAction ? 60000 : 30000),
    });
    if (!res.ok) return Response.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json') || url.includes('player_api')) {
      const json = await res.json();
      return Response.json(json);
    }
    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});