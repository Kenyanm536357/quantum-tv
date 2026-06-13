import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await req.json();
    if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPTV/1.0)' },
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