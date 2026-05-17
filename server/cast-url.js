import { station } from './defaults.js';
import { config } from './config.js';

function cleanHost(host) {
  const value = String(host || '').trim();
  if (!value) return '';
  return value.replace(/^\[/, '').replace(/\]$/, '').split(':')[0];
}

function isLocalHost(host) {
  return ['localhost', '127.0.0.1', '::1'].includes(String(host || '').toLowerCase());
}

function configuredHost() {
  if (cleanHost(station.apiHost)) return cleanHost(station.apiHost);
  try {
    return cleanHost(new URL(config.webOrigin).hostname);
  } catch (_) {
    return '';
  }
}

export function resolveCastHost(requestHost = '') {
  const host = cleanHost(requestHost);
  if (host && !isLocalHost(host)) return host;
  const configured = configuredHost();
  return configured || '127.0.0.1';
}

export function buildCastUrl(url, { requestHost = '', apiPort = config.apiPort } = {}) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const host = resolveCastHost(requestHost);

  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    if (isLocalHost(parsed.hostname)) {
      parsed.hostname = host;
      if (!parsed.port) parsed.port = String(apiPort);
    }
    return parsed.toString();
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `http://${host}:${apiPort}${path}`;
}
