import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLyric } from '../server/music.js';

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
