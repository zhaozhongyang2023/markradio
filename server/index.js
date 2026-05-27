import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { StateStore } from './state.js';
import { playSequence, stop as playerStop, getPlayerState } from './player.js';
import { station } from './defaults.js';
import { moods, normalizeMood } from './mood.js';
import { parseLyric } from './music.js';
import { createRadioPlan } from './scheduler.js';
import { getSpecialDates } from './special-dates.js';
import { getVoicePublicConfig, synthesizeVoice, ttsFilePath, updateVoiceConfig } from './voice.js';
import { castManager, getCastStatus } from './cast.js';
import { buildCastUrl, resolveCastHost } from './cast-url.js';
import { callNetease, checkNeteaseQr, createNeteaseQr, getNeteaseLoginStatus } from './netease-auth.js';
import { getWeather } from './weather.js';
import { loadMusicDNA, saveMusicDNA, generateMusicDNA, getMusicDNASummary, accumulateDnaSignal, maybeRegenerateDna } from './profile.js';
import { collectNeteaseLibrary, getLikedSongs, isNeteaseSongLiked } from './providers/netease.js';
import { buildGameRadioRequest, createGameWhisper, deleteCommunityPreset, listGamePresets, reloadGamePresetCatalog, resolveGamePreset, saveCommunityPreset } from './game-presets.js';

const store = new StateStore();


// ─── Plugin helpers ───
function saveNowPerMode(store, now) {
  if (now?.mode) store.set('now-' + now.mode, now);
}

function buildPlaylist(track, plan, now) {
  if (!track || !plan) return [];
  const idx = (plan.queue || []).findIndex(t => t.id === track.id);
  if (idx < 0) return [track.url].filter(Boolean);
  // 主 DJ 开场白：仅队列第一首且未播过
  const mainTts = (idx === 0 && !now?.introPlayed && plan.tts?.ok && plan.tts.url)
    ? plan.tts.url : null;
  const cardTts = plan.cardTts?.[idx];
  const url = cardTts?.ok && cardTts.url ? cardTts.url : null;
  return [mainTts, url, track.url].filter(Boolean);
}

let _autoRegenerating = false;

async function advanceToNext(store) {
  const now = store.get('now') || {};
  const mode = now.mode || 'radio';
  const plan = store.get('plan-' + mode);
  if (!plan?.queue?.length) return;
  const ci = plan.queue.findIndex(t => t.id === now.track?.id);
  // 当前 track 不在 queue 中 → 从 queue[0] 重新开始
  if (ci < 0 && plan.queue.length > 0) {
    now.track = plan.queue[0]; now.progress = 0; now.playing = true; now.introPlayed = false; now.songActive = false;
    delete now.startedAt;
    store.set('now', now); saveNowPerMode(store, now);
    const urls2 = buildPlaylist(plan.queue[0], plan, now);
    if (urls2.length) playSequence(urls2, { onEnd: () => advanceToNext(store), onTrackStart: () => {
      const n2 = store.get('now'); if (n2) { n2.startedAt = Date.now(); n2.songActive = true; store.set('now', n2); broadcast('now', publicNow()); }
    } });
    broadcast('now', publicNow()); return;
  }
  if (ci >= plan.queue.length - 1) {
    if (plan.regenerate?.need && !_autoRegenerating) {
      _autoRegenerating = true;
      const hasGameRegenerate = Boolean(
        plan.regenerate.presetId ||
        plan.regenerate.gameName ||
        plan.regenerate.gameVibe ||
        plan.regenerate.gamePresetContext
      );
      const regenPreset = hasGameRegenerate && (plan.regenerate.presetId || plan.regenerate.gameName)
        ? resolveGamePreset({
            store,
            presetId: plan.regenerate.presetId || '',
            gameName: plan.regenerate.gameName || '',
            weather: store.get('weather'),
            now: new Date()
          })
        : null;
      const regenParams = {
        store,
        mode: plan.mode || mode,
        mood: plan.mood,
        userRequest: hasGameRegenerate
          ? buildGameRadioRequest({
              djPersona: regenPreset?.preset?.djPersona || '你不是 AI 助手。你是一名 Steam Deck 深夜 AI 游戏电台 DJ。语气温柔、简短、有留白、有陪伴感。不要像客服，不要解释算法，不要长篇大论。',
              gameName: plan.regenerate.gameName || '',
              gameVibe: regenPreset?.scene?.label || plan.regenerate.gameVibe || '',
              vibeHint: regenPreset?.scene?.vibe || ''
            })
          : (plan.regenerate.userRequest || ''),
        gameName: plan.regenerate.gameName || '',
        gameVibe: regenPreset?.scene?.label || plan.regenerate.gameVibe || '',
        gamePresetId: regenPreset?.preset?.id || '',
        gamePresetContext: regenPreset?.context || plan.regenerate.gamePresetContext || null,
        deferTts: true,
        autoContinue: true
      };
      createRadioPlan(regenParams)
        .then(() => {
          _autoRegenerating = false;
          const n = store.get('now');
          const p = store.get('plan-' + (plan.mode || mode));
          if (n && p && n.track && p.queue?.length) {
            n.playing = true;
            n.introPlayed = false; n.songActive = false;
            delete n.startedAt;
            store.set('now', n);
            const u = buildPlaylist(n.track, p, n);
            if (u.length) playSequence(u, { onEnd: () => advanceToNext(store), onTrackStart: () => {
              const sn = store.get('now');
              if (sn) { sn.startedAt = Date.now(); sn.songActive = true; store.set('now', sn); broadcast('now', publicNow()); }
            } });
          }
          broadcast('now', publicNow());
        })
        .catch(() => {
          _autoRegenerating = false;
          const freshNow = store.get('now');
          if (freshNow) { freshNow.playing = false; store.set('now', freshNow); }
          else { now.playing = false; store.set('now', now); }
          broadcast('now', publicNow());
        });
      return;
    }
    now.playing = false; store.set('now', now);
    saveNowPerMode(store, now); broadcast('now', publicNow()); return;
  }
  const next = plan.queue[ci + 1];
  now.track = next; now.progress = 0; now.playing = true; now.songActive = false;
  delete now.startedAt;
  store.set('now', now); saveNowPerMode(store, now);
  const urls = buildPlaylist(next, plan, now);
  if (urls.length) playSequence(urls, { onEnd: () => advanceToNext(store), onTrackStart: () => {
        const n = store.get('now');
        if (n) { n.startedAt = Date.now(); n.songActive = true; store.set('now', n); broadcast('now', publicNow()); }
      } });
  store.addPlay(next, now.mood);
  broadcast('now', publicNow());
}

