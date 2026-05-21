import { buildDjContext, buildMessages } from './context.js';
import { buildQueue, detectLanguageIntent, extractRequestedSongs, getCandidateTracks, trackMatchesLanguage, trackMatchesRequestedTitle } from './music.js';
import { MAX_AI_PLAN_TRACKS, demoPlan, generateDjPlan } from './openai.js';
import { synthesizeVoice } from './voice.js';
import { getWeather } from './weather.js';
import { getSpecialDates } from './special-dates.js';
import { recommendMood } from './mood.js';

const DEFAULT_QUEUE_LIMIT = 5;
const TTS_PRELOAD_LIMIT = 2;

export async function createRadioPlan({ store, mood: requestedMood = null, nowPlaying = null, deferTts = false, onTtsReady = null, userRequest = '', currentPlan = null }) {
  const mode = arguments[0]?.mode || 'radio';
  const playedSet = sessionPlayedIdsByMode.get(mode) || (() => { const s = new Set(); sessionPlayedIdsByMode.set(mode, s); return s; })();
  playedSet.clear();
  const now = new Date();
  const timeContext = buildTimeContext(now);
  const taste = store.get('taste');
  const voice = store.get('voice');
  const musicDna = store.get('musicDna');
  const weather = await getWeather().catch((error) => ({
    source: 'error',
    condition: '未知',
    temperature: null,
    summary: error.message
  }));
  store.set('weather', weather);
  const customDates = store.get('specialDates') || [];
  const specialDates = getSpecialDates(now, customDates);
  const mood = recommendMood({
    currentMood: requestedMood || store.get('mood')?.current,
    specialDates,
    weather
  });
  store.set('mood', { current: mood, updatedAt: new Date().toISOString() });

  const languageIntent = detectLanguageIntent(userRequest);
  const requestedSongs = extractRequestedSongs(userRequest);
  const currentQueue = languageIntent
    ? (currentPlan?.queue || []).filter((track) => trackMatchesLanguage(track, languageIntent))
    : currentPlan?.queue || [];
  const freshCandidates = await getCandidateTracks({ store, mood, userRequest });
  const candidates = mergeCandidateTracks(currentQueue, freshCandidates);
  const context = buildDjContext({
    taste,
    mood,
    specialDates,
    weather,
    recentPlays: store.recentPlays(50),
    tracks: candidates.slice(0, MAX_AI_PLAN_TRACKS),
    nowPlaying,
    voice,
    timeContext,
    userRequest,
    currentPlan,
    musicDna
  });
  const messages = buildMessages(context);
  const plan = await generateDjPlan({ messages, fallbackTracks: candidates, mood }).catch((error) =>
    demoPlan(candidates, mood, `GPT-5.5 暂不可用，已降级：${error.message}`)
  );
  const byId = new Map(candidates.map((track) => [track.id, track]));
  let selected = plan.play.map((id, i) => {
    const track = byId.get(id);
    if (!track) return null;
    // Use AI-generated per-song intro; fallback to buildTrackReason
    const aiReason = plan.trackReasons?.[id];
    track.reason = aiReason || buildTrackReason(track, i, plan, mood);
    return track;
  }).filter(Boolean);

  const requestedTracks = requestedSongs
    .map((title) => candidates.find((track) => trackMatchesRequestedTitle(track, title)))
    .filter(Boolean);
  if (requestedTracks.length) {
    selected = mergeSelectedTracks(requestedTracks, selected);
  }

  // Ensure every song has a proper AI-generated reason
  const genericPatterns = ['结合当前心情重新排序', '来自网易云', '每日推荐', '下一首，继续'];
  for (const t of selected) {
    const idx = selected.indexOf(t);
    const isGeneric = !t.reason || genericPatterns.some(p => t.reason.includes(p));
    if (isGeneric) {
      t.reason = buildTrackReason(t, idx, plan, mood);
    }
    // Double-check: if still empty or too short, force a minimal intro
    if (!t.reason || t.reason.length < 12) {
      t.reason = buildTrackReason(t, idx, plan, mood);
    }
  }
  const queueLimit = resolveQueueLimit(plan, selected.length);
  const queueTracks = fillQueueTracks(selected, candidates, queueLimit, playedSet);
  const queue = await buildQueue(queueTracks, store, queueLimit);
  const ttsText = buildIntroText({ plan, specialDates, track: queue[0] });
  const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  // 主导读 TTS：deferTts 时异步生成，立即返回 pending 态
  const tts = deferTts
    ? { ok: false, pending: true, url: null, text: ttsText }
    : await buildTts({ store, text: ttsText, mood, voiceStyle: plan.voiceStyle, nonce: planId });

  const cardTts = deferTts
    ? queue.map((track, index) => ({
        ok: false, pending: true, url: null,
        text: track?.reason || '',
        deferred: index >= TTS_PRELOAD_LIMIT
      }))
    : await (async () => {
      const results = [];
      for (const track of queue) {
        results.push(await buildTts({ store, text: track?.reason || '', mood, voiceStyle: plan.voiceStyle, nonce: planId }));
      }
      return results;
    })();

  const todayPlan = {
    id: planId,
    createdAt: new Date().toISOString(),
    mode,
    mood,
    weather,
    specialDates,
    plan,
    queue,
    tts,
    cardTts
  };
  store.set('planToday', todayPlan);
  store.set('plan-' + mode, todayPlan);
  if (queue[0]) store.set('now', { mode, track: queue[0], progress: 0, playing: false, speaking: Boolean(tts.ok), mood });
  if (deferTts) {
    // 主导读 TTS 异步生成
    buildTts({ store, text: ttsText, mood, voiceStyle: plan.voiceStyle, nonce: planId })
      .then((result) => updatePlanTts({ store, planId: todayPlan.id, tts: result, onTtsReady }))
      .catch((error) => updatePlanTts({
        store, planId: todayPlan.id,
        tts: { ok: false, pending: false, url: null, message: error.message, text: ttsText },
        onTtsReady
      }));
    // 每首歌导读卡片 TTS
    queue.slice(0, TTS_PRELOAD_LIMIT).forEach((track, i) => {
      const text = track?.reason;
      if (!text) return;
      buildTts({ store, text, mood, voiceStyle: plan.voiceStyle, nonce: planId })
        .then((card) => updateCardTts({ store, planId: todayPlan.id, index: i, tts: card, onTtsReady }))
        .catch((error) => updateCardTts({
          store, planId: todayPlan.id, index: i,
          tts: { ok: false, pending: false, url: null, message: error.message, text },
          onTtsReady
        }));
    });
  }
  return todayPlan;
}

