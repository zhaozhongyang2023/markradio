import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageIntent, extractRequestedSongs, normalizeNeteaseResponse, parseLyric, trackMatchesLanguage, trackMatchesRequestedTitle, buildDemoQueue, applyDnaWeight, sortByDnaWeight } from '../../server/music.js';

test('parseLyric keeps timed lrc lines', () => {
  const lyric = parseLyric('[00:01.50]hello\n[00:07.00]world');
  assert.deepEqual(lyric, [
    { time: 1.5, text: 'hello', synced: true },
    { time: 7, text: 'world', synced: true }
  ]);
});

test('parseLyric falls back to plain lyric lines', () => {
  const lyric = parseLyric('Ya no estas mas a mi lado\nEn el alma solo tengo soledad');
  assert.deepEqual(lyric, [
    { time: 0, text: 'Ya no estas mas a mi lado', synced: false },
    { time: 6, text: 'En el alma solo tengo soledad', synced: false }
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

test('extractRequestedSongs detects named songs', () => {
  assert.deepEqual(extractRequestedSongs('我想听：乌兰巴托的夜。这首歌'), ['乌兰巴托的夜']);
  assert.deepEqual(extractRequestedSongs('播放《上海滩》'), ['上海滩']);
  assert.deepEqual(extractRequestedSongs('想听英文歌'), []);
});

test('trackMatchesRequestedTitle matches live or versioned titles', () => {
  assert.equal(trackMatchesRequestedTitle({ title: '乌兰巴托的夜 (Live)' }, '乌兰巴托的夜'), true);
  assert.equal(trackMatchesRequestedTitle({ title: '上海滩' }, '上海滩'), true);
  assert.equal(trackMatchesRequestedTitle({ title: '夜曲' }, '上海滩'), false);
});

test('normalizeNeteaseResponse accepts cloudsearch result songs', () => {
  const tracks = normalizeNeteaseResponse({
    result: {
      songs: [{
        id: 2080477031,
        name: '乌兰巴托的夜',
        ar: [{ name: '谭维维' }],
        al: { name: '热门华语', picUrl: 'https://p1.music.126.net/cover.jpg' },
        dt: 240000
      }]
    }
  }, '平静', '网易云搜索：乌兰巴托的夜');

  assert.equal(tracks[0].id, 'netease-2080477031');
  assert.equal(tracks[0].title, '乌兰巴托的夜');
  assert.equal(tracks[0].artist, '谭维维');
  assert.equal(tracks[0].coverUrl, 'https://p1.music.126.net/cover.jpg');
});

// ─── buildDemoQueue ───
test('buildDemoQueue returns tracks up to limit', () => {
  const tracks = Array.from({ length: 10 }, (_, i) => ({ id: `t-${i}`, title: `Track ${i}` }));
  const queue = buildDemoQueue(tracks, 3);
  assert.equal(queue.length, 3);
  assert.equal(queue[0].queueIndex, 0);
  assert.equal(queue[2].queueIndex, 2);
});

test('buildDemoQueue caps at available tracks', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }];
  const queue = buildDemoQueue(tracks, 5);
  assert.equal(queue.length, 2);
});

// ─── applyDnaWeight ───
test('applyDnaWeight boosts matching tracks', () => {
  const candidates = [
    { title: 'LoFi Rain', artist: 'Chill', album: 'Night' },
    { title: '重金属狂暴', artist: 'Rock', album: 'Fire' }
  ];
  const dna = { music_taste: ['LoFi', 'chill'] };
  const weighted = applyDnaWeight(candidates, dna);
  assert.ok(weighted[0].dnaScore > weighted[1].dnaScore, 'LoFi 曲目应得分更高');
});

test('applyDnaWeight returns unchanged for empty dna', () => {
  const candidates = [{ title: 'A' }, { title: 'B' }];
  const result = applyDnaWeight(candidates, {});
  assert.equal(result.length, 2);
  assert.equal(result[0].dnaScore, undefined);
});

// ─── sortByDnaWeight ───
test('sortByDnaWeight orders by dnaScore descending', () => {
  const tracks = [
    { id: 'a', dnaScore: 0.2 },
    { id: 'b', dnaScore: 0.8 },
    { id: 'c', dnaScore: 0.5 }
  ];
  const sorted = sortByDnaWeight(tracks);
  assert.equal(sorted[0].id, 'b');
  assert.equal(sorted[1].id, 'c');
  assert.equal(sorted[2].id, 'a');
});
