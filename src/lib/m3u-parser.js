/**
 * Parse an M3U/M3U8 playlist into categories + streams
 * compatible with the Xtream Codes data shape.
 */
export function parseM3U(text) {
  const lines = text.split('\n').map(l => l.trim());
  const groupMap = {};
  let meta = null;
  let idx = 0;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      meta = {
        name: line.match(/,(.+)$/)?.[1]?.trim() ?? 'Unknown',
        group: line.match(/group-title="([^"]*)"/)?.[1] ?? 'General',
        logo: line.match(/tvg-logo="([^"]*)"/)?.[1] ?? null,
      };
    } else if (line && !line.startsWith('#') && meta) {
      if (!groupMap[meta.group]) groupMap[meta.group] = [];
      groupMap[meta.group].push({ ...meta, url: line, idx: idx++ });
      meta = null;
    }
  }

  const categories = Object.keys(groupMap).map((name, i) => ({
    category_id: `g${i}`,
    category_name: name,
  }));

  const catIdByName = Object.fromEntries(categories.map(c => [c.category_name, c.category_id]));

  const streams = categories.flatMap(cat =>
    groupMap[cat.category_name].map(s => ({
      stream_id: `m3u_${s.idx}`,
      name: s.name,
      stream_icon: s.logo,
      category_id: catIdByName[cat.category_name],
      direct_url: s.url,
    }))
  );

  return { categories, streams };
}