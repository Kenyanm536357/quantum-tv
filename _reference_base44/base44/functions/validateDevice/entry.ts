/**
 * validateDevice — checks if a username+password is registered, active, and not expired.
 * POST { username, password } → { valid: true/false, reason: string }
 * Also used for periodic subscription checks: POST { username, checkOnly: true }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { username, password, checkOnly } = body;

    if (!username) {
      return Response.json({ valid: false, reason: 'missing_username' }, { status: 400 });
    }

    // Look up the device record by username
    const records = await base44.asServiceRole.entities.DeviceActivation.filter({ username: username.trim() });

    if (!records || records.length === 0) {
      return Response.json({ valid: false, reason: 'not_registered' });
    }

    const record = records[0];

    // If not a checkOnly, verify password matches
    if (!checkOnly) {
      if (!record.password || record.password.trim() !== (password || '').trim()) {
        return Response.json({ valid: false, reason: 'invalid_credentials' });
      }
    }

    // Check if deactivated
    if (!record.activated) {
      return Response.json({ valid: false, reason: 'not_activated' });
    }

    // Check if locked
    if (record.locked) {
      return Response.json({ valid: false, reason: 'locked' });
    }

    // Check expiration
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return Response.json({ valid: false, reason: 'expired', expires_at: record.expires_at });
    }

    return Response.json({
      valid: true,
      expires_at: record.expires_at,
      username: record.username,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});