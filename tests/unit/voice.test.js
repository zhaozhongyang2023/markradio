import test from 'node:test';
import assert from 'node:assert/strict';
import { ttsHash } from '../../server/voice.js';

test('ttsHash is stable and sensitive to mood', () => {
  const a = ttsHash('今晚慢慢听', '平静', '温柔');
  const b = ttsHash('今晚慢慢听', '平静', '温柔');
  const c = ttsHash('今晚慢慢听', '欢乐', '温柔');
  assert.equal(a, b);
  assert.notEqual(a, c);
});
