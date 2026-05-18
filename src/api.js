const API_BASE = import.meta.env.VITE_API_BASE || runtimeApiBase();
const WS_BASE = import.meta.env.VITE_WS_BASE || '';

function runtimeApiBase() {
  if (typeof window === 'undefined') return '';
  if (window.location.port === '8765') return '';
  return `${window.location.protocol}//${window.location.hostname}:8765`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new Error(payload?.message || `${response.status} ${response.statusText}`);
  }
  if (!payload) throw new Error('API 返回了非 JSON 响应');
  return payload;
}

export const api = {
  status: () => request('/api/status'),
  now: () => request('/api/now'),
  planToday: (mood) =>
    request('/api/plan/today', {
      method: 'POST',
      body: JSON.stringify({ mood })
    }),
  mood: () => request('/api/mood'),
  setMood: (mood) =>
    request('/api/mood', {
      method: 'PUT',
      body: JSON.stringify({ mood })
    }),
  playback: (action, body = {}) =>
    request(`/api/playback/${action}`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  chat: (message) =>
    request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    }),
  neteaseStatus: () => request('/api/netease/status'),
  neteaseQrCreate: () =>
    request('/api/netease/qr/create', {
      method: 'POST',
      body: JSON.stringify({})
    }),
  neteaseQrCheck: (key) =>
    request('/api/netease/qr/check', {
      method: 'POST',
      body: JSON.stringify({ key })
    }),
  neteaseLike: (track, like) =>
    request('/api/netease/like', {
      method: 'POST',
      body: JSON.stringify({ track, like })
    }),
  castDevices: () => request('/api/cast/devices'),
  castConnect: (host, port) =>
    request('/api/cast/connect', {
      method: 'POST',
      body: JSON.stringify({ host, port })
    }),
  castPlay: (url, meta = {}) =>
    request('/api/cast/play', {
      method: 'POST',
      body: JSON.stringify({ url, ...meta })
    }),
  castAction: (action, body = {}) =>
    request(`/api/cast/${action}`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  castHeartbeat: (body = {}) =>
    request('/api/cast/heartbeat', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  voicePreview: (body) =>
    request('/api/voice/preview', {
      method: 'POST',
      body: JSON.stringify(body)
    })
};

export function castActionBeacon(action, body = {}) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(body);
  const url = action === 'stop' ? '/api/cast/stop' : `${API_BASE}/api/cast/${action}`;
  const blob = new Blob([payload], { type: 'application/json' });
  if (navigator.sendBeacon?.(url, blob)) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

export function streamUrl() {
  if (WS_BASE) return WS_BASE;
  const apiBase = API_BASE || window.location.origin;
  const url = new URL(apiBase);
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws/stream`;
}

export function apiAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}
