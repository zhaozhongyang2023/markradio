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