async function applyPluginAction(action, body = {}) {
  const now = store.get('now') || {}; const mode = now.mode || 'radio';
  const plan = store.get('plan-' + mode) || {};
  if (action === 'play') {
    if (!now.track?.url) { saveNowPerMode(store, now); store.set('now', now); broadcast('now', publicNow()); return { ok: false, reason: 'no_track', now: publicNow().now }; }
    if (now.introPlayed) {
      // 恢复播放：无导语，保留进度
      now.playing = true; now.songActive = true;
      playerStop();
      if (!now.startedAt) now.startedAt = Date.now();
      saveNowPerMode(store, now); store.set('now', now);
      if (!body.noLocalPlayback) playSequence([now.track.url], { onEnd: () => advanceToNext(store), onTrackStart: () => {
        const n = store.get('now');
        if (n) { n.startedAt = Date.now(); n.songActive = true; store.set('now', n); }
      } });
      broadcast('now', publicNow()); return publicNow();
    }
    // 首次播放：含导语
    now.playing = true; now.songActive = false; delete now.startedAt; playerStop(); const u = buildPlaylist(now.track, plan, now); now.introPlayed = true;
    if (u.length && !body.noLocalPlayback) playSequence(u, { onEnd: () => advanceToNext(store), onTrackStart: () => {
      const n = store.get('now');
      if (n) { n.startedAt = Date.now(); n.songActive = true; store.set('now', n); broadcast('now', publicNow()); }
    } });
  }
  if (action === 'pause') { now.playing = false; playerStop(); }
  if ((action === 'next' || action === 'prev') && plan?.queue?.length) {
    const ci = plan.queue.findIndex(t => t.id === now.track?.id);
    const ni = action === 'prev' ? (ci > 0 ? ci - 1 : -1) : (ci >= 0 && ci < plan.queue.length - 1 ? ci + 1 : -1);
    if (ni < 0) { saveNowPerMode(store, now); store.set('now', now); broadcast('now', publicNow()); return { ok: false, reason: action === 'prev' ? 'first' : 'last', now: publicNow().now }; }
    now.track = plan.queue[ni]; now.progress = 0; now.playing = true; now.songActive = false; delete now.startedAt; store.addPlay(now.track, now.mood);
    playerStop(); const u = buildPlaylist(now.track, plan, now);
    if (u.length && !body.noLocalPlayback) playSequence(u, { onEnd: () => advanceToNext(store), onTrackStart: () => {
      const n = store.get('now');
      if (n) { n.startedAt = Date.now(); n.songActive = true; store.set('now', n); broadcast('now', publicNow()); }
    } });
  }
  saveNowPerMode(store, now); store.set('now', now); broadcast('now', publicNow()); return publicNow();
}
const app = Fastify({ logger: true });
const webApp = Fastify({ logger: true });
const clients = new Set();
const castCacheDir = path.resolve(process.cwd(), 'data', 'cast-cache');
const castMediaPort = Number(config.apiPort) + 1;
const CAST_HEARTBEAT_TTL_MS = 15 * 60 * 1000;
let castLeaseExpiresAt = 0;
let castLeaseTimer = null;

await app.register(websocket);

app.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  reply.header('Access-Control-Allow-Private-Network', 'true');
  if (request.method === 'OPTIONS') return reply.send();
});

function publicStation() {
  return {
    ...station,
    apiHost: config.host === '0.0.0.0' ? station.apiHost : config.host,
    apiPort: config.apiPort,
    webPort: config.webPort
  };
}

function publicNow() {
  const now = store.get('now') || { mode: 'radio' };
  const mode = now.mode || 'radio';
  const plan = store.get('plan-' + mode) || {};
  const duration = (now.track?.duration || 180) * 1000;
  const elapsed = now.startedAt ? Date.now() - now.startedAt : 0;
  const progressRatio = (now.playing && now.songActive) ? Math.min(0.99, elapsed / duration) : 0;
  return {
    now: { ...now, progressRatio }, plan,
    plans: { radio: store.get('plan-radio') || null, search: store.get('plan-search') || null, game: store.get('plan-game') || null },
    station: publicStation(),
    voice: getVoicePublicConfig(store),
    weather: store.get('weather') || null
  };
}


function broadcast(event, payload) {
  const data = JSON.stringify({ event, payload, at: new Date().toISOString() });
  for (const socket of clients) {
    if (socket.readyState === 1) socket.send(data);
  }
}

async function hydrateCurrentLyric() {
  const now = store.get('now');
  const track = now?.track;
  if (!track?.id || track.lyric?.length || track.source !== 'netease') return;
  if (_lyricHydrated.has(track.id)) return;
  const sourceId = track.sourceId || String(track.id).replace(/^netease-/, '');
  if (!sourceId) return;

  const data = await callNetease('lyric', { id: sourceId }, store).catch(() => null);
  const lyric = parseLyric(data?.lrc?.lyric || data?.klyric?.lyric || data?.tlyric?.lyric || '');
  if (!lyric.length) return;

  const nextTrack = { ...track, lyric };
  if (_lyricHydrated.size > 500) _lyricHydrated.clear();
  _lyricHydrated.add(track.id);
  store.set('now', { ...now, track: nextTrack });

  // 同步更新各模块 plan 中的同一首歌
  ['radio', 'search', 'game'].forEach((m) => {
    const p = store.get('plan-' + m);
    if (p?.queue?.length) {
      store.set('plan-' + m, {
        ...p,
        queue: p.queue.map((item) => (item.id === nextTrack.id ? { ...item, lyric } : item))
      });
    }
  });
  broadcast('now', publicNow());
}

