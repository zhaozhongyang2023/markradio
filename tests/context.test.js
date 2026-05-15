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
  assert.match(context.system, /userRequest/);
  assert.match(context.system, /languageIntent 是 english/);

  const messages = buildMessages(context);
  assert.match(messages[1].content, /英文老歌/);
  assert.match(messages[1].content, /"languageIntent": "english"/);
});
