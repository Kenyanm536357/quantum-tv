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
    };

    const body = await req.json();
    const { action, proxy, url: rawUrl, fetchM3U } = body;

    // Allow per-request credentials (for login validation), fallback to env secrets
    const XTREAM_BASE = body.baseUrl || 'http://pro.flickhaven.online';
    const XTREAM_USER = body.username || Deno.env.get('XTREAM_USERNAME') || '';
    const XTREAM_PASS = body.password || Deno.env.get('XTREAM_PASSWORD') || '';

    // ── Fetch a raw M3U URL and return its text ──────────────────────────────
    if (fetchM3U) {
      const m3uUrl = body.m3uUrl;
      if (!m3uUrl) return Response.json({ error: 'Missing m3uUrl' }, { status: 400 });
      const res = await fetch(m3uUrl, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(30000),
      });
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
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(30000),
      });
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
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30000),
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
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});