function publicStatus() {
  const apiHost = config.host === '0.0.0.0' ? station.apiHost : config.host;
  return {
    app: {
      name: 'MoodWave',
      version: process.env.npm_package_version || '5.0.0',
      mode: config.appMode,
      legacyName: 'MarkRadio'
    },
    station: publicStation(),
    api: `http://${apiHost}:${config.apiPort}`,
    web: `http://${apiHost}:${config.webPort}`,
    ai: {
      provider: config.aiProvider,
      configured: Boolean(config.aiApiKey),
      model: config.aiModel,
      baseUrl: config.aiBaseUrl || 'default'
    },
    openai: { configured: Boolean(config.openaiApiKey), model: config.openaiModel },
    voice: getVoicePublicConfig(store),
    fishAudio: { configured: Boolean(config.fishApiKey && config.fishVoiceId) },
    weather: { configured: Boolean(config.openWeatherApiKey && config.openWeatherCity) },
    music: {
      mode: config.neteaseApiBase ? 'netease' : 'demo',
      localDirConfigured: Boolean(config.musicDir)
    },
    features: {
      tts: config.enableTts,
      weather: config.enableWeather,
      holiday: config.enableHoliday,
      location: config.enableLocation,
      steamDeck: config.appMode === 'steamdeck'
    },
    cast: getCastStatus()
  };
}

app.get('/api/health', async () => ({
  ok: true,
  name: 'MoodWave',
  mode: config.appMode,
  apiPort: config.apiPort,
  webPort: config.webPort,
  aiConfigured: Boolean(config.aiApiKey),
  musicMode: config.neteaseApiBase ? 'netease' : 'demo',
  at: new Date().toISOString()
}));

app.get('/api/status', async () => publicStatus());

app.get('/api/netease/status', async () => getNeteaseLoginStatus(store));

app.get('/api/netease/library', async () => {
  const auth = store.get('neteaseAuth');
  if (!auth?.cookie) return { likedCount: 0, playlistCount: 0, loggedIn: false };
  try {
    const lib = await collectNeteaseLibrary(store);
    return { ...lib, loggedIn: true };
  } catch {
    return { likedCount: 0, playlistCount: 0, loggedIn: true, error: true };
  }
});

app.get('/api/profile/music-dna', async () => ({
  dna: loadMusicDNA(store)
}));

app.post('/api/profile/music-dna/generate', async (request) => {
  const { preferences } = request.body || {};
  try {
    const dna = await generateMusicDNA(store, preferences || '');
    return { dna };
  } catch (error) {
    return { error: error.message };
  }
});

app.post('/api/profile/music-dna/save', async (request) => {
  const { dna } = request.body || {};
  if (!dna) return { error: 'missing dna' };
  saveMusicDNA(store, dna);
  return { ok: true, dna };
});

app.post('/api/profile/music-dna/reset', async () => {
  store.set('musicDna', null);
  return { ok: true };
});


app.get("/api/profile/music-dna/history", async () => {
  const history = store.get("musicDnaHistory") || [];
  return { history };
});
app.post('/api/netease/qr/create', async () => createNeteaseQr());

app.post('/api/netease/qr/check', async (request) => {
  const key = String(request.body?.key || '');
  if (!key) return { code: 400, message: 'missing key', loggedIn: false };
  return checkNeteaseQr(store, key);
});

app.get('/api/netease/liked', async (request, reply) => {
  const rawId = String(request.query?.id || '').trim();
  const id = rawId.replace(/^netease-/, '').trim();
  if (!/^\d+$/.test(id)) {
    return reply.code(400).send({ ok: false, message: '缺少有效的网易云歌曲 ID' });
  }

  const status = await getNeteaseLoginStatus(store).catch(() => ({ loggedIn: false }));
  if (!status.loggedIn) {
    return reply.code(401).send({ ok: false, message: '请先登录网易云音乐' });
  }

  const ids = await getLikedSongs(store);
  return { ok: true, liked: isNeteaseSongLiked(ids, id), trackId: `netease-${id}` };
});

app.post('/api/netease/like', async (request, reply) => {
  const status = await getNeteaseLoginStatus(store).catch(() => ({ loggedIn: false }));
  if (!status.loggedIn) {
    return reply.code(401).send({ ok: false, message: '请先登录网易云音乐' });
  }

  const track = request.body?.track || {};
  const id = String(track.sourceId || '').trim() || String(track.id || '').replace(/^netease-/, '').trim();
  const isNeteaseTrack = track.source === 'netease' || String(track.id || '').startsWith('netease-');
  if (!id || !isNeteaseTrack) {
    return reply.code(400).send({ ok: false, message: '当前歌曲不是网易云音乐来源，不能同步收藏' });
  }

  const like = request.body?.like !== false;
  const result = await callNetease('like', { id, like, timestamp: Date.now() }, store);
  if (result?.code && result.code !== 200) {
    return reply.code(502).send({ ok: false, message: result.message || '网易云收藏失败', result });
  }
  return { ok: true, liked: like, trackId: `netease-${id}`, result };
});

app.get('/api/now', async () => {
  // 异步拉取歌词，不阻塞响应
  hydrateCurrentLyric().catch(() => {});
  return publicNow();
});

app.get('/api/mood', async () => ({
  current: store.get('mood')?.current || '平静',
  moods
}));

app.put('/api/mood', async (request) => {
  const current = normalizeMood(request.body?.mood);
  const value = store.set('mood', { current, updatedAt: new Date().toISOString() });
  broadcast('mood', value);
  return { current, moods };
});

app.get('/api/taste', async () => store.get('taste'));

