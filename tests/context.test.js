import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDjContext, buildMessages } from '../server/context.js';

test('buildDjContext includes chat userRequest', () => {
  const context = buildDjContext({
    taste: {},
    mood: '平静',
    specialDates: [],
    weather: {},
    recentPlays: [],
    tracks: [{ id: 'demo-1', title: 'If', artist: 'Bread', mood: ['平静'], energy: 0.4, reason: 'demo' }],
    nowPlaying: null,
    voice: { style: '温柔' },
    timeContext: { local: '05-15 星期五 21:11' },
    userRequest: '今晚想听安静一点的英文老歌'
  });

  assert.equal(context.userRequest, '今晚想听安静一点的英文老歌');
  assert.equal(context.languageIntent, 'english');
  assert.deepEqual(context.requestedSongs, []);
  assert.match(context.system, /userRequest/);
  assert.match(context.system, /english.*欧美/);

  const messages = buildMessages(context);
  assert.match(messages[1].content, /英文老歌/);
  assert.match(messages[1].content, /"languageIntent": "english"/);
});

test('buildDjContext includes requested song names', () => {
  const context = buildDjContext({
    taste: {},
    mood: '平静',
    specialDates: [],
    weather: {},
    recentPlays: [],
    tracks: [{ id: 'netease-1', title: '乌兰巴托的夜', artist: '谭维维', mood: ['平静'], energy: 0.4, reason: 'demo' }],
    nowPlaying: null,
    voice: { style: '温柔' },
    timeContext: { local: '05-16 星期六 09:10' },
    userRequest: '我想听：乌兰巴托的夜。这首歌'
  });

  assert.deepEqual(context.requestedSongs, ['乌兰巴托的夜']);
  assert.match(context.system, /requestedSongs/);

  const messages = buildMessages(context);
  assert.match(messages[1].content, /"requestedSongs": \[/);
  assert.match(messages[1].content, /乌兰巴托的夜/);
});

test('buildDjContext includes MoodWave Steam Deck DJ direction', () => {
  const context = buildDjContext({
    taste: {},
    mood: '治愈',
    specialDates: [],
    weather: {},
    recentPlays: [],
    tracks: [{ id: 'demo-1', title: 'If', artist: 'Bread', mood: ['治愈'], energy: 0.4, reason: 'demo' }],
    nowPlaying: null,
    voice: { style: '温柔' },
    timeContext: { local: '05-16 星期六 23:10' },
    userRequest: '适合 JRPG 夜晚探索'
  });

  assert.match(context.system, /MoodWave/);
  assert.match(context.system, /Steam Deck/);
  assert.match(context.system, /15~30/);
  assert.match(context.system, /禁止客服/);
});

// buildWorldContinuity 同一天不重复，不同天天气变化/不变正确生成
import { buildWorldContinuity } from '../server/scheduler.js';

test('buildWorldContinuity same day returns null', () => {
  const today = new Date().toISOString().slice(0, 10);
  const current = { condition: '阴', city: '北京' };
  const last = { condition: '阴', city: '北京', date: today };
  assert.equal(buildWorldContinuity(current, last), null);
});

test('buildWorldContinuity different day same weather returns hint', () => {
  const current = { condition: '阴', city: '北京' };
  const last = { condition: '阴', city: '北京', date: '2020-01-01' };
  const result = buildWorldContinuity(current, last);
  assert.ok(result);
  assert.match(result, /还是没放晴/);
});

test('buildWorldContinuity different day different weather returns hint', () => {
  const current = { condition: '晴', city: '北京' };
  const last = { condition: '阴', city: '北京', date: '2020-01-01' };
  const result = buildWorldContinuity(current, last);
  assert.ok(result);
  assert.match(result, /变成了晴/);
});

test('buildWorldContinuity null inputs return null', () => {
  assert.equal(buildWorldContinuity(null, {}), null);
  assert.equal(buildWorldContinuity({}, null), null);
  assert.equal(buildWorldContinuity({ condition: null }, { condition: '晴' }), null);
});
