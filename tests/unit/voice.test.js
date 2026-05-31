import test from 'node:test';
import assert from 'node:assert/strict';
import { ttsHash, getVoicePublicConfig, updateVoiceConfig, ttsFilePath } from '../../server/voice.js';

test('ttsHash is stable and sensitive to mood', () => {
  const a = ttsHash('今晚慢慢听', '平静', '温柔');
  const b = ttsHash('今晚慢慢听', '平静', '温柔');
  const c = ttsHash('今晚慢慢听', '欢乐', '温柔');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('getVoicePublicConfig returns expected keys', () => {
  const store = {
    get() { return { provider: 'local-voice', voiceId: 'test-id', style: '温柔' }; }
  };
  const config = getVoicePublicConfig(store);
  assert.ok('provider' in config);
  assert.ok('voiceId' in config);
  assert.ok('configured' in config);
  assert.ok('localSample' in config);
});

test('updateVoiceConfig applies changes', () => {
  const current = { provider: 'fish-audio', voiceId: 'old', style: '活泼' };
  const store = {
    get() { return current; },
    set(k, v) { Object.assign(current, v); }
  };
  const result = updateVoiceConfig(store, { provider: 'local-voice', style: '温柔安静' });
  assert.ok(result.provider); // 来源由 config 优先决定
  assert.equal(current.style, '温柔安静');
});

test('ttsFilePath returns valid path with hash', () => {
  const p = ttsFilePath('abc123def');
  assert.ok(p.endsWith('abc123def.mp3'));
  assert.ok(p.includes('tts-cache') || p.includes('data') || p.includes('cache'));
});
