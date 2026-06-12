/**
 * MAC Address based activation store for Quantum TV.
 * Flow: show MAC → admin activates in Multi-Player → app unlocks
 */

const STORAGE_KEY = 'qtv_mac_activation';

// Generate a stable pseudo-MAC from browser fingerprint
// (Real MAC is not accessible from browser — we generate a unique device ID)
function generateDeviceId() {
  let id = localStorage.getItem('qtv_device_id');
  if (!id) {
    // Generate a random MAC-style identifier (XX:XX:XX:XX:XX:XX)
    const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    id = [hex(), hex(), hex(), hex(), hex(), hex()].join(':');
    localStorage.setItem('qtv_device_id', id);
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
    return data?.activated === true;
  } catch {
    return false;
  }
}

export function activateDevice(mac) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activated: true,
    mac,
    activatedAt: new Date().toISOString(),
  }));
}

export function deactivateDevice() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('qtv_device_id');
}

export function getActivationData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}