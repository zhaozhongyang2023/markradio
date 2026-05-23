import { config } from './config.js';

export function getNeteaseCookie(store) {
  return store.get('neteaseAuth')?.cookie || '';
}

export async function callNetease(endpoint, params = {}, store = null, timeoutMs = 5000) {
  if (!config.neteaseApiBase) throw new Error('NETEASE_API_BASE not configured');
  const url = new URL(endpoint.replace(/^\//, ''), `${config.neteaseApiBase.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  const cookie = store ? getNeteaseCookie(store) : '';
  if (cookie && !url.searchParams.has('cookie')) url.searchParams.set('cookie', cookie);
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Netease ${endpoint} ${response.status}`);
  return response.json();
}

export async function createNeteaseQr() {
  const keyRes = await callNetease('login/qr/key', { timestamp: Date.now() });
  const key = keyRes?.data?.unikey;
  if (!key) throw new Error('Netease QR key missing');
  const qrRes = await callNetease('login/qr/create', { key, qrimg: true, timestamp: Date.now() });
  return {
    key,
    qrurl: qrRes?.data?.qrurl || '',
    qrimg: qrRes?.data?.qrimg || ''
  };
}

export async function checkNeteaseQr(store, key) {
  const result = await callNetease('login/qr/check', { key, timestamp: Date.now() }, null, 30000);
  if (result.code === 803 && result.cookie) {
    const auth = {
      cookie: result.cookie,
      loginAt: new Date().toISOString()
    };
    store.set('neteaseAuth', auth);
    // 拉取用户 profile，保存 userId 供歌单查询
    try {
      const status = await callNetease('login/status', { timestamp: Date.now() }, store);
      if (status?.data?.profile) {
        const p = status.data.profile;
        store.set('neteaseAuth', { ...auth, profile: { nickname: p.nickname, userId: p.userId, avatarUrl: p.avatarUrl } });
      }
    } catch { /* profile 拉取失败不影响登录 */ }
  }
  return {
    code: result.code,
    message: result.message || '',
    loggedIn: result.code === 803
  };
}

export async function getNeteaseLoginStatus(store) {
  const cookie = getNeteaseCookie(store);
  if (!cookie) return { loggedIn: false, profile: null };
  const status = await callNetease('login/status', { timestamp: Date.now() }, store).catch(() => null);
  const profile = status?.data?.profile || null;
  return {
    loggedIn: Boolean(profile),
    profile: profile ? { nickname: profile.nickname, userId: profile.userId, avatarUrl: profile.avatarUrl } : null
  };
}
