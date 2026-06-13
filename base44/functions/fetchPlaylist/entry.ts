import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const XTREAM_BASE = 'http://pro.business-cdn-8k.com';
const XTREAM_USER = '17cefb5a42fa';
const XTREAM_PASS = 'ed70795405';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (SmartTV; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  'Referer': XTREAM_BASE + '/',
  'Origin': XTREAM_BASE,
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url, proxy } = body;
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    // Proxy mode: pass through raw content (m3u8 manifests + ts segments)
    if (proxy) {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        return Response.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
      }

      const ct = res.headers.get('content-type') || 'application/octet-stream';
      const isM3U8 = ct.includes('mpegurl') || url.includes('.m3u8');

      if (isM3U8) {
        // Rewrite relative segment URLs to absolute so HLS.js can find them
        const text = await res.text();
        const base = url.substring(0, url.lastIndexOf('/') + 1);
        const rewritten = text.replace(/^(?!#)(.+\S.*)$/gm, (line) => {
          if (line.startsWith('http')) return line;
          return base + line;
        });
        return new Response(rewritten, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // TS segments — stream binary through
      return new Response(res.body, {
        headers: {
          'Content-Type': ct,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Normal API fetch (player_api.php JSON responses)
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