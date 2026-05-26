import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILTIN_PRESET_DIR = new URL('./presets/', import.meta.url);
const COMMUNITY_PRESET_DIR = path.resolve(process.cwd(), 'data', 'presets');
const AUTO_SCENE_HOLD_MS = 30 * 60 * 1000;
const MANUAL_SCENE_HOLD_MS = 60 * 60 * 1000;
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export const FALLBACK_GAME_SCENES = [
  { id: 'Boss战', label: 'Boss战', icon: '⚔', vibe: '今晚燃一点，按到底。', mood: '愤怒' },
  { id: '探索地图', label: '探索地图', icon: '⌖', vibe: '慢慢走，不急着赶路。', mood: '平静' },
  { id: '雨夜跑图', label: '雨夜跑图', icon: '🌙', vibe: '外面下雨，适合慢慢走。', mood: '治愈' },
  { id: '赛车竞速', label: '赛车竞速', icon: '🏎', vibe: '今晚速度别停。', mood: '开心' },
  { id: '种田放松', label: '种田放松', icon: '✧', vibe: '今晚别太累了。', mood: '治愈' },
  { id: '模拟器怀旧', label: '模拟器怀旧', icon: '▣', vibe: '像小时候一样。', mood: '平静' }
];

export function loadGamePresetCatalog(dirs = defaultPresetDirs()) {
  const list = Array.isArray(dirs) ? dirs : [dirs];
  const presets = [];
  const errors = [];
  for (const item of list) {
    const source = item?.source || 'community';
    const rawDir = item?.dir || item;
    const dirPath = rawDir instanceof URL ? fileURLToPath(rawDir) : path.resolve(String(rawDir));
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter((name) => name.endsWith('.json')).sort();
    for (const file of files) {
      const result = readPresetFile(path.join(dirPath, file), file, source);
      if (result.preset) presets.push(result.preset);
      if (result.error) errors.push(result.error);
    }
  }
  return { presets, errors };
}

export function loadGamePresets(dirs) {
  return loadGamePresetCatalog(dirs).presets;
}

export function listGamePresets() {
  const { presets, errors } = loadGamePresetCatalog();
  return {
    presets: presets.map(publicPresetSummary),
    errors
  };
}

export function reloadGamePresetCatalog() {
  return listGamePresets();
}

export function saveCommunityPreset(preset) {
  const normalized = validatePreset(preset, 'request body');
  const builtins = loadGamePresets([{ dir: BUILTIN_PRESET_DIR, source: 'builtin' }]);
  if (builtins.some((item) => item.id === normalized.id)) {
    throw codedError('builtin_conflict', '内置氛围包不能被社区包覆盖');
  }
  fs.mkdirSync(COMMUNITY_PRESET_DIR, { recursive: true });
  fs.writeFileSync(communityPresetPath(normalized.id), JSON.stringify(normalized, null, 2) + '\n');
  return { ok: true, preset: publicPresetSummary({ ...normalized, source: 'community' }) };
}

export function deleteCommunityPreset(id) {
  const safeId = assertSafePresetId(id);
  const builtins = loadGamePresets([{ dir: BUILTIN_PRESET_DIR, source: 'builtin' }]);
  if (builtins.some((item) => item.id === safeId)) {
    throw codedError('builtin_delete_forbidden', '内置氛围包不能删除');
  }
  const filePath = communityPresetPath(safeId);
  if (!fs.existsSync(filePath)) {
    throw codedError('not_found', '社区氛围包不存在');
  }
  fs.unlinkSync(filePath);
  return { ok: true };
}

export function findGamePresetById(presetId, presets = loadGamePresets()) {
  const id = String(presetId || '').trim();
  if (!id) return null;
  return presets.find((preset) => preset.id === id) || null;
}

export function findGamePreset(gameName, presets = loadGamePresets()) {
  return matchPresetByGameName(gameName, presets);
}

export function resolveGamePresetByIdOrName({ presetId = '', gameName = '' } = {}) {
  const presets = loadGamePresets();
  if (presetId) {
    const preset = findGamePresetById(presetId, presets);
    if (preset) return preset;
  }
  return matchPresetByGameName(gameName, presets);
}

