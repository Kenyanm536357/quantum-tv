import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let accessToken = null;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('github');
      accessToken = conn?.accessToken;
    } catch (e) {
      return Response.json({ error: 'GitHub not connected: ' + e.message }, { status: 403 });
    }

    if (!accessToken) return Response.json({ error: 'No GitHub access token found' }, { status: 403 });

    // List user repos to find quantum-tv
    const reposRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    const repos = await reposRes.json();
    if (!reposRes.ok) return Response.json({ error: repos.message }, { status: reposRes.status });

    const qtRepo = repos.find(r => r.name.toLowerCase().includes('quantum'));

    if (!qtRepo) {
      // Create quantum-tv repo
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'quantum-tv',
          description: 'Quantum TV — IPTV Media Player',
          private: false,
          auto_init: true,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) return Response.json({ error: created.message }, { status: createRes.status });
      return Response.json({ url: created.html_url, full_name: created.full_name, created: true });
    }

    return Response.json({ url: qtRepo.html_url, full_name: qtRepo.full_name, created: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});