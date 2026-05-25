import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCastUrl, resolveCastHost } from '../../server/cast-url.js';

test('buildCastUrl exposes relative media paths on the API host', () => {
  const url = buildCastUrl('/media/audio?id=123', {
    requestHost: '192.168.2.33:8765',
    apiPort: 8765
  });
  assert.equal(url, 'http://192.168.2.33:8765/media/audio?id=123');
});

test('buildCastUrl rewrites localhost urls for network speakers', () => {
  const url = buildCastUrl('http://localhost:8765/media/audio?id=123', {
    requestHost: '192.168.2.33:8765',
    apiPort: 8765
  });
  assert.equal(url, 'http://192.168.2.33:8765/media/audio?id=123');
});

test('resolveCastHost falls back from localhost to configured LAN host', () => {
  assert.notEqual(resolveCastHost('localhost:8765'), 'localhost');
});