export function resolveGamePreset({
  store = null,
  presetId = '',
  gameName = '',
  weather = null,
  now = new Date(),
  sceneId = '',
  manual = false,
  preview = false
} = {}) {
  const preset = resolveGamePresetByIdOrName({ presetId, gameName });
  const weatherKey = normalizeWeather(weather);
  const timeKey = resolveTimePeriod(now);

  if (!preset) {
    return {
      fallback: true,
      preset: null,
      scenes: FALLBACK_GAME_SCENES,
      scene: null,
      weatherKey,
      timeKey,
      autoSelected: false,
      sceneLockedUntil: null,
      context: null
    };
  }

  const scenes = normalizeScenes(preset);
  const state = store?.get?.('gameSceneState');
  const lockedScene = findLockedScene({ state, preset, gameName, scenes, now });
  const requestedScene = sceneId ? scenes.find((scene) => scene.id === sceneId) : null;
  const scene = requestedScene || (!manual && lockedScene) || selectBestScene({ preset, scenes, weatherKey, timeKey });
  const manualSelection = Boolean(requestedScene && (manual || sceneId));
  const autoSelected = !requestedScene && !lockedScene;
  const lockedUntil = now.getTime() + (manualSelection ? MANUAL_SCENE_HOLD_MS : AUTO_SCENE_HOLD_MS);

  if (!preview && store?.set && scene) {
    store.set('gameSceneState', {
      presetId: preset.id,
      gameName: gameName || preset.displayName,
      sceneId: scene.id,
      lockedUntil,
      manual: manualSelection,
      updatedAt: now.toISOString()
    });
  }

  return {
    fallback: false,
    preset: publicPreset(preset),
    scenes,
    scene,
    weatherKey,
    timeKey,
    autoSelected,
    sceneLockedUntil: scene ? lockedUntil : null,
    context: scene ? buildPresetContext({ preset, scene, weatherKey, timeKey }) : null
  };
}

export function buildGameRadioRequest({ djPersona, gameName, gameVibe, vibeHint } = {}) {
  const sceneLine = gameName
    ? `游戏场景——${gameVibe || '游戏电台'}。正在玩：${gameName}。`
    : `游戏场景——${gameVibe || '游戏电台'}。`;
  const vibeLine = vibeHint ? `感觉：${vibeHint}` : '';
  return [djPersona, sceneLine, vibeLine].filter(Boolean).join(' ');
}

export function normalizeWeather(weather) {
  const value = String(weather?.condition || weather?.summary || weather || '').toLowerCase();
  if (!value) return 'clear';
  if (/(snow|雪)/i.test(value)) return 'snow';
  if (/(rain|雨|drizzle|shower)/i.test(value)) return 'rain';
  if (/(fog|mist|haze|雾|霾)/i.test(value)) return 'fog';
  if (/(cloud|overcast|阴|云)/i.test(value)) return 'cloudy';
  return 'clear';
}

export function resolveTimePeriod(date = new Date()) {
  const hour = date instanceof Date ? date.getHours() : new Date(date).getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'noon';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export function validatePresetInput(preset) {
  return validatePreset(preset, 'request body');
}

export function summarizePreset(preset) {
  return publicPresetSummary(preset);
}

export function communityPresetPath(id) {
  const safeId = assertSafePresetId(id);
  return path.join(COMMUNITY_PRESET_DIR, `${safeId}.json`);
}

function defaultPresetDirs() {
  return [
    { dir: BUILTIN_PRESET_DIR, source: 'builtin' },
    { dir: COMMUNITY_PRESET_DIR, source: 'community' }
  ];
}

function validatePreset(preset, file) {
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
    throw codedError('invalid_preset', `invalid preset ${file}: must be an object`);
  }
  const id = assertSafePresetId(preset.id);
  if (!preset.displayName) throw codedError('missing_display_name', `invalid preset ${file}: missing displayName`);
  if (!Array.isArray(preset.scenes) || !preset.scenes.length) {
    throw codedError('missing_scenes', `invalid preset ${file}: missing scenes`);
  }
  const scenes = preset.scenes.map((scene, index) => {
    if (!scene?.id || !scene.label) {
      throw codedError('invalid_scene', `invalid preset ${file}: scene ${index + 1} missing id/label`);
    }
    return { ...scene, id: String(scene.id), label: String(scene.label) };
  });
  return {
    ...preset,
    id,
    displayName: String(preset.displayName),
    gameNames: Array.isArray(preset.gameNames) ? preset.gameNames.map(String) : [],
    world: Array.isArray(preset.world) ? preset.world.map(String) : [],
    musicDirection: Array.isArray(preset.musicDirection) ? preset.musicDirection.map(String) : [],
    scenes
  };
}

