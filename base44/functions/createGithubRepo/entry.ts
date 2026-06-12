import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let name = 'quantum-tv-iptv';
    let description = 'Quantum TV IPTV Media Player';
    let isPrivate = false;

    try {
      const b = await req.clone().json();
      if (b.name) name = b.name;
      if (b.description) description = b.description;
      if (b.isPrivate !== undefined) isPrivate = b.isPrivate;
    } catch (_) { /* use defaults */ }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
    });

    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.message }, { status: res.status });

    return Response.json({ url: data.html_url, full_name: data.full_name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});