app.put('/api/taste', async (request) => {
  const current = store.get('taste') || {};
  const next = {
    taste: String(request.body?.taste ?? current.taste ?? ''),
    routines: String(request.body?.routines ?? current.routines ?? ''),
    moodRules: String(request.body?.moodRules ?? current.moodRules ?? '')
  };
  store.set('taste', next);
  return next;
});

app.get('/api/voice', async () => getVoicePublicConfig(store));

app.put('/api/voice', async (request) => updateVoiceConfig(store, request.body || {}));

app.post('/api/voice/preview', async (request) => {
  const text = String(request.body?.text || '这里是 MoodWave。今晚，我们慢慢听。');
  const mood = normalizeMood(request.body?.mood);
  const voice = store.get('voice') || {};
  return synthesizeVoice({ store, text, mood, voiceStyle: voice.style || '' }).catch((error) => ({
    ok: false,
    cached: false,
    url: null,
    message: error.message
  }));
});

app.get('/api/special-dates', async () => {
  const configDates = store.get('specialDates') || [];
  return {
    dates: configDates,
    today: getSpecialDates(new Date(), configDates)
  };
});

app.put('/api/special-dates', async (request) => {
  const dates = Array.isArray(request.body?.dates) ? request.body.dates : [];
  store.set('specialDates', dates);
  return {
    dates,
    today: getSpecialDates(new Date(), dates)
  };
});

app.get('/api/plan/today', async (request, reply) => {
  const cached = store.get('planToday');
  // Return cached plan if TTS is ready; otherwise regenerate with async TTS
  if (cached && cached.tts?.url && cached.queue?.[0]) return cached;
  playerStop();
  const plan = await createRadioPlan({ store, deferTts: true, onTtsReady: (updated) => {
    broadcast('plan', updated);
  } });
  return plan;
});

app.post('/api/plan/today', async (request) => {
  // 记录当前队列所有歌曲为已播，防止新计划重复推荐
  const oldPlan = store.get('planToday');
  if (oldPlan?.queue) {
    for (const t of oldPlan.queue) {
      if (t?.id) store.addPlay(t, oldPlan.mood || '平静');
    }
  }
  playerStop();
  const gameName = String(request.body?.gameName || request.body?.name || '').trim();
  const gameVibe = String(request.body?.gameVibe || request.body?.vibe || '').trim();
  const sceneId = String(request.body?.sceneId || '').trim();
  const presetId = String(request.body?.presetId || '').trim();
  const gameModeRequested = request.body?.mode === 'game' || Boolean(gameName || gameVibe || sceneId || presetId);
  const presetResult = gameModeRequested
    ? resolveGamePreset({
        store,
        presetId,
        gameName,
        weather: store.get('weather'),
        now: new Date(),
        sceneId,
        manual: Boolean(sceneId)
      })
    : null;
  const scene = presetResult?.scene;
  const resolvedGameVibe = scene?.label || gameVibe;
  const resolvedVibeHint = scene?.vibe || String(request.body?.vibeHint || '').trim();
  const djPersona = presetResult?.preset?.djPersona || '你不是 AI 助手。你是一名 Steam Deck 深夜 AI 游戏电台 DJ。语气温柔、简短、有留白、有陪伴感。不要像客服，不要解释算法，不要长篇大论。';
  const plan = await createRadioPlan({
    store,
    mode: gameModeRequested ? 'game' : 'radio',
    mood: request.body?.mood || scene?.mood || null,
    userRequest: gameModeRequested
      ? buildGameRadioRequest({
          djPersona,
          gameName,
          gameVibe: resolvedGameVibe,
          vibeHint: resolvedVibeHint
        })
      : '',
    gameName: gameModeRequested ? gameName : '',
    gameVibe: gameModeRequested ? resolvedGameVibe : '',
    gamePresetId: presetResult?.preset?.id || '',
    gamePresetContext: presetResult?.context || null,
    autoContinue: request.body?.autoContinue === true,
    deferTts: true,
    onTtsReady: (updatedPlan) => {
      broadcast('plan', updatedPlan);
      broadcast('now', publicNow());
    }
  });
  return plan;
});

app.post('/api/chat', async (request) => {
  const text = String(request.body?.message || '');
  const moodMatch = moods.find((item) => text.includes(item));
  const currentPlan = store.get('planToday');
  const previousNow = store.get('now');
  playerStop();
  const plan = await createRadioPlan({
    store,
    mood: moodMatch || store.get('mood')?.current,
    userRequest: text,
    currentPlan,
    deferTts: true,
    onTtsReady: (updatedPlan) => {
      broadcast('plan', updatedPlan);
      broadcast('now', publicNow());
    }
  });
  if (!plan.plan?.shouldSwitchNow && previousNow?.track?.id) {
    const preservedTrack = plan.queue?.find((track) => track.id === previousNow.track.id);
    if (preservedTrack) {
      store.set('now', {
        ...previousNow,
        track: preservedTrack,
        mood: plan.mood
      });
    }
  }
  const planMessage = buildPlanMessage(plan);
  broadcast('plan', plan);
  broadcast('now', publicNow());
  return {
    reply: plan.plan?.reply || `今晚按${plan.mood}，慢慢听。`,
    plan,
    planMessage
  };
});

function buildPlanMessage(plan) {
  return {
    type: 'plan',
    title: plan.plan?.planTitle || 'MoodWave 播出计划',
    summary: plan.plan?.planSummary || plan.plan?.reason || '',
    changes: plan.plan?.changes || [],
    queue: plan.queue || []
  };
}

