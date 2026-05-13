import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, parseDjJson } from '../server/openai.js';

test('parseDjJson accepts fenced JSON', () => {
  const plan = parseDjJson('```json\n{"say":"晚上好","play":["a"],"mood":"平静"}\n```');
  assert.equal(plan.say, '晚上好');
  assert.deepEqual(plan.play, ['a']);
  assert.equal(plan.mood, '平静');
});

test('normalizePlan provides defaults', () => {
  const plan = normalizePlan({});
  assert.ok(plan.say.includes('十三哥的音乐之声'));
  assert.deepEqual(plan.play, []);
  assert.equal(plan.mood, '平静');
});
