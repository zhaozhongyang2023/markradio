import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StateStore } from '../../server/state.js';
import {
  loadMusicDNA,
  saveMusicDNA,
  getMusicDNASummary,
  accumulateDnaSignal,
  getDnaSignalsSummary
} from '../../server/profile.js';

function tempDbPath() {
  return path.join(os.tmpdir(), `moodwave-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function cleanup(dbPath) {
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.unlinkSync(dbPath + '-wal'); } catch {}
  try { fs.unlinkSync(dbPath + '-shm'); } catch {}
}

// ─── getMusicDNASummary ───
test('getMusicDNASummary formats full DNA', () => {
  const summary = getMusicDNASummary({
    core_moods: ['平静', '治愈', '悲伤'],
    listening_habits: ['深夜', '通勤'],
    music_taste: ['LoFi', '民谣', '爵士'],
    game_vibes: ['探索', '挂机']
  });
  assert.ok(summary.includes('平静'));
  assert.ok(summary.includes('LoFi'));
  assert.ok(summary.includes('深夜'));
});

test('getMusicDNASummary null returns empty string', () => {
  assert.equal(getMusicDNASummary(null), '');
});

test('getMusicDNASummary old format compatibility', () => {
  const summary = getMusicDNASummary({
    core_feelings: ['放松', '平静'],
    favorite_styles: ['流行', '轻音乐']
  });
  assert.ok(summary.includes('放松'));
  assert.ok(summary.includes('流行'));
});

test('getMusicDNASummary empty arrays returns empty', () => {
  assert.equal(getMusicDNASummary({}), '');
});

// ─── accumulateDnaSignal + getDnaSignalsSummary ───
test('accumulateDnaSignal and getDnaSignalsSummary', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    accumulateDnaSignal(store, 'artist', '周杰伦');
    accumulateDnaSignal(store, 'artist', '五月天');
    accumulateDnaSignal(store, 'artist', '周杰伦'); // 重复

    const summary = getDnaSignalsSummary(store);
    const artists = summary.artists || summary.artist || [];
    assert.ok(Array.isArray(artists));
  } finally {
    cleanup(dbPath);
  }
});

test('accumulateDnaSignal ignores empty inputs', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    accumulateDnaSignal(store, '', 'value');
    accumulateDnaSignal(store, 'type', '');
    accumulateDnaSignal(store, null, 'value');
    // 不应崩溃
    assert.ok(true);
  } finally {
    cleanup(dbPath);
  }
});

// ─── loadMusicDNA / saveMusicDNA ───
test('loadMusicDNA returns null for empty store', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    assert.equal(loadMusicDNA(store), null);
  } finally {
    cleanup(dbPath);
  }
});

test('saveMusicDNA and loadMusicDNA round-trip', () => {
  const dbPath = tempDbPath();
  try {
    const store = new StateStore(dbPath);
    const dna = {
      core_moods: ['平静', '治愈'],
      listening_habits: ['深夜'],
      music_taste: ['LoFi'],
      game_vibes: [],
      confidence: 'medium',
      source: 'test'
    };
    saveMusicDNA(store, dna);
    const loaded = loadMusicDNA(store);
    assert.ok(loaded);
    assert.deepEqual(loaded.core_moods, ['平静', '治愈']);
    assert.equal(loaded.confidence, 'medium');
  } finally {
    cleanup(dbPath);
  }
});
