import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageIntent, parseLyric, trackMatchesLanguage } from '../server/music.js';

test('parseLyric keeps timed lrc lines', () => {
  const lyric = parseLyric('[00:01.50]hello\n[00:07.00]world');
  assert.deepEqual(lyric, [
    { time: 1.5, text: 'hello' },
    { time: 7, text: 'world' }
  ]);
});

test('parseLyric falls back to plain lyric lines', () => {
  const lyric = parseLyric('Ya no estas mas a mi lado\nEn el alma solo tengo soledad');
  assert.deepEqual(lyric, [
    { time: 0, text: 'Ya no estas mas a mi lado' },
    { time: 6, text: 'En el alma solo tengo soledad' }
  ]);
});

test('detectLanguageIntent detects English requests', () => {
  assert.equal(detectLanguageIntent('给我推荐几首英文歌'), 'english');
  assert.equal(detectLanguageIntent('play some classic English songs'), 'english');
});

test('trackMatchesLanguage infers English and Chinese tracks', () => {
  assert.equal(trackMatchesLanguage({ title: 'The Heart of The Matter', artist: 'Don Henley' }, 'english'), true);
  assert.equal(trackMatchesLanguage({ title: '夜曲', artist: '周杰伦' }, 'english'), false);
  assert.equal(trackMatchesLanguage({ title: '夜曲', artist: '周杰伦' }, 'chinese'), true);
});
