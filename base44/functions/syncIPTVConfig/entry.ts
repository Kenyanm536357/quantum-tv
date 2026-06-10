import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled automations (no user) or admin users
    let isAutomation = false;
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    } catch {
      // Called by automation (no user token) — allow via service role
      isAutomation = true;
    }

    const configs = await base44.asServiceRole.entities.IPTVConfig.list();

    if (!configs || configs.length === 0) {
      return Response.json({ message: 'No IPTVConfig records found.', synced: 0 });
    }

    const results = [];

    for (const config of configs) {
      const now = new Date().toISOString();

      try {
        // Build the Xtream Codes player_api URL
        const base = config.base_url.replace(/\/$/, '');
        const url = `${base}/player_api.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}&action=get_live_categories`;

        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // Valid response is an array of categories or an object with user_info
        const isValid = Array.isArray(data) || (data && data.user_info);

        if (!isValid) {
          throw new Error('Invalid API response — bad credentials or unsupported server.');
        }

        await base44.asServiceRole.entities.IPTVConfig.update(config.id, {
          status: 'active',
          last_synced: now,
          error_message: ''
        });

        results.push({ id: config.id, label: config.label, status: 'active' });
      } catch (err) {
        const message = err.name === 'TimeoutError' || err.name === 'AbortError'
          ? 'Connection timed out'
          : (err.message || 'Unknown error');

        await base44.asServiceRole.entities.IPTVConfig.update(config.id, {
          status: 'error',
          last_synced: new Date().toISOString(),
          error_message: message
        });

        results.push({ id: config.id, label: config.label, status: 'error', error: message });
      }
    }

    return Response.json({
      message: `Synced ${configs.length} config(s).`,
      synced: configs.length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});