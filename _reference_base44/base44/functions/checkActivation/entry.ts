/**
 * checkActivation — verifies if a device MAC is activated.
 * POST { mac } → { activated: true/false }
 * 
 * Admin can also activate a device:
 * POST { mac, action: 'activate', adminKey: '...' } → { activated: true }
 * POST { mac, action: 'deactivate', adminKey: '...' } → { activated: false }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ADMIN_KEY = Deno.env.get('QUANTUM_ADMIN_KEY') || 'quantum-admin-2024';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { mac, action, adminKey } = body;

    if (!mac) {
      return Response.json({ error: 'MAC address required' }, { status: 400 });
    }

    // Normalize MAC
    const normalizedMac = mac.toUpperCase().trim();

    if (action === 'activate' || action === 'deactivate') {
      // Admin-only — verify admin key
      if (adminKey !== ADMIN_KEY) {
        return Response.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Find existing record
      const existing = await base44.asServiceRole.entities.DeviceActivation.filter({ mac: normalizedMac });

      if (action === 'activate') {
        if (existing.length > 0) {
          await base44.asServiceRole.entities.DeviceActivation.update(existing[0].id, {
            activated: true,
            activated_at: new Date().toISOString(),
          });
        } else {
          await base44.asServiceRole.entities.DeviceActivation.create({
            mac: normalizedMac,
            activated: true,
            activated_at: new Date().toISOString(),
          });
        }
        return Response.json({ activated: true, mac: normalizedMac });
      }

      if (action === 'deactivate') {
        if (existing.length > 0) {
          await base44.asServiceRole.entities.DeviceActivation.update(existing[0].id, {
            activated: false,
          });
        }
        return Response.json({ activated: false, mac: normalizedMac });
      }
    }

    // Default: just check activation status (no auth required — device polls this)
    const records = await base44.asServiceRole.entities.DeviceActivation.filter({ mac: normalizedMac });
    const record = records[0];
    const isActivated = record && record.activated === true && !record.locked;

    return Response.json({ activated: isActivated, mac: normalizedMac, locked: record?.locked ?? false });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});