async function applyPlaybackAction(action, body = {}) {
  const state = publicNow();
  const now = state.now;
  if (action === 'play') now.playing = true;
  if (action === 'pause') now.playing = false;
  if (action === 'seek') now.progress = Number(body?.progress || 0);
  if (action === 'select' && state.plan?.queue?.length) {
    const index = Number.isInteger(body?.index) ? body.index : -1;
    const trackId = String(body?.trackId || '');
    const nextTrack = index >= 0
      ? state.plan.queue[index]
      : state.plan.queue.find((track) => track.id === trackId);
    if (nextTrack) {
      now.track = nextTrack;
      now.progress = 0;
      now.playing = true;
      store.addPlay(now.track, now.mood);
    }
  }
  if (action === 'prev' && state.plan?.queue?.length) {
    const currentIndex = state.plan.queue.findIndex((track) => track.id === now.track?.id);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : -1;
    const previousTrack = state.plan.queue[previousIndex];
    if (previousTrack) {
      now.track = previousTrack;
      now.progress = 0;
      now.playing = true;
      store.addPlay(now.track, now.mood);
    }
  }
  if (action === 'next' && state.plan?.queue?.length) {
    const currentIndex = state.plan.queue.findIndex((track) => track.id === now.track?.id);
    if (currentIndex >= 0) {
      const nextIndex = currentIndex + 1;
      if (nextIndex < state.plan.queue.length) {
        now.track = state.plan.queue[nextIndex];
        now.progress = 0;
        now.playing = true;
        store.addPlay(now.track, now.mood);
      }
    }
  }
  store.set('now', now);
  broadcast('now', publicNow());
  return publicNow();
}

app.post('/api/playback/:action', async (request) => {
  return applyPlaybackAction(request.params.action, request.body || {});
});

app.post('/api/ai/radio', async (request) => {
  const mood = request.body?.mood || request.body?.currentMood || null;
  const userRequest = String(request.body?.scene || request.body?.prompt || '').trim();
  playerStop();
  const plan = await createRadioPlan({
    store,
    mood,
    userRequest,
    autoContinue: request.body?.autoContinue === true,
    deferTts: true,
    onTtsReady: (updatedPlan) => {
      broadcast('plan', updatedPlan);
      broadcast('now', publicNow());
    }
  });
  broadcast('plan', plan);
  broadcast('now', publicNow());
  // 信号记录 + 异步 DNA 检测
  if (mood) accumulateDnaSignal(store, 'mood', mood);
  maybeRegenerateDna(store);
  return {
    ok: true,
    dj_intro: plan.tts?.text || plan.plan?.say || '',
    songs: plan.queue || [],
    plan,
    now: publicNow().now
  };
});

app.post('/api/ai/search', async (request) => {
  const query = String(request.body?.query || request.body?.message || request.body?.prompt || '').trim();
  const currentPlan = store.get('plan-' + (store.get('now')?.mode || 'radio'));
  playerStop();
  const plan = await createRadioPlan({
    store,
    mood: request.body?.mood || store.get('mood')?.current,
    mode: 'search',
    userRequest: query,
    currentPlan,
    autoContinue: request.body?.autoContinue === true,
    deferTts: true,
    onTtsReady: (updatedPlan) => {
      broadcast('plan', updatedPlan);
      broadcast('now', publicNow());
    }
  });
  const planMessage = buildPlanMessage(plan);
  broadcast('plan', plan);
  broadcast('now', publicNow());
  // 信号记录 + 异步 DNA 检测
  if (query) accumulateDnaSignal(store, 'search', query);
  maybeRegenerateDna(store);
  return {
    ok: true,
    reply: plan.plan?.reply || '今晚适合慢一点。',
    dj_intro: plan.tts?.text || plan.plan?.say || '',
    songs: plan.queue || [],
    plan,
    planMessage,
    now: publicNow().now
  };
});

app.post('/api/ai/next-radio', async (request) => {
  const currentPlan = store.get('plan-' + (store.get('now')?.mode || 'radio'));
  const mood = request.body?.mood || currentPlan?.mood || store.get('mood')?.current;
  const scene = String(request.body?.scene || request.body?.prompt || '换个氛围').trim();
  playerStop();
  const plan = await createRadioPlan({
    mode: store.get('now')?.mode || 'radio',
    store,
    mood,
    userRequest: scene,
    currentPlan,
    autoContinue: request.body?.autoContinue === true,
    deferTts: true,
    onTtsReady: (updatedPlan) => {
      broadcast('plan', updatedPlan);
      broadcast('now', publicNow());
    }
  });
  broadcast('plan', plan);
  broadcast('now', publicNow());
  // 信号记录 + 异步 DNA 检测
  if (scene && scene !== '换个氛围') accumulateDnaSignal(store, 'search', scene);
  maybeRegenerateDna(store);
  return {
    ok: true,
    dj_intro: plan.tts?.text || plan.plan?.say || '',
    songs: plan.queue || [],
    plan,
    now: publicNow().now
  };
});

app.get('/api/game/preset', async (request) => {
  const gameName = String(request.query?.gameName || request.query?.name || '').trim();
  const presetId = String(request.query?.presetId || '').trim();
  return resolveGamePreset({
    store,
    presetId,
    gameName,
    weather: store.get('weather'),
    now: new Date(),
    preview: true
  });
});

app.get('/api/game/presets', async () => listGamePresets());

app.post('/api/game/presets', async (request, reply) => {
  try {
    const preset = request.body?.preset || request.body;
    const result = saveCommunityPreset(preset);
    return { ...result, catalog: listGamePresets() };
  } catch (error) {
    return reply.code(error.code === 'builtin_conflict' ? 409 : 400).send({
      ok: false,
      code: error.code || 'invalid_preset',
      message: error.message
    });
  }
});

app.delete('/api/game/presets/:id', async (request, reply) => {
  try {
    const result = deleteCommunityPreset(String(request.params.id || ''));
    return { ...result, catalog: listGamePresets() };
  } catch (error) {
    const status = error.code === 'not_found' ? 404 : error.code === 'builtin_delete_forbidden' ? 403 : 400;
    return reply.code(status).send({
      ok: false,
      code: error.code || 'delete_failed',
      message: error.message
    });
  }
});

app.post('/api/game/presets/reload', async () => reloadGamePresetCatalog());

