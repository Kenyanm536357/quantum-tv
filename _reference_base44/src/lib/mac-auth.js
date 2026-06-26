/**
 * MAC Address based activation store for Quantum TV.
 * Flow: show MAC → admin activates in Multi-Player → app unlocks
 *
 * IMPORTANT: qtv_device_id is PERMANENT — never deleted, even on deactivation.
 * This ensures the MAC address never changes after first assignment.
 */

const STORAGE_KEY    = 'qtv_mac_activation';
const DEVICE_ID_KEY  = 'qtv_device_id';

// Generate a stable pseudo-MAC from browser fingerprint
// (Real MAC is not accessible from browser — we generate a unique device ID)
function generateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    id = [hex(), hex(), hex(), hex(), hex(), hex()].join(':');
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceMAC() {
  return generateDeviceId();
}

export function isActivated() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    // Must be activated AND not locked
    return data?.activated === true && data?.locked !== true;
  } catch {
    return false;
  }
}

export function isLocked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.locked === true;
  } catch {
    return false;
  }
}

export function activateDevice(mac) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activated: true,
    locked: false,
    mac,
    activatedAt: new Date().toISOString(),
  }));
}

export function lockDeviceLocally() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, locked: true }));
  } catch {}
}

export function unlockDeviceLocally() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, locked: false }));
  } catch {}
}

export function deactivateDevice() {
  // ⚠️ NEVER remove qtv_device_id — the MAC must stay permanent
  localStorage.removeItem(STORAGE_KEY);
}

export function getActivationData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}