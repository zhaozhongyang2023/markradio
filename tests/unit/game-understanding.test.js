import test from 'node:test';
import assert from 'node:assert/strict';
import { getGameDNA, getVibeDNA, buildGameContext } from '../../server/game-understanding.js';

// ─── getGameDNA ───
test('getGameDNA matches known game 刺客信条·影', () => {
  const dna = getGameDNA('刺客信条·影');
  assert.ok(dna);
  assert.ok(dna.world.includes('战国日本'));
  assert.ok(dna.music.includes('和风暗色'));
});

test('getGameDNA matches known game 原神', () => {
  const dna = getGameDNA('原神');
  assert.ok(dna);
  assert.ok(dna.world.includes('开放世界'));
});

test('getGameDNA returns null for unknown game', () => {
  assert.equal(getGameDNA('不存在游戏XYZ'), null);
});

test('getGameDNA returns null for empty input', () => {
  assert.equal(getGameDNA(''), null);
  assert.equal(getGameDNA(null), null);
});

// ─── getVibeDNA ───
test('getVibeDNA matches known vibe 挂机', () => {
  const dna = getVibeDNA('挂机');
  assert.ok(dna);
  assert.ok(dna.music.includes('LoFi'));
});

test('getVibeDNA returns null for unknown vibe', () => {
  assert.equal(getVibeDNA('不知名操作'), null);
});

// ─── buildGameContext ───
test('buildGameContext returns structure for known game', () => {
  const ctx = buildGameContext('原神', '挂机');
  assert.ok(ctx);
  assert.equal(ctx.game_name, '原神');
  assert.ok(ctx.game_vibe);
});

test('buildGameContext with presetContext uses preset fields', () => {
  const ctx = buildGameContext('', '', {
    presetName: '刺客信条·影',
    sceneLabel: '忍影潜行',
    sceneVibe: '夜色压低',
    musicDirection: ['和风', '低频'],
    djPersona: '安静一点',
    sampleLines: ['灯火远一点']
  });
  assert.equal(ctx.game_name, '刺客信条·影');
  assert.equal(ctx.scene_label, '忍影潜行');
  assert.deepEqual(ctx.music_direction, ['和风', '低频']);
  assert.equal(ctx.dj_persona, '安静一点');
});