app.post('/api/ai/game-whisper', async (request) => {
  const whisper = createGameWhisper({
    store,
    presetId: String(request.body?.presetId || '').trim(),
    gameName: String(request.body?.gameName || request.body?.name || '').trim(),
    gameVibe: String(request.body?.gameVibe || request.body?.vibe || '').trim(),
    sceneId: String(request.body?.sceneId || '').trim(),
    event: String(request.body?.event || 'default').trim(),
    weather: store.get('weather'),
    now: new Date(),
    recent: Array.isArray(request.body?.recent) ? request.body.recent : []
  });
  return whisper;
});

app.post('/api/ai/game-radio', async (request) => {
  const gameVibe = String(request.body?.gameVibe || request.body?.vibe || '').trim();
  const gameName = String(request.body?.gameName || request.body?.name || '').trim();
  const vibeHint = String(request.body?.vibeHint || '').trim();
  const sceneId = String(request.body?.sceneId || '').trim();
  const presetId = String(request.body?.presetId || '').trim();
  const presetResult = resolveGamePreset({
    store,
    presetId,
    gameName,
    weather: store.get('weather'),
    now: new Date(),
    sceneId,
    manual: Boolean(sceneId)
  });
  const scene = presetResult.scene;
  const resolvedGameVibe = scene?.label || gameVibe;
  const resolvedVibeHint = scene?.vibe || vibeHint;
  const mood = request.body?.mood || scene?.mood || store.get('mood')?.current;
  // 游戏电台 DJ 人格提示（通过 userRequest 传递，不修改 Prompt 系统）
  const djPersona = presetResult.preset?.djPersona || '你不是 AI 助手。你是一名 Steam Deck 深夜 AI 游戏电台 DJ。语气温柔、简短、有留白、有陪伴感。不要像客服，不要解释算法，不要长篇大论。';
  const userRequest = buildGameRadioRequest({
    djPersona,
    gameName,
    gameVibe: resolvedGameVibe,
    vibeHint: resolvedVibeHint
  });
  playerStop();
  const plan = await createRadioPlan({
    store,
    mode: 'game',
    mood,
    userRequest,
    gameName,
    gameVibe: resolvedGameVibe,
    gamePresetId: presetResult.preset?.id || '',
    gamePresetContext: presetResult.context,
    autoContinue: request.body?.autoContinue === true,
    deferTts: true,
    onTtsReady: (updatedPlan) => {
      broadcast('plan', updatedPlan);
      broadcast('now', publicNow());
    }
  });
  broadcast('plan', plan);
  broadcast('now', publicNow());
  // 信号记录 + 异步 DNA 检测
  if (resolvedGameVibe) {
    const gameSignal = gameName ? `${gameName}→${resolvedGameVibe}` : resolvedGameVibe;
    accumulateDnaSignal(store, "gameVibe", gameSignal);
  }
  maybeRegenerateDna(store);
  return {
    ok: true,
    gameVibe: resolvedGameVibe,
    gameName: gameName || null,
    preset: presetResult.preset,
    scene,
    autoSelected: presetResult.autoSelected,
    sceneLockedUntil: presetResult.sceneLockedUntil,
    dj_intro: plan.tts?.text || plan.plan?.say || '',
    songs: plan.queue || [],
    plan,
    now: publicNow().now
  };
});

app.get('/ws/stream', { websocket: true }, (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ event: 'now', payload: publicNow(), at: new Date().toISOString() }));
  socket.on('close', () => {
    clients.delete(socket);
    if (clients.size === 0 && castManager.getStatus().state !== 'idle') {
      clearCastLease();
      castManager.stop();
    }
  });
});

app.get('/tts/:hash.mp3', async (request, reply) => {
  const filePath = ttsFilePath(request.params.hash);
  if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'tts not found' });
  return reply.type('audio/mpeg').send(fs.createReadStream(filePath));
});

app.get('/api/cast/devices', async () => {
  const devices = await castManager.discover();
  return { devices };
});

app.post('/api/cast/connect', async (request, reply) => {
  const { host, port } = request.body || {};
  if (!host || !port) return reply.code(400).send({ ok: false, message: '缺少 host 或 port' });
  await castManager.connect(host, port);
  return castManager.getStatus();
});

function clearCastLease() {
  castLeaseExpiresAt = 0;
  if (castLeaseTimer) clearTimeout(castLeaseTimer);
  castLeaseTimer = null;
}

function armCastLease(ttlMs = CAST_HEARTBEAT_TTL_MS) {
  const safeTtlMs = Math.max(8000, Math.min(Number(ttlMs) || CAST_HEARTBEAT_TTL_MS, 60 * 60 * 1000));
  castLeaseExpiresAt = Date.now() + safeTtlMs;
  if (castLeaseTimer) return;
  const check = async () => {
    castLeaseTimer = null;
    if (!castLeaseExpiresAt) return;
    const delay = castLeaseExpiresAt - Date.now();
    if (delay > 0) {
      castLeaseTimer = setTimeout(check, delay);
      return;
    }
    clearCastLease();
    if (castManager.getStatus().state !== 'idle') {
      app.log.info('Cast heartbeat expired; stopping playback');
      try { castManager.stop(); } catch (_) {}
    }
  };
  castLeaseTimer = setTimeout(check, safeTtlMs);
}

app.post('/api/cast/play', async (request, reply) => {
  const { url, title, artist, album, leaseMs } = request.body || {};
  if (!url) return reply.code(400).send({ ok: false, message: '缺少音频 url' });
  const stableUrl = await prepareCastMediaUrl(url, { requestHost: request.headers.host }).catch((err) => {
    app.log.warn('Cast media cache skipped: ' + err.message);
    return url;
  });
  const castUrl = buildCastUrl(stableUrl, { requestHost: request.headers.host, apiPort: config.apiPort });
  await castManager.play(castUrl, { title, artist, album });
  armCastLease(leaseMs || CAST_HEARTBEAT_TTL_MS);
  return castManager.getStatus();
});

