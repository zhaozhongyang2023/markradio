import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StateStore } from '../../server/state.js';

function tempDbPath() {
  return path.join(os.tmpdir(), `moodwave-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function cleanup(dbPath) {
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  try { fs.unlinkSync(dbPath + '-shm'); } catch {}
}

// ─── 基础 CRUD ───
test('get/set basics', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    // seed 后 taste 应有值
    assert.ok(store.get('taste'), 'seed 后 taste 不应为 null');

    // set + get
    store.set('testKey', { hello: 'world', num: 42 });
    const val = store.get('testKey');
    assert.deepEqual(val, { hello: 'world', num: 42 });

    // 覆盖 set
    store.set('testKey', 'overwritten');
    assert.equal(store.get('testKey'), 'overwritten');

    // 不存在的 key 返回 null
    assert.equal(store.get('nonexistent'), null);

    // 复杂对象序列化
    store.set('complex', { nested: { arr: [1, 2, 3], bool: true, n: null } });
    assert.deepEqual(store.get('complex'), { nested: { arr: [1, 2, 3], bool: true, n: null } });
  } finally {
    cleanup(dbPath);
  }
});

// ─── 种子数据 ───
test('seed initializes default keys', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    assert.ok(store.get('taste'), 'taste 应已播种');
    assert.ok(store.get('mood'), 'mood 应已播种');
    assert.ok(store.get('voice'), 'voice 应已播种');
    assert.ok(store.get('specialDates'), 'specialDates 应已播种');
    assert.ok(store.get('tracks'), 'tracks 应已播种');
    assert.equal(store.get('planToday'), null, 'planToday 初始为 null');

    const mood = store.get('mood');
    assert.equal(mood.current, '平静');
    assert.ok(mood.updatedAt);
  } finally {
    cleanup(dbPath);
  }
});

// ─── 播放记录 ───
test('addPlay and recentPlays', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    const track = { id: 'test-1', title: '测试曲', artist: '测试歌手', mood: ['平静'], tags: ['lo-fi'] };
    store.addPlay(track, '平静');
    store.addPlay(track, '开心');

    const recent = store.recentPlays(5);
    assert.equal(recent.length, 2);
    assert.equal(recent[0].trackId, 'test-1');
    assert.equal(recent[0].mood, '开心');
    assert.equal(recent[1].trackId, 'test-1');
    assert.equal(recent[1].mood, '平静');
  } finally {
    cleanup(dbPath);
  }
});

test('recentPlays respects limit', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    for (let i = 0; i < 10; i++) {
      store.addPlay({ id: `t-${i}`, title: `Song ${i}`, artist: 'A', mood: ['平静'] }, '平静');
    }
    assert.equal(store.recentPlays(3).length, 3);
    assert.equal(store.recentPlays(20).length, 10);
  } finally {
    cleanup(dbPath);
  }
});

// ─── TTS 缓存 ───
test('TTS cache read/write', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    assert.equal(store.getTtsCache('no-such-hash'), undefined);

    store.putTtsCache({ hash: 'abc123', text: '晚上好', mood: '平静', filePath: '/tmp/tts-abc.mp3' });
    const cache = store.getTtsCache('abc123');
    assert.equal(cache.hash, 'abc123');
    assert.equal(cache.text, '晚上好');
    assert.equal(cache.mood, '平静');
    assert.equal(cache.path, '/tmp/tts-abc.mp3');
    assert.ok(cache.createdAt);

    store.putTtsCache({ hash: 'abc123', text: '晚安', mood: '治愈', filePath: '/tmp/tts-xyz.mp3' });
    const updated = store.getTtsCache('abc123');
    assert.equal(updated.text, '晚安');
    assert.equal(updated.mood, '治愈');
  } finally {
    cleanup(dbPath);
  }
});

// ─── 倾向记录 ───
test('tendency recording', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    assert.deepEqual(store.getTendency(), []);

    store.recordTendency(['lo-fi', '治愈']);
    store.recordTendency(['lo-fi', '电子']);
    const tendency = store.getTendency();
    assert.ok(tendency.length >= 1);
    const lofi = tendency.find(t => t.style === 'lo-fi');
    assert.ok(lofi, 'lo-fi 应在倾向列表中');
    assert.equal(lofi.weight, 2.0);
  } finally {
    cleanup(dbPath);
  }
});

test('tendency filters low weight', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    store.recordTendency(['rare-style']);
    const tendency = store.getTendency();
    const found = tendency.find(t => t.style === 'rare-style');
    assert.ok(found, '新记录的风格应在倾向中');
    assert.ok(found.weight >= 0.5);
  } finally {
    cleanup(dbPath);
  }
});

// ─── 持久化 ───
test('data persists across instances', () => {
  const dbPath = tempDbPath();
  try {
    const store1 = new StateStore(dbPath);
    store1.set('persistKey', { value: 42 });
    store1.addPlay({ id: 'p-1', title: '持久测试', artist: 'A', mood: ['平静'] }, '平静');
    store1.db.close();

    const store2 = new StateStore(dbPath);
    assert.deepEqual(store2.get('persistKey'), { value: 42 });
    const plays = store2.recentPlays(10);
    assert.ok(plays.length >= 1);
    assert.equal(plays[0].trackId, 'p-1');
    store2.db.close();
  } finally {
    cleanup(dbPath);
  }
});
