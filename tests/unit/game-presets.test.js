import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildGameRadioRequest,
  deleteCommunityPreset,
  findGamePreset,
  findGamePresetById,
  listGamePresets,
  loadGamePresets,
  normalizeWeather,
  resolveGamePreset,
  resolveGamePresetByIdOrName,
  resolveTimePeriod,
  saveCommunityPreset,
  validatePresetInput
} from '../../server/game-presets.js';

function memoryStore() {
  const data = new Map();
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return value;
    }
  };
}

test('findGamePreset matches Assassin Creed Shadows aliases', () => {
  const preset = findGamePreset('刺客信条·影');
  assert.equal(preset?.id, 'assassins-creed-shadows');

  const english = findGamePreset('Assassins Creed Shadows');
  assert.equal(english?.displayName, '刺客信条·影');
});

test('normalizeWeather maps weather into preset keys', () => {
  assert.equal(normalizeWeather({ condition: '小雨' }), 'rain');
  assert.equal(normalizeWeather({ condition: '多云' }), 'cloudy');
  assert.equal(normalizeWeather({ condition: '雾' }), 'fog');
  assert.equal(normalizeWeather({ condition: '晴' }), 'clear');
});

test('resolveTimePeriod maps day phases', () => {
  assert.equal(resolveTimePeriod(new Date(2026, 4, 25, 8)), 'morning');
  assert.equal(resolveTimePeriod(new Date(2026, 4, 25, 12)), 'noon');
  assert.equal(resolveTimePeriod(new Date(2026, 4, 25, 15)), 'afternoon');
  assert.equal(resolveTimePeriod(new Date(2026, 4, 25, 20)), 'evening');
  assert.equal(resolveTimePeriod(new Date(2026, 4, 25, 23)), 'night');
});

test('resolveGamePreset selects rain night scene and writes lock', () => {
  const store = memoryStore();
  const result = resolveGamePreset({
    store,
    gameName: '刺客信条影',
    weather: { condition: '雨' },
    now: new Date(2026, 4, 25, 21)
  });

  assert.equal(result.fallback, false);
  assert.equal(result.preset?.id, 'assassins-creed-shadows');
  assert.equal(result.scene?.id, 'shinobi-night');
  assert.equal(store.get('gameSceneState')?.sceneId, 'shinobi-night');
  assert.equal(result.context?.presetName, '刺客信条·影');
});

test('manual scene keeps 60 minute lock', () => {
  const store = memoryStore();
  const now = new Date(2026, 4, 25, 15);
  const first = resolveGamePreset({
    store,
    gameName: '刺客信条·影',
    weather: { condition: '晴' },
    now,
    sceneId: 'samurai-duel',
    manual: true
  });
  const state = store.get('gameSceneState');

  assert.equal(first.scene?.id, 'samurai-duel');
  assert.ok(state.lockedUntil - now.getTime() >= 59 * 60 * 1000);

  const second = resolveGamePreset({
    store,
    gameName: '刺客信条·影',
    weather: { condition: '雨' },
    now: new Date(now.getTime() + 10 * 60 * 1000)
  });

  assert.equal(second.scene?.id, 'samurai-duel');
});

test('unknown game returns fallback scenes', () => {
  const result = resolveGamePreset({ gameName: '未知游戏' });
  assert.equal(result.fallback, true);
  assert.equal(result.preset, null);
  assert.ok(result.scenes.length >= 3);
});

test('loadGamePresets skips invalid files and keeps valid presets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moodwave-presets-'));
  fs.writeFileSync(path.join(dir, 'bad.json'), '{bad json');
  fs.writeFileSync(path.join(dir, 'good.json'), JSON.stringify({
    id: 'good-game',
    displayName: 'Good Game',
    scenes: [{ id: 'default', label: 'Default' }]
  }));

  const presets = loadGamePresets(dir);
  assert.equal(presets.length, 1);
  assert.equal(presets[0].id, 'good-game');
});

test('listGamePresets includes builtin source', () => {
  const catalog = listGamePresets();
  const preset = catalog.presets.find((item) => item.id === 'assassins-creed-shadows');
  assert.equal(preset?.source, 'builtin');
  assert.ok(preset?.sceneCount >= 1);
});

test('presetId resolves before gameName', () => {
  const result = resolveGamePreset({
    presetId: 'assassins-creed-shadows',
    gameName: '完全不匹配的游戏'
  });
  assert.equal(result.fallback, false);
  assert.equal(result.preset?.id, 'assassins-creed-shadows');
});

test('invalid presetId falls back to gameName matching', () => {
  const preset = resolveGamePresetByIdOrName({
    presetId: 'missing-preset',
    gameName: '刺客信条·影'
  });

  assert.equal(preset?.id, 'assassins-creed-shadows');
});

test('invalid presetId alone returns fallback without leaking id', () => {
  const result = resolveGamePreset({ presetId: 'missing-preset' });

  assert.equal(result.fallback, true);
  assert.equal(result.preset, null);
  assert.equal(result.context, null);
});

test('presetId resolves without gameName for auto continuation', () => {
  const result = resolveGamePreset({
    presetId: 'assassins-creed-shadows',
    now: new Date(2026, 4, 25, 21)
  });

  assert.equal(result.fallback, false);
  assert.equal(result.preset?.id, 'assassins-creed-shadows');
  assert.ok(result.context?.presetId);
});

test('validatePresetInput rejects missing and unsafe fields', () => {
  assert.throws(() => validatePresetInput({ id: '../bad', displayName: 'Bad', scenes: [{ id: 'a', label: 'A' }] }), /id/);
  assert.throws(() => validatePresetInput({ id: 'ok-id', scenes: [{ id: 'a', label: 'A' }] }), /displayName/);
  assert.throws(() => validatePresetInput({ id: 'ok-id', displayName: 'OK', scenes: [] }), /scenes/);
  assert.throws(() => validatePresetInput({ id: 'ok-id', displayName: 'OK', scenes: [{ id: 'a' }] }), /id\/label/);
});

test('community preset cannot overwrite builtin and builtin cannot be deleted', () => {
  assert.throws(() => saveCommunityPreset({
    id: 'assassins-creed-shadows',
    displayName: 'Overwrite',
    scenes: [{ id: 'default', label: 'Default' }]
  }), /内置/);
  assert.throws(() => deleteCommunityPreset('assassins-creed-shadows'), /内置/);
});

test('findGamePresetById returns builtin preset', () => {
  const preset = findGamePresetById('assassins-creed-shadows');
  assert.equal(preset?.displayName, '刺客信条·影');
});

test('buildGameRadioRequest reflects current scene only', () => {
  const text = buildGameRadioRequest({
    djPersona: '安静一点。',
    gameName: '刺客信条·影',
    gameVibe: '雨中城下町',
    vibeHint: '雨落在瓦上，慢慢走。'
  });

  assert.match(text, /雨中城下町/);
  assert.match(text, /雨落在瓦上/);
  assert.doesNotMatch(text, /忍影潜行/);
});

test('findGamePreset matches fullwidth colon variant', () => {
  const preset = findGamePreset('刺客信条：影');
  assert.equal(preset?.id, 'assassins-creed-shadows');
});

test('findGamePreset matches fullwidth semicolon variant', () => {
  const preset = findGamePreset('刺客信条；影');
  assert.equal(preset?.id, 'assassins-creed-shadows');
});
