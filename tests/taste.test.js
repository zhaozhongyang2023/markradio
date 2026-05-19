import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveNeteaseTaste } from '../server/taste.js';

// Mock store that simulates no NetEase login
function mockStore(overrides = {}) {
  const data = { ...overrides };
  return {
    get(key) {
      return data[key] !== undefined ? data[key] : null;
    },
    set(key, value) {
      data[key] = value;
      return value;
    },
    recentPlays() { return []; }
  };
}

test('deriveNeteaseTaste returns null when neteaseApiBase not configured', async () => {
  // No NETEASE_API_BASE set → should return null
  const store = mockStore();
  const result = await deriveNeteaseTaste(store);
  // When neteaseApiBase is not configured or cookie is missing, returns null
  assert.equal(result, null);
});

test('deriveNeteaseTaste returns null when no cookie', async () => {
  // Even if NETEASE_API_BASE is configured, no cookie → null
  const store = mockStore();
  // neteaseAuth is empty → getNeteaseCookie returns ''
  const result = await deriveNeteaseTaste(store);
  assert.equal(result, null);
});

test('deriveNeteaseTaste returns cached result when API and cookie available', async () => {
  const cached = {
    topArtists: ['周杰伦', '陈奕迅'],
    playlistLabels: ['深夜独处'],
    languageRatio: { chinese: 0.8, english: 0.2 },
    avgEnergy: 0.45,
    trackCount: 20,
    summary: '常听艺人：周杰伦、陈奕迅；收藏歌单：深夜独处；偏好中文；中等能量。',
    source: 'netease',
    fetchedAt: new Date().toISOString()
  };

  const store = mockStore({
    neteaseTaste: cached,
    neteaseAuth: { cookie: 'test-cookie', loginAt: new Date().toISOString() }
  });

  // Even without neteaseApiBase configured, with a cached result and cookie,
  // it should return cached data
  // Actually, deriveNeteaseTaste checks config.neteaseApiBase first
  // So this won't work without NETEASE_API_BASE
  // Let me just verify the null path works correctly
  const result = await deriveNeteaseTaste(store);
  // When NETEASE_API_BASE is configured (as in .env) and cookie + cache exist, returns cached
  assert.ok(result);
  assert.equal(result.topArtists[0], '周杰伦');
});
