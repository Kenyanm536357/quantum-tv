import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const XTREAM_BASE = 'http://pro.business-cdn-8k.com';
const XTREAM_USER = '17cefb5a42fa';
const XTREAM_PASS = 'ed70795405';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { url, proxy } = body;
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (SmartTV; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Referer': XTREAM_BASE + '/',
      'Origin': XTREAM_BASE,
    };

    // Proxy mode: stream binary content (ts segments, m3u8 manifests)
    if (proxy) {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) return Response.json({ error: `Upstream error: ${res.status}` }, { status: 502 });

      const ct = res.headers.get('content-type') || 'application/octet-stream';

      // For m3u8 manifests, rewrite segment URLs to go through this proxy
      if (ct.includes('mpegurl') || url.includes('.m3u8') || url.endsWith('/')) {
        const text = await res.text();
        // Rewrite relative .ts and .m3u8 segment URLs to absolute
        const base = url.substring(0, url.lastIndexOf('/') + 1);
        const rewritten = text.replace(/^(?!#)(.+)$/gm, (line) => {
          if (line.startsWith('http')) return line;
          return base + line;
        });
        return new Response(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // For TS segments, stream binary
      return new Response(res.body, {
        status: 200,
        headers: {
          'Content-Type': ct,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Normal API fetch (JSON responses from player_api.php)
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
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