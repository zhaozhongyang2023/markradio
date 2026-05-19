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
  assert.match(context.system, /languageIntent 是 english/);

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
  assert.match(context.system, /requestedSongs 不为空/);

  const messages = buildMessages(context);
  assert.match(messages[1].content, /"requestedSongs": \[/);
  assert.match(messages[1].content, /乌兰巴托的夜/);
});

test('buildDjContext includes MoodWave DJ persona in system prompt', () => {
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
    userRequest: '适合 JRPG 夜晚探索',
    mode: 'game'
  });

  assert.match(context.system, /MoodWave/);
  assert.match(context.system, /AI DJ/);
  assert.match(context.system, /Steam Deck/);
  assert.match(context.system, /客服/);
  assert.match(context.system, /游戏电台/);
  assert.match(context.outputSchema.say, /游戏/);
});

test('buildDjContext radio mode includes radio-specific rules', () => {
  const context = buildDjContext({
    taste: {},
    mood: '开心',
    specialDates: [],
    weather: {},
    recentPlays: [],
    tracks: [{ id: 'demo-1', title: 'Test', artist: 'Artist', mood: ['开心'], energy: 0.5, reason: 'demo' }],
    nowPlaying: null,
    voice: { style: '温柔' },
    timeContext: { local: '05-16 星期六 12:00', period: '上午' },
    mode: 'radio'
  });

  assert.match(context.system, /进入状态/);
  assert.match(context.system, /电台模式/);
  assert.match(context.system, /适合长时间播放/);
  assert.ok(context.outputSchema.say);
  assert.equal(context.outputSchema.scene, undefined);
});

test('buildDjContext search mode includes scene in outputSchema', () => {
  const context = buildDjContext({
    taste: {},
    mood: '平静',
    specialDates: [],
    weather: {},
    recentPlays: [],
    tracks: [],
    nowPlaying: null,
    voice: {},
    timeContext: { local: '05-16 星期六 14:00', period: '下午' },
    userRequest: '适合下雨天发呆',
    mode: 'search'
  });

  assert.match(context.system, /寻歌模式/);
  assert.match(context.system, /不要解释关键词/);
  assert.ok(context.outputSchema.scene);
  assert.match(context.outputSchema.scene, /场景/);
});

test('buildDjContext includes neteaseTaste when provided', () => {
  const context = buildDjContext({
    taste: { taste: '喜欢安静的歌' },
    mood: '平静',
    specialDates: [],
    weather: {},
    recentPlays: [],
    tracks: [],
    nowPlaying: null,
    voice: {},
    timeContext: { local: '05-16 星期六 20:00', period: '夜晚' },
    neteaseTaste: {
      topArtists: ['周杰伦', '陈奕迅'],
      summary: '常听艺人：周杰伦、陈奕迅；偏好中文；中等能量。'
    }
  });

  assert.match(context.system, /喜欢安静的歌/);
  assert.match(context.system, /周杰伦/);
  assert.match(context.system, /网易云听歌数据/);
  assert.equal(context.userTaste.configured.taste, '喜欢安静的歌');
  assert.equal(context.userTaste.netease.topArtists[0], '周杰伦');
});
