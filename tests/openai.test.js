import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPlan, normalizePlan, parseDjJson } from '../server/openai.js';

test('parseDjJson accepts fenced JSON', () => {
  const plan = parseDjJson('```json\n{"reply":"收到","say":"晚上好","play":[{"id":"a","reason":"适合今晚"}],"mood":"平静"}\n```');
  assert.equal(plan.reply, '收到');
  assert.equal(plan.say, '晚上好');
  assert.deepEqual(plan.play, ['a']);
  assert.equal(plan.trackReasons.a, '适合今晚');
  assert.equal(plan.mood, '平静');
});

test('normalizePlan provides defaults', () => {
  const plan = normalizePlan({});
  assert.ok(plan.reply.includes('今晚'));
  assert.ok(plan.say.includes('夜色缓缓铺开'));
  assert.deepEqual(plan.play, []);
  assert.equal(plan.mood, '平静');
});

test('demoPlan uses MoodWave DJ style copy', () => {
  const tracks = [{ id: 'track-1', title: 'Song 1', artist: 'Artist' }];
  const plan = demoPlan(tracks, '治愈');
  assert.match(plan.reply, /今晚/);
  assert.match(plan.say, /安静|开始/);
  assert.doesNotMatch(plan.reply + plan.say, /推荐系统|计算完成|正在分析/);
});

test('demoPlan can provide five tracks for V4 plan panel', () => {
  const tracks = Array.from({ length: 6 }, (_, index) => ({
    id: `track-${index + 1}`,
    title: `Song ${index + 1}`,
    artist: 'Artist'
  }));
  const plan = demoPlan(tracks, '平静');
  assert.deepEqual(plan.play, ['track-1', 'track-2', 'track-3', 'track-4', 'track-5']);
});

test('normalizePlan keeps AI-selected variable length plan', () => {
  const plan = normalizePlan({
    intent: 'adjust',
    planTitle: '下午播出计划',
    planSummary: '从民谣慢慢过渡到爵士。',
    changes: ['保留当前歌', '后半段加入爵士'],
    shouldSwitchNow: true,
    play: Array.from({ length: 10 }, (_, index) => ({ id: `track-${index + 1}`, reason: `reason-${index + 1}` }))
  });
  assert.equal(plan.intent, 'adjust');
  assert.equal(plan.planTitle, '下午播出计划');
  assert.equal(plan.planSummary, '从民谣慢慢过渡到爵士。');
  assert.deepEqual(plan.changes, ['保留当前歌', '后半段加入爵士']);
  assert.equal(plan.shouldSwitchNow, true);
  assert.equal(plan.play.length, 10);
  assert.equal(plan.trackReasons['track-10'], 'reason-10');
});
