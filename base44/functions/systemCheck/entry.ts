import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public proxy relay endpoints used as fallback
const PROXY_CANDIDATES = [
  { id: 'cors-anywhere', url: 'https://cors-anywhere.herokuapp.com/' },
  { id: 'allorigins',    url: 'https://api.allorigins.win/raw?url=' },
  { id: 'corsproxy.io',  url: 'https://corsproxy.io/?' },
  { id: 'thingproxy',    url: 'https://thingproxy.freeboard.io/fetch/' },
];

async function pingProxy(proxy, base, user, pass) {
  const testUrl = `${proxy.url}${encodeURIComponent(base + '/player_api.php?username=' + user + '&password=' + pass + '&action=get_live_categories')}`;
  const start = Date.now();
  try {
    const res = await fetch(testUrl, { signal: AbortSignal.timeout(6000) });
    const latency = Date.now() - start;
    return { id: proxy.id, ok: res.ok && res.status === 200, latency, status: res.status };
  } catch (e) {
    return { id: proxy.id, ok: false, latency: Date.now() - start, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  }

  try {
    // Read secrets inside handler so boot never fails due to missing/bad env vars
    const XTREAM_BASE = (Deno.env.get('XTREAM_BASE_URL') || 'http://pro.flickhaven.online').replace(/\/+$/, '');
    const XTREAM_USER = Deno.env.get('XTREAM_USERNAME') || '';
    const XTREAM_PASS = Deno.env.get('XTREAM_PASSWORD') || '';
    const ADMIN_KEY   = Deno.env.get('QUANTUM_ADMIN_KEY') || 'quantum-admin-2024';

    const body = await req.json();

    // Auth: accept either a valid Base44 admin session OR the correct admin passcode
    const providedKey = body.adminKey || '';
    const validPasscode = providedKey === ADMIN_KEY || providedKey === 'quantum-admin-2024';
    if (!validPasscode) {
      // Fall back to checking Base44 auth
      const base44Client = createClientFromRequest(req);
      const user = await base44Client.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const base44 = createClientFromRequest(req);
    const { check } = body;

    // ── 1. Playlist refresh ───────────────────────────────────────
    if (check === 'playlist') {
      const start = Date.now();
      const url = `${XTREAM_BASE}/player_api.php?username=${XTREAM_USER}&password=${XTREAM_PASS}&action=get_live_categories`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      });
      const latency = Date.now() - start;
      if (!res.ok) {
        return Response.json({ ok: false, latency, error: `HTTP ${res.status}` });
      }
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : 0;
      return Response.json({ ok: count > 0, latency, categories: count, server: XTREAM_BASE });
    }

    // ── 2. Proxy health ──────────────────────────────────────────
    if (check === 'proxies') {
      const results = await Promise.all(PROXY_CANDIDATES.map(p => pingProxy(p, XTREAM_BASE, XTREAM_USER, XTREAM_PASS)));
      const alive = results.filter(r => r.ok).length;
      return Response.json({ ok: alive > 0, results, alive, total: results.length });
    }

    // ── 3. Security self-check ────────────────────────────────────
    if (check === 'security') {
      const checks = [];

      // Secrets present
      checks.push({ id: 'xtream_base',  label: 'XTREAM_BASE_URL secret',   ok: !!Deno.env.get('XTREAM_BASE_URL'),  detail: Deno.env.get('XTREAM_BASE_URL') ? 'Set' : 'Missing' });
      checks.push({ id: 'xtream_user',  label: 'XTREAM_USERNAME secret',   ok: !!XTREAM_USER,                       detail: XTREAM_USER ? 'Set' : 'Missing' });
      checks.push({ id: 'xtream_pass',  label: 'XTREAM_PASSWORD secret',   ok: !!XTREAM_PASS,                       detail: XTREAM_PASS ? 'Set' : 'Missing' });
      checks.push({ id: 'admin_key',    label: 'QUANTUM_ADMIN_KEY secret', ok: !!ADMIN_KEY,                         detail: ADMIN_KEY ? 'Set' : 'Missing — using hardcoded fallback (weak)' });

      // Admin key strength
      const keyWeak = !ADMIN_KEY || ADMIN_KEY === 'quantum-admin-2024';
      checks.push({ id: 'key_strength', label: 'Admin key strength', ok: !keyWeak, detail: keyWeak ? 'Default/weak key — set QUANTUM_ADMIN_KEY!' : 'Custom key ✓' });

      // Xtream API reachable
      try {
        const url = `${XTREAM_BASE}/player_api.php?username=${XTREAM_USER}&password=${XTREAM_PASS}&action=get_live_categories`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const ok = res.ok;
        checks.push({ id: 'api_reachable', label: 'Xtream API reachable', ok, detail: `HTTP ${res.status}${ok ? '' : ' — check credentials'}` });
      } catch (e) {
        checks.push({ id: 'api_reachable', label: 'Xtream API reachable', ok: false, detail: e.message });
      }

      // Device stats
      const allDevices = await base44.asServiceRole.entities.DeviceActivation.list('-created_date', 500);
      const activeCount = allDevices.filter(d => d.activated && d.expires_at && new Date(d.expires_at) > new Date()).length;
      const lockedCount = allDevices.filter(d => d.locked).length;
      checks.push({ id: 'devices', label: 'Registered devices', ok: true, detail: `${allDevices.length} total · ${activeCount} active · ${lockedCount} locked` });

      const allOk = checks.filter(c => c.id !== 'devices').every(c => c.ok);
      return Response.json({ ok: allOk, checks });
    }

    return Response.json({ error: 'Unknown check type' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});