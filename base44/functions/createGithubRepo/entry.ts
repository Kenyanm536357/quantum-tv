import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

// Build the M3U by fetching and merging all category playlists from iptv-org
const CATEGORIES = [
  { name: 'Movies',      url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { name: 'Series',      url: 'https://iptv-org.github.io/iptv/categories/series.m3u' },
  { name: 'Animation',   url: 'https://iptv-org.github.io/iptv/categories/animation.m3u' },
  { name: 'Documentary', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
  { name: 'Kids',        url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
  { name: 'News',        url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { name: 'Sports',      url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: 'Music',       url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
  { name: 'Comedy',      url: 'https://iptv-org.github.io/iptv/categories/comedy.m3u' },
  { name: 'Lifestyle',   url: 'https://iptv-org.github.io/iptv/categories/lifestyle.m3u' },
  { name: 'Science',     url: 'https://iptv-org.github.io/iptv/categories/science.m3u' },
  { name: 'Travel',      url: 'https://iptv-org.github.io/iptv/categories/travel.m3u' },
  { name: 'Weather',     url: 'https://iptv-org.github.io/iptv/categories/weather.m3u' },
  { name: 'General',     url: 'https://iptv-org.github.io/iptv/categories/general.m3u' },
];

async function buildM3U() {
  let merged = '#EXTM3U\n';
  for (const cat of CATEGORIES) {
    try {
      const res = await fetch(cat.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      let text = await res.text();
      // Strip the #EXTM3U header line from each sub-playlist, inject group-title
      text = text.replace(/^#EXTM3U[^\n]*\n?/m, '');
      // Inject group-title into each EXTINF line that doesn't have one
      text = text.replace(/(#EXTINF:[^\n]*)(group-title="[^"]*")/g, `$1group-title="${cat.name}"`);
      text = text.replace(/(#EXTINF:[^\n]*)(?!.*group-title)/g, `$1 group-title="${cat.name}"`);
      merged += `\n# ── ${cat.name} ──\n` + text.trim() + '\n';
    } catch (_) {
      // skip category on error
    }
  }
  return merged;
}

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

    // Get authenticated user
    const meRes = await fetch('https://api.github.com/user', { headers });
    const me = await meRes.json();
    if (!meRes.ok) return Response.json({ error: me.message }, { status: meRes.status });

    const owner = me.login;
    const repoName = 'quantum-tv';

    // Check if repo exists
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });

    let repo;
    let created = false;

    if (checkRes.status === 404) {
      // Create repo
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'Quantum TV — IPTV Media Player M3U Playlists',
          private: false,
          auto_init: true,
        }),
      });
      repo = await createRes.json();
      if (!createRes.ok) return Response.json({ error: repo.message }, { status: createRes.status });
      created = true;

      // Small delay for GitHub to initialize the repo
      await new Promise(r => setTimeout(r, 2000));
    } else {
      repo = await checkRes.json();
    }

    // Build merged M3U from all categories
    const M3U_CONTENT = await buildM3U();

    // Add / update index.m3u in the repo
    const fileContent = btoa(unescape(encodeURIComponent(M3U_CONTENT)));
    const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/index.m3u`, {
      headers,
    });

    let sha = null;
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      sha = fileData.sha;
    }

    const putBody = {
      message: 'chore: update M3U playlist index',
      content: fileContent,
      ...(sha ? { sha } : {}),
    };

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/index.m3u`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody),
    });

    const putData = await putRes.json();
    if (!putRes.ok) return Response.json({ error: putData.message }, { status: putRes.status });

    const rawM3uUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/main/index.m3u`;

    return Response.json({
      url: repo.html_url,
      full_name: repo.full_name,
      created,
      m3u_url: rawM3uUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});