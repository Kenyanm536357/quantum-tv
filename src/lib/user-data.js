/**
 * Persistent user data: bookmarks, watch history, reminders.
 * All data stored in localStorage keyed by IPTV credentials (server URL).
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getKey(type, credentials) {
  const server = credentials?.baseUrl ?? 'default';
  return `qt_${type}_${btoa(server).replace(/=/g, '')}`;
}

function load(type, credentials) {
  try {
    const raw = localStorage.getItem(getKey(type, credentials));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(type, credentials, data) {
  localStorage.setItem(getKey(type, credentials), JSON.stringify(data));
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export function getBookmarks(credentials) {
  return load('bookmarks', credentials);
}

export function addBookmark(credentials, item, streamType) {
  const bookmarks = load('bookmarks', credentials);
  const id = String(item.stream_id ?? item.id ?? item.name);
  if (bookmarks.find(b => b.id === id)) return bookmarks;
  const updated = [{ id, streamType, ...item, bookmarked_at: Date.now() }, ...bookmarks];
  save('bookmarks', credentials, updated);
  return updated;
}

export function removeBookmark(credentials, item) {
  const id = String(item.stream_id ?? item.id ?? item.name);
  const updated = load('bookmarks', credentials).filter(b => b.id !== id);
  save('bookmarks', credentials, updated);
  return updated;
}

export function isBookmarked(credentials, item) {
  const id = String(item.stream_id ?? item.id ?? item.name);
  return load('bookmarks', credentials).some(b => b.id === id);
}

export function toggleBookmark(credentials, item, streamType) {
  if (isBookmarked(credentials, item)) return removeBookmark(credentials, item);
  return addBookmark(credentials, item, streamType);
}

// ─── Watch History ────────────────────────────────────────────────────────────

export function getHistory(credentials) {
  return load('history', credentials);
}

export function addToHistory(credentials, item, streamType, progress = 0) {
  const history = load('history', credentials);
  const id = String(item.stream_id ?? item.id ?? item.name);
  const filtered = history.filter(h => h.id !== id);
  const updated = [{ id, streamType, ...item, progress, watched_at: Date.now() }, ...filtered].slice(0, 200);
  save('history', credentials, updated);
  return updated;
}

export function updateProgress(credentials, item, progress) {
  const history = load('history', credentials);
  const id = String(item.stream_id ?? item.id ?? item.name);
  const updated = history.map(h => h.id === id ? { ...h, progress, watched_at: Date.now() } : h);
  save('history', credentials, updated);
}

export function clearHistory(credentials) {
  save('history', credentials, []);
}

export function removeFromHistory(credentials, item) {
  const id = String(item.stream_id ?? item.id ?? item.name);
  const updated = load('history', credentials).filter(h => h.id !== id);
  save('history', credentials, updated);
  return updated;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export function getReminders(credentials) {
  return load('reminders', credentials);
}

export function addReminder(credentials, item, streamType, remindAt, label = '') {
  const reminders = load('reminders', credentials);
  const id = `rem_${Date.now()}`;
  const updated = [...reminders, {
    id,
    streamType,
    label: label || item.name,
    item,
    remindAt, // ISO string or ms timestamp
    created_at: Date.now(),
    fired: false,
  }];
  save('reminders', credentials, updated);
  return updated;
}

export function removeReminder(credentials, reminderId) {
  const updated = load('reminders', credentials).filter(r => r.id !== reminderId);
  save('reminders', credentials, updated);
  return updated;
}

export function markReminderFired(credentials, reminderId) {
  const updated = load('reminders', credentials).map(r =>
    r.id === reminderId ? { ...r, fired: true } : r
  );
  save('reminders', credentials, updated);
  return updated;
}

export function getDueReminders(credentials) {
  const now = Date.now();
  return load('reminders', credentials).filter(r => !r.fired && new Date(r.remindAt).getTime() <= now);
}