function readPresetFile(fullPath, file, source) {
  try {
    const preset = validatePreset(JSON.parse(fs.readFileSync(fullPath, 'utf8')), file);
    return { preset: { ...preset, source }, error: null };
  } catch (error) {
    console.warn(`[MoodWave] skip invalid game preset ${file}: ${error.message}`);
    return {
      preset: null,
      error: {
        file,
        source,
        message: error.message,
        code: error.code || 'invalid_preset'
      }
    };
  }
}

function assertSafePresetId(id) {
  const value = String(id || '').trim();
  if (!PRESET_ID_PATTERN.test(value)) {
    throw codedError('invalid_id', '氛围包 id 只能包含小写字母、数字、点、下划线和短横线，长度 2-64');
  }
  return value;
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[·'’"“”\s:_\-—–：；]/g, '')
    .trim();
}

function rankSource(source) {
  return source === 'community' ? 2 : 1;
}

function matchPresetByGameName(gameName, presets) {
  const input = normalizeName(gameName);
  if (!input) return null;
  let best = null;
  let bestScore = 0;
  let bestSourceRank = 0;
  for (const preset of presets) {
    const aliases = [preset.displayName, preset.id, ...(preset.gameNames || [])].filter(Boolean);
    for (const alias of aliases) {
      const key = normalizeName(alias);
      if (!key) continue;
      const score = input === key ? 100 : (input.includes(key) || key.includes(input) ? 80 : 0);
      const sourceRank = rankSource(preset.source);
      if (score > 0 && (score > bestScore || (score === bestScore && sourceRank > bestSourceRank))) {
        best = preset;
        bestScore = score;
        bestSourceRank = sourceRank;
      }
    }
  }
  return best;
}

function normalizeScenes(preset) {
  return (preset.scenes || []).map((scene) => ({
    id: String(scene.id),
    label: String(scene.label),
    icon: scene.icon ? String(scene.icon) : '▣',
    mood: scene.mood || '平静',
    vibe: scene.vibe || '',
    musicDirection: Array.isArray(scene.musicDirection) ? scene.musicDirection : [],
    weather: Array.isArray(scene.weather) ? scene.weather : [],
    time: Array.isArray(scene.time) ? scene.time : [],
    sampleLines: Array.isArray(scene.sampleLines) ? scene.sampleLines : []
  }));
}

function selectBestScene({ preset, scenes, weatherKey, timeKey }) {
  const defaultSceneId = preset.defaultScene || scenes[0]?.id;
  let best = scenes[0] || null;
  let bestScore = -1;
  for (const scene of scenes) {
    const score = scoreScene(scene, { defaultSceneId, weatherKey, timeKey });
    if (score > bestScore) {
      best = scene;
      bestScore = score;
    }
  }
  return best;
}

function scoreScene(scene, { defaultSceneId, weatherKey, timeKey }) {
  let score = scene.id === defaultSceneId ? 10 : 0;
  if (scene.weather?.includes(weatherKey)) score += 50;
  if (scene.time?.includes(timeKey)) score += 30;
  return score;
}

function findLockedScene({ state, preset, gameName, scenes, now }) {
  if (!state?.sceneId || !state.lockedUntil) return null;
  if (Number(state.lockedUntil) <= now.getTime()) return null;
  const samePreset = state.presetId === preset.id;
  const sameGame = normalizeName(state.gameName) === normalizeName(gameName || preset.displayName);
  if (!samePreset && !sameGame) return null;
  return scenes.find((scene) => scene.id === state.sceneId) || null;
}

function publicPreset(preset) {
  return {
    id: preset.id,
    displayName: preset.displayName,
    source: preset.source || 'community',
    gameNames: preset.gameNames || [],
    world: preset.world || [],
    djPersona: preset.djPersona || '',
    musicDirection: preset.musicDirection || [],
    defaultScene: preset.defaultScene || ''
  };
}

function publicPresetSummary(preset) {
  return {
    id: preset.id,
    displayName: preset.displayName,
    source: preset.source || 'community',
    gameNames: preset.gameNames || [],
    world: preset.world || [],
    sceneCount: Array.isArray(preset.scenes) ? preset.scenes.length : 0,
    defaultScene: preset.defaultScene || ''
  };
}

function buildPresetContext({ preset, scene, weatherKey, timeKey }) {
  return {
    presetId: preset.id,
    presetName: preset.displayName,
    gameWorld: preset.world || [],
    djPersona: preset.djPersona || '',
    sceneId: scene.id,
    sceneLabel: scene.label,
    sceneVibe: scene.vibe,
    musicDirection: scene.musicDirection?.length ? scene.musicDirection : (preset.musicDirection || []),
    matchedWeather: weatherKey,
    matchedTime: timeKey,
    sampleLines: scene.sampleLines || []
  };
}
