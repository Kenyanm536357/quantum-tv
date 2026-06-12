import { createClientFromRequest } from 'npm:@base44/sdk@0.8.32';

const M3U_CONTENT = `#EXTM3U
#EXTINF:-1 tvg-id="" tvg-name="iptv-org All Channels" tvg-logo="" group-title="All",iptv-org All Channels
https://iptv-org.github.io/iptv/index.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org English" tvg-logo="" group-title="English",iptv-org English
https://iptv-org.github.io/iptv/languages/eng.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Spanish" tvg-logo="" group-title="Spanish",iptv-org Spanish
https://iptv-org.github.io/iptv/languages/spa.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org News" tvg-logo="" group-title="News",iptv-org News
https://iptv-org.github.io/iptv/categories/news.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Sports" tvg-logo="" group-title="Sports",iptv-org Sports
https://iptv-org.github.io/iptv/categories/sports.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Movies" tvg-logo="" group-title="Movies",iptv-org Movies
https://iptv-org.github.io/iptv/categories/movies.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Kids" tvg-logo="" group-title="Kids",iptv-org Kids
https://iptv-org.github.io/iptv/categories/kids.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Music" tvg-logo="" group-title="Music",iptv-org Music
https://iptv-org.github.io/iptv/categories/music.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Documentary" tvg-logo="" group-title="Documentary",iptv-org Documentary
https://iptv-org.github.io/iptv/categories/documentary.m3u

#EXTINF:-1 tvg-id="" tvg-name="iptv-org Religious" tvg-logo="" group-title="Religious",iptv-org Religious
https://iptv-org.github.io/iptv/categories/religious.m3u
`;

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

    // Add / update index.m3u in the repo
    const fileContent = btoa(M3U_CONTENT);
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
      m3u_raw_content: M3U_CONTENT,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});