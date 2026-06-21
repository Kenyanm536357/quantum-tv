import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let accessToken = null;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('github');
      accessToken = conn?.accessToken;
    } catch (e) {
      return Response.json({ error: 'GitHub not connected: ' + e.message }, { status: 403 });
    }

    if (!accessToken) return Response.json({ error: 'No GitHub access token found' }, { status: 403 });

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };

    // Get authenticated GitHub user
    const meRes = await fetch('https://api.github.com/user', { headers });
    const me = await meRes.json();
    if (!meRes.ok) return Response.json({ error: me.message }, { status: meRes.status });

    const owner = me.login;
    const repoName = 'quantum-tv-source';

    // Check if repo exists, create if not
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });

    let repo;
    if (checkRes.status === 404) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'Quantum TV — IPTV Media Player Source Code',
          private: true,
          auto_init: true,
        }),
      });
      repo = await createRes.json();
      if (!createRes.ok) return Response.json({ error: repo.message }, { status: createRes.status });
      // Wait for GitHub to initialize
      await new Promise(r => setTimeout(r, 2500));
    } else {
      repo = await checkRes.json();
    }

    // Helper: upsert a file in the repo
    async function upsertFile(path, content) {
      const encoded = btoa(unescape(encodeURIComponent(content)));
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, { headers });
      let sha = null;
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha;
      }
      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `chore: sync ${path}`,
          content: encoded,
          ...(sha ? { sha } : {}),
        }),
      });
      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(`Failed to push ${path}: ${err.message}`);
      }
    }

    // Get the list of files from the app's source via the SDK integration
    const body = await req.json().catch(() => ({}));
    const files = body.files || [];

    if (!files || files.length === 0) {
      return Response.json({ error: 'No files provided. Pass files array in request body.' }, { status: 400 });
    }

    // Push all files
    const results = [];
    for (const { path, content } of files) {
      try {
        await upsertFile(path, content);
        results.push({ path, status: 'ok' });
      } catch (e) {
        results.push({ path, status: 'error', message: e.message });
      }
    }

    return Response.json({
      url: repo.html_url,
      full_name: repo.full_name,
      pushed: results.filter(r => r.status === 'ok').length,
      failed: results.filter(r => r.status === 'error').length,
      results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});