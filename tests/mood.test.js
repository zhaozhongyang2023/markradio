import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMood, recommendMood, scoreTrackForMood } from '../server/mood.js';

test('normalizeMood keeps supported mood and falls back to 平静', () => {
  assert.equal(normalizeMood('愤怒'), '愤怒');
  assert.equal(normalizeMood('未知'), '平静');
});

test('recommendMood respects manual mood first', () => {
  const mood = recommendMood({
    currentMood: '欢乐',
    specialDates: [{ importance: 'high' }],
    hour: 23
  });
  assert.equal(mood, '欢乐');
});

test('scoreTrackForMood boosts matching mood and energy', () => {
  const calmTrack = { mood: ['平静'], energy: 0.26 };
  const angryTrack = { mood: ['愤怒'], energy: 0.84 };
  assert.ok(scoreTrackForMood(calmTrack, '平静') > scoreTrackForMood(angryTrack, '平静'));
});