app.post('/api/cast/heartbeat', async (request) => {
  armCastLease(Number(request.body?.ttlMs || CAST_HEARTBEAT_TTL_MS));
  return { ...castManager.getStatus(), leaseExpiresAt: castLeaseExpiresAt };
});

app.post('/api/cast/:action', async (request) => {
  const action = request.params.action;
  if (action === 'pause') castManager.pause();
  else if (action === 'resume') castManager.resume();
  else if (action === 'stop') { clearCastLease(); castManager.stop(); }
  else if (action === 'volume') await castManager.setVolume(Number(request.body?.volume || 0));
  else if (action === 'disconnect') { clearCastLease(); castManager.disconnect(); }
  else return { ok: false, message: `未知 action: ${action}` };
  return castManager.getStatus();
});

function mediaIdFromUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const pathMatch = raw.match(/\/media\/audio\/([^/?#]+?)(?:\.mp3)?(?:[?#]|$)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]).replace(/\.mp3$/i, '');
  try {
    const parsed = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://localhost');
    const id = parsed.searchParams.get('id') || '';
    if (parsed.pathname === '/media/audio' && id) return id;
  } catch (_) {}
  return '';
}

function ttsHashFromUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const directMatch = raw.match(/\/tts\/([a-f0-9]{24})\.mp3(?:[?#]|$)/i);
  if (directMatch) return directMatch[1];
  try {
    const parsed = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://localhost');
    const match = parsed.pathname.match(/^\/tts\/([a-f0-9]{24})\.mp3$/i);
    return match ? match[1] : '';
  } catch (_) {
    return '';
  }
}

async function neteaseAudioUrl(id) {
  const data = await callNetease('song/url/v1', { id, level: 'standard' }, store).catch(() =>
    callNetease('song/url', { id }, store).catch(() => null)
  );
  return data?.data?.[0]?.url || '';
}

async function prepareCastMediaUrl(url = '', { requestHost = '' } = {}) {
  const ttsHash = ttsHashFromUrl(url);
  if (ttsHash) {
    await fs.promises.mkdir(castCacheDir, { recursive: true });
    const key = `tts-${ttsHash}`;
    const filePath = path.join(castCacheDir, `${key}.mp3`);
    const existing = await fs.promises.stat(filePath).catch(() => null);
    if (!existing?.size) await fs.promises.copyFile(ttsFilePath(ttsHash), filePath);
    return castMediaUrl(key, requestHost);
  }

  const id = mediaIdFromUrl(url);
  if (!/^\d+$/.test(id)) return url;
  await fs.promises.mkdir(castCacheDir, { recursive: true });
  const filePath = path.join(castCacheDir, `${id}.mp3`);
  const existing = await fs.promises.stat(filePath).catch(() => null);
  if (existing?.size > 1024) return castMediaUrl(id, requestHost);

  const target = await neteaseAudioUrl(id).catch(() => '');
  if (!/^https?:\/\//i.test(target)) throw new Error('invalid cast media url');
  const upstream = await fetch(target);
  if (!upstream.ok || !upstream.body) throw new Error(`media fetch failed: ${upstream.status}`);
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  await pipeline(Readable.fromWeb(upstream.body), fs.createWriteStream(tmpPath));
  await fs.promises.rename(tmpPath, filePath);
  return castMediaUrl(id, requestHost);
}

function castMediaUrl(id, requestHost = '') {
  const host = resolveCastHost(requestHost);
  return `http://${host}:${castMediaPort}/cast/${encodeURIComponent(id)}.mp3`;
}

function dlnaHeaders(size, { start = 0, end = size - 1, partial = false } = {}) {
  const dlnaFeatures = 'DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000';
  const headers = {
    'Content-Type': 'audio/mpeg',
    'transferMode.dlna.org': 'Streaming',
    'contentFeatures.dlna.org': dlnaFeatures,
    'Cache-Control': 'no-transform',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1)
  };
  if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  return headers;
}

async function sendCachedCastMedia(request, reply) {
  const id = String(request.params.fileName || '').replace(/\.mp3$/i, '');
  if (!/^(?:\d+|tts-[a-f0-9]{24})$/i.test(id)) return reply.code(404).send();
  const filePath = path.join(castCacheDir, `${id}.mp3`);
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat?.size) return reply.code(404).send();

  let start = 0;
  let end = stat.size - 1;
  let partial = false;
  const range = String(request.headers.range || '');
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    partial = true;
    start = match[1] ? Number(match[1]) : 0;
    end = match[2] ? Number(match[2]) : end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
      return reply.code(416).header('Content-Range', `bytes */${stat.size}`).send();
    }
    end = Math.min(end, stat.size - 1);
  }

  reply.code(partial ? 206 : 200);
  const headers = dlnaHeaders(stat.size, { start, end, partial });
  request.log.info({
    id,
    method: request.method,
    range: request.headers.range || '',
    remoteAddress: request.ip,
    start,
    end,
    size: stat.size,
    partial
  }, 'cast media request');
  if (request.method === 'HEAD') {
    reply.hijack();
    reply.raw.writeHead(partial ? 206 : 200, headers);
    reply.raw.end();
    return reply;
  }
  for (const [key, value] of Object.entries(headers)) reply.header(key, value);
  const stream = fs.createReadStream(filePath, { start, end });
  stream.on('close', () => {
    request.log.info({ id, remoteAddress: request.ip }, 'cast media stream closed');
  });
  stream.on('error', (err) => {
    request.log.warn({ id, remoteAddress: request.ip, err }, 'cast media stream error');
  });
  return reply.send(stream);
}

async function streamMediaAudio(request, reply, routeId = '') {
  const id = String(routeId || request.query?.id || '');
  let target = String(request.query?.url || '');
  if (id) {
    target = await neteaseAudioUrl(id).catch(() => '');
  }
  if (!/^https?:\/\//i.test(target)) return reply.code(400).send({ error: 'invalid media url' });
  const upstream = await fetch(target, {
    headers: request.headers.range ? { Range: request.headers.range } : {}
  });
  reply.code(upstream.status);
  const contentType = upstream.headers.get('content-type');
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  const acceptRanges = upstream.headers.get('accept-ranges');
  const dlnaFeatures = 'DLNA.ORG_PN=MP3;DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000';
  reply.header('Content-Type', id ? 'audio/mpeg' : contentType || 'audio/mpeg');
  reply.header('transferMode.dlna.org', 'Streaming');
  reply.header('contentFeatures.dlna.org', dlnaFeatures);
  reply.header('Cache-Control', 'no-transform');
  if (contentLength) reply.header('Content-Length', contentLength);
  if (contentRange) reply.header('Content-Range', contentRange);
  reply.header('Accept-Ranges', acceptRanges || 'bytes');
  return reply.send(Readable.fromWeb(upstream.body));
}

app.get('/media/audio', async (request, reply) => {
  return streamMediaAudio(request, reply);
});

app.get('/media/audio/:fileName', async (request, reply) => {
  const id = String(request.params.fileName || '').replace(/\.mp3$/i, '');
  return streamMediaAudio(request, reply, id);
});

app.get('/media/cast/:fileName', async (request, reply) => {
  return sendCachedCastMedia(request, reply);
});

function sendRawCastMedia(req, res) {
  const startedAt = Date.now();
  const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const match = parsed.pathname.match(/^\/cast\/(\d+|tts-[a-f0-9]{24})\.mp3$/i);
  if (!match || !['GET', 'HEAD'].includes(req.method || '')) {
    res.writeHead(404).end();
    return;
  }
  const id = match[1];
  const filePath = path.join(castCacheDir, `${id}.mp3`);
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat?.size) {
      res.writeHead(404).end();
      return;
    }

    let start = 0;
    let end = stat.size - 1;
    let partial = false;
    const range = String(req.headers.range || '');
    const rangeMatch = range.match(/^bytes=(\d*)-(\d*)$/);
    if (rangeMatch) {
      partial = true;
      start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
      end = rangeMatch[2] ? Number(rangeMatch[2]) : end;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
      }
      end = Math.min(end, stat.size - 1);
    }

    const headers = dlnaHeaders(stat.size, { start, end, partial });
    res.writeHead(partial ? 206 : 200, headers);
    app.log.info({
      id,
      method: req.method,
      range,
      remoteAddress: req.socket.remoteAddress,
      start,
      end,
      size: stat.size,
      partial
    }, 'raw cast media request');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('close', () => {
      app.log.info({
        id,
        remoteAddress: req.socket.remoteAddress,
        ms: Date.now() - startedAt
      }, 'raw cast media stream closed');
    });
    stream.on('error', (err) => {
      app.log.warn({ id, remoteAddress: req.socket.remoteAddress, err }, 'raw cast media stream error');
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  });
}

