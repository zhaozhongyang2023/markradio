import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { StateStore } from './state.js';
import { station } from './defaults.js';
import { moods, normalizeMood } from './mood.js';
import { createRadioPlan } from './scheduler.js';
import { getSpecialDates } from './special-dates.js';
import { getVoicePublicConfig, synthesizeVoice, ttsFilePath, updateVoiceConfig } from './voice.js';
import { castManager, getCastStatus } from './cast.js';
import { callNetease, checkNeteaseQr, createNeteaseQr, getNeteaseLoginStatus } from './netease-auth.js';

const store = new StateStore();
const app = Fastify({ logger: true });
const webApp = Fastify({ logger: true });
const clients = new Set();

await app.register(websocket);

app.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin || config.webOrigin;
  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  reply.header('Access-Control-Allow-Private-Network', 'true');
  if (request.method === 'OPTIONS') return reply.send();
});

function publicNow() {
  const now = store.get('now');
  const plan = store.get('planToday');
  return {
    station,
    now: now || {
      track: plan?.queue?.[0] || null,
      progress: 0,
      playing: false,
      speaking: false,
      mood: store.get('mood')?.current || '平静'
    },
    plan,
    cast: getCastStatus()
  };
}

function broadcast(event, payload) {
  const data = JSON.stringify({ event, payload, at: new Date().toISOString() });
  for (const socket of clients) {
    if (socket.readyState === 1) socket.send(data);
  }
}

app.get('/api/status', async () => ({
  station,
  api: `http://${station.apiHost}:${station.apiPort}`,
  web: `http://${station.apiHost}:${station.webPort}`,
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
  music: { mode: config.neteaseApiBase ? 'netease' : 'demo' },
  cast: getCastStatus()
}));

app.get('/api/netease/status', async () => getNeteaseLoginStatus(store));

app.post('/api/netease/qr/create', async () => createNeteaseQr());

app.post('/api/netease/qr/check', async (request) => {
  const key = String(request.body?.key || '');
  if (!key) return { code: 400, message: 'missing key', loggedIn: false };
  return checkNeteaseQr(store, key);
});

app.get('/api/now', async () => publicNow());

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
  const text = String(request.body?.text || '这里是十三哥的音乐之声。今晚，我们慢慢听。');
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
  const plan = await createRadioPlan({
    store,
    mood: request.body?.mood || null,
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
    reply: plan.plan?.reply || `收到。十三哥的音乐之声已经按${plan.mood}重新整理队列。`,
    plan,
    planMessage
  };
});

function buildPlanMessage(plan) {
  return {
    type: 'plan',
    title: plan.plan?.planTitle || 'MarkRadio 播出计划',
    summary: plan.plan?.planSummary || plan.plan?.reason || '',
    changes: plan.plan?.changes || [],
    queue: plan.queue || []
  };
}

app.post('/api/playback/:action', async (request) => {
  const action = request.params.action;
  const state = publicNow();
  const now = state.now;
  if (action === 'play') now.playing = true;
  if (action === 'pause') now.playing = false;
  if (action === 'seek') now.progress = Number(request.body?.progress || 0);
  if (action === 'select' && state.plan?.queue?.length) {
    const index = Number.isInteger(request.body?.index) ? request.body.index : -1;
    const trackId = String(request.body?.trackId || '');
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
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : 0;
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
});

app.get('/ws/stream', { websocket: true }, (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ event: 'now', payload: publicNow(), at: new Date().toISOString() }));
  socket.on('close', () => clients.delete(socket));
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

app.post('/api/cast/connect', async (request) => {
  const { host, port } = request.body || {};
  if (!host || !port) return { ok: false, message: '缺少 host 或 port' };
  await castManager.connect(host, port);
  return castManager.getStatus();
});

app.post('/api/cast/play', async (request) => {
  const { url, title, artist, album } = request.body || {};
  if (!url) return { ok: false, message: '缺少音频 url' };
  castManager.play(url, { title, artist, album });
  return castManager.getStatus();
});

app.post('/api/cast/:action', async (request) => {
  const action = request.params.action;
  if (action === 'pause') castManager.pause();
  else if (action === 'resume') castManager.resume();
  else if (action === 'stop') castManager.stop();
  else if (action === 'disconnect') castManager.disconnect();
  else return { ok: false, message: `未知 action: ${action}` };
  return castManager.getStatus();
});

app.get('/media/audio', async (request, reply) => {
  const id = String(request.query?.id || '');
  let target = String(request.query?.url || '');
  if (id) {
    const data = await callNetease('song/url/v1', { id, level: 'standard' }, store).catch(() =>
      callNetease('song/url', { id }, store).catch(() => null)
    );
    target = data?.data?.[0]?.url || '';
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
  if (contentType) reply.header('Content-Type', contentType);
  if (contentLength) reply.header('Content-Length', contentLength);
  if (contentRange) reply.header('Content-Range', contentRange);
  if (acceptRanges) reply.header('Accept-Ranges', acceptRanges);
  return reply.send(Readable.fromWeb(upstream.body));
});

const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  await webApp.register(fastifyStatic, {
    root: distDir,
    prefix: '/'
  });
  webApp.setNotFoundHandler((request, reply) => reply.sendFile('index.html'));
  await webApp.listen({ host: config.host, port: config.webPort });
} else {
  app.log.warn('dist directory not found; web server was not started');
}

await app.listen({ host: config.host, port: config.apiPort });

// Warmup: generate initial plan in background so first page load is instant
setTimeout(async () => {
  try {
    const existingPlan = store.get('planToday');
    if (existingPlan) {
      broadcast('plan', existingPlan);
      return;
    }
    // Generate fresh plan with async TTS
    const plan = await createRadioPlan({ store, deferTts: true, onTtsReady: (updated) => {
      broadcast('plan', updated);
    } });
    broadcast('plan', plan);
  } catch (e) {
    app.log.warn('Plan warmup failed: ' + e.message);
  }
}, 800);
