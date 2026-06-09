/**
 * Tiny reactive store for IPTV app state.
 * No React context overhead — plain JS with subscriber pattern.
 */

const initialState = {
  /** @type {{baseUrl:string,username:string,password:string,label:string}|null} */
  credentials: null,
  /** 'live' | 'movies' | 'series' | 'settings' */
  section: 'live',
  /** @type {{src:string,title:string,type:'live'|'vod'|'series'}|null} */
  player: null,
};

let state = { ...initialState };
const subscribers = new Set();

export function getState() { return state; }

export function setState(patch) {
  state = { ...state, ...patch };
  subscribers.forEach(fn => fn(state));
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Persist credentials to localStorage */
export function saveCredentials(creds) {
  localStorage.setItem('iptv_creds', JSON.stringify(creds));
  setState({ credentials: creds });
}

export function loadCredentials() {
  try {
    const raw = localStorage.getItem('iptv_creds');
    if (raw) {
      const creds = JSON.parse(raw);
      setState({ credentials: creds });
      return creds;
    }
  } catch {}
  return null;
}

export function clearCredentials() {
  localStorage.removeItem('iptv_creds');
  setState({ credentials: null, section: 'live', player: null });
}

/** Build Xtream Codes API URL */
export function apiUrl(creds, action, extra = {}) {
  const base = creds.baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ username: creds.username, password: creds.password, action, ...extra });
  return `${base}/player_api.php?${params}`;
}

/** Build stream URL */
export function streamUrl(creds, id, ext = 'm3u8') {
  const base = creds.baseUrl.replace(/\/+$/, '');
  return `${base}/live/${creds.username}/${creds.password}/${id}.${ext}`;
}

export function vodUrl(creds, id, ext = 'mp4') {
  const base = creds.baseUrl.replace(/\/+$/, '');
  return `${base}/movie/${creds.username}/${creds.password}/${id}.${ext}`;
}

export function episodeUrl(creds, id, ext = 'mp4') {
  const base = creds.baseUrl.replace(/\/+$/, '');
  return `${base}/series/${creds.username}/${creds.password}/${id}.${ext}`;
}