const distDir = path.resolve(process.cwd(), 'dist');
const switchCompanionSrcDir = path.resolve(process.cwd(), "switch-companion", "src");
if (fs.existsSync(distDir)) {
  webApp.post('/api/cast/stop', async () => {
    clearCastLease();
    castManager.stop();
    return castManager.getStatus();
  });

  await webApp.register(fastifyStatic, {
    root: distDir,
    prefix: '/'
  });
  webApp.get("/switch", async (_request, reply) => {
    return reply.sendFile("index.html", { root: switchCompanionSrcDir });
  });
  webApp.setNotFoundHandler((request, reply) => reply.sendFile('index.html'));
  await webApp.listen({ host: config.host, port: config.webPort });
} else {
  app.log.warn('dist directory not found; web server was not started');
}

const castMediaServer = http.createServer(sendRawCastMedia);
await new Promise((resolve) => {
  castMediaServer.listen(castMediaPort, config.host, resolve);
});
app.log.info(`Cast media server listening on ${castMediaPort}`);


// ─── Steam Deck Plugin Routes ───
app.post('/api/switch-mode', async (request) => {
  const { mode } = request.body || {};
  if (!mode || !['radio','search','game'].includes(mode)) return { ok: false };
  const now = store.get('now') || {};
  if (now.mode && now.mode !== mode) saveNowPerMode(store, now);
  playerStop();
  const saved = store.get('now-' + mode);
  now.mode = mode; now.track = saved?.track || null; now.playing = false; now.progress = 0;
  saveNowPerMode(store, now); store.set('now', now); broadcast('now', publicNow());
  return { ok: true, now: publicNow().now, plan: publicNow().plan };
});
app.post('/api/play', async (r) => applyPluginAction('play', r.body || {}));
app.post('/api/pause', async (r) => applyPluginAction('pause', r.body || {}));
app.post('/api/next', async (r) => applyPluginAction('next', r.body || {}));
app.post('/api/prev', async (r) => applyPluginAction('prev', r.body || {}));

// Switch 插件（同源访问，避免跨域）
app.get("/switch", async (_request, reply) => {
  reply.type("text/html; charset=utf-8");
  return fs.readFileSync(path.join(switchCompanionSrcDir, "index.html"), "utf8");
});

await app.listen({ host: config.host, port: config.apiPort });

// 启动时获取一次天气，确保极简视图立即可用
getWeather().then(w => store.set('weather', w)).catch(() => {});

// 启动后延迟检测 DNA 是否需要更新
setTimeout(() => maybeRegenerateDna(store), 10000);

// Warmup: generate initial plan in background so first page load is instant
setTimeout(async () => {
  try {
    const existingPlan = store.get('planToday');
    if (existingPlan) {
      broadcast('plan', existingPlan);
      return;
    }
    // Generate fresh plan with async TTS
    playerStop();
  const plan = await createRadioPlan({ store, deferTts: true, onTtsReady: (updated) => {
      broadcast('plan', updated);
    } });
    broadcast('plan', plan);
  } catch (e) {
    app.log.warn('Plan warmup failed: ' + e.message);
  }
}, 800);