function resolveQueueLimit(plan, selectedCount = 0) {
  const requested = Array.isArray(plan?.play) && plan.play.length ? plan.play.length : DEFAULT_QUEUE_LIMIT;
  return Math.max(1, Math.min(MAX_AI_PLAN_TRACKS, Math.max(requested, selectedCount)));
}

function mergeCandidateTracks(currentQueue, candidates) {
  const byId = new Map();
  for (const track of [...(currentQueue || []), ...(candidates || [])]) {
    if (!track?.id || byId.has(track.id)) continue;
    byId.set(track.id, track);
  }
  return [...byId.values()];
}

function mergeSelectedTracks(priorityTracks, selectedTracks) {
  const byId = new Map();
  for (const track of [...(priorityTracks || []), ...(selectedTracks || [])]) {
    if (!track?.id || byId.has(track.id)) continue;
    byId.set(track.id, track);
  }
  return [...byId.values()];
}

async function buildTts({ store, text, mood, voiceStyle, nonce = '' }) {
  return synthesizeVoice({ store, text, mood, voiceStyle, nonce }).then((result) => ({
    ...result,
    pending: false,
    text
  })).catch((error) => ({
    ok: false,
    pending: false,
    url: null,
    message: error.message,
    text
  }));
}

function updatePlanTts({ store, planId, tts, onTtsReady }) {
  const current = store.get('planToday');
  if (!current || current.id !== planId) return null;
  const updated = { ...current, tts };
  store.set('planToday', updated);
  const now = store.get('now');
  if (current.mode) store.set('plan-' + current.mode, updated);
  if (now) store.set('now', { ...now, speaking: Boolean(tts.ok) });
  onTtsReady?.(updated);
  return updated;
}

function updateCardTts({ store, planId, index, tts, onTtsReady }) {
  const current = store.get('planToday');
  if (!current || current.id !== planId) return null;
  const cardTts = [...(current.cardTts || [])];
  cardTts[index] = { ...(cardTts[index] || {}), ...tts };
  const updated = { ...current, cardTts };
  store.set('planToday', updated);
  onTtsReady?.(updated);
  if (current.mode) store.set('plan-' + current.mode, updated);
  return updated;
}

// Session-level played track IDs to prevent duplicates per mode
const sessionPlayedIdsByMode = new Map();

function fillQueueTracks(selected, candidates, limit, playedSet) {
  const seen = new Set(playedSet);
  const queue = [];
  // AI 选曲优先，不被去重跳过
  for (const track of selected) {
    if (!track?.id) continue;
    seen.add(track.id);
    playedSet.add(track.id);
    queue.push(track);
  }
  // 不足时从候选中补齐
  for (const track of candidates) {
    if (queue.length >= limit) break;
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    playedSet.add(track.id);
    queue.push(track);
  }
  return queue;
}

function buildTrackReason(track, index, plan, mood) {
  const title = track?.title || '这首歌';
  const artist = track?.artist || '';
  const album = track?.album || '';

  // Build song identity line
  const songId = artist
    ? `${artist} 的《${title}》`
    : `《${title}》`;
  const albumLine = (album && album !== '网易云音乐' && !album.includes('推荐'))
    ? `，出自专辑《${album}》`
    : '';

  if (index === 0) {
    // First song: use AI-generated opening (plan.say) as lead-in
    const leadIn = plan.say || `此刻的心情是${mood}，从这首歌开始。`;
    return `${leadIn} ${songId}${albumLine}。`.replace(/\s+/g, ' ').trim();
  }

  // Second song onwards: blend AI reasoning + transition + song info
  const reason = plan.reason || '';
  const segue = plan.segue || '下一首，继续。';
  // Create a cohesive intro: hint at why chosen, how it connects, and what to expect
  if (reason && reason.length > 10) {
    return `${segue} ${reason} ${songId}${albumLine}。`.replace(/\s+/g, ' ').trim();
  }
  return `${segue} ${reason} ${songId}${albumLine}。`.replace(/\s+/g, ' ').trim();
}

function buildIntroText({ plan, specialDates, track }) {
  const dateHint = specialDates?.[0]?.name ? `今天靠近${specialDates[0].name}。` : '';
  // Pre-intro: elegant opening only, no song reference (handled by card intro)
  return `${dateHint}${plan.say || '夜晚独享这个幽静的时光。'}`.replace(/\s+/g, ' ').trim();
}

function buildTimeContext(now) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'long',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  const hour = Number(value('hour'));
  return {
    iso: now.toISOString(),
    local: `${value('month')}-${value('day')} ${value('weekday')} ${value('hour')}:${value('minute')}`,
    period: periodName(hour),
    refreshSeed: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  };
}

function periodName(hour) {
  if (hour < 5) return '深夜';
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '午后';
  if (hour < 18) return '下午';
  if (hour < 22) return '夜晚';
  return '夜深';
}
