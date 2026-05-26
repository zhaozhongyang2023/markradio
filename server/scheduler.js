import { buildDjContext, buildMessages } from './context.js';
import { buildQueue, detectLanguageIntent, extractRequestedSongs, getCandidateTracks, trackMatchesLanguage, trackMatchesRequestedTitle, applyDnaWeight, sortByDnaWeight } from './music.js';
import { MAX_AI_PLAN_TRACKS, demoPlan, generateDjPlan } from './openai.js';
import { synthesizeVoice } from './voice.js';
import { getWeather } from './weather.js';
import { getSpecialDates } from './special-dates.js';
import { recommendMood } from './mood.js';
import { buildGameContext } from './game-understanding.js';
import { randomUUID } from 'node:crypto';

const sessionPlayedIdsByMode = new Map();
let _lastSessionCleanup = 0;

const DEFAULT_QUEUE_LIMIT = 5;
const TTS_PRELOAD_LIMIT = 5;

// ─── gameVibeSentence fallback（DeepSeek 常漏填此字段）───
export function fallbackGameVibeSentence(mood, gameName, gameVibe) {
  // 1. 游戏专属氛围句（优先匹配）
  const gameMap = {
    '巫师3': ['百果园的雨，慢慢走。', '篝火旁边，不用说话。', '猎魔人的路，一个人走。'],
    '艾尔登法环': ['褪色者，火点在远处。', '狭间地很大，不急。'],
    '赛博朋克2077': ['霓虹灯下，慢一点。', '夜之城的雨，一直下。'],
    '刺客信条': ['灯火远一点，脚步轻一点。', '从屋檐下经过。', '刀收好，夜还长。'],
    '生化危机': ['背后有脚步声，别回头。', '走廊很长，回声很远。'],
    '空洞骑士': ['地下很安静。', '圣巢的风，轻轻的。'],
    '塞尔达': ['海拉鲁的风，慢慢吹。', '开塔之前，先听首歌。'],
    '星露谷物语': ['农场里的日子，慢慢过。', '今天不赶进度。'],
    '我的世界': ['方块搭到一半，休息一下。', '矿洞很深，慢慢挖。'],
    '死亡搁浅': ['山那么远，不急着到。', '一个人送货的路上。'],
    '原神': ['风起地从这里开始。', '提瓦特很大，慢慢逛。'],
  };
  for (const [key, lines] of Object.entries(gameMap)) {
    if ((gameName && gameName.includes(key)) || (gameVibe && gameVibe.includes(key))) {
      return lines[Math.floor(Math.random() * lines.length)];
    }
  }

  // 2. 按 mood 通用氛围句（兜底）
  const moodMap = {
    愤怒: ['燃一点，按到底。', '今晚别松手。'],
    开心: ['节奏跟上来。', '今晚速度别停。'],
    悲伤: ['慢慢的，不急。', '声音低一点。'],
    平静: ['夜色压低一点。', '慢慢走，不赶路。'],
    忧郁: ['声音沉一点。', '今晚安静听。'],
    治愈: ['外面下雨，适合慢慢走。', '今晚别太累。'],
  };
  const lines = moodMap[mood] || moodMap['平静'];
  return lines[Math.floor(Math.random() * lines.length)];
}


export async function createRadioPlan({ store, mood: requestedMood = null, nowPlaying = null, deferTts = false, onTtsReady = null, userRequest = '', mode = 'radio', currentPlan = null, gameName = '', gameVibe = '', gamePresetId = '', gamePresetContext = null, autoContinue = false }) {
  // 每 30 分钟清理一次 session 级别的已播放记录，防止长期泄漏
  const nowMs = Date.now();
  if (nowMs - _lastSessionCleanup > 1800000) { sessionPlayedIdsByMode.clear(); _lastSessionCleanup = nowMs; }
  const playedSet = new Set(); sessionPlayedIdsByMode.set(mode, playedSet);
  const now = new Date();
  const timeContext = buildTimeContext(now);
  const taste = store.get('taste');
  const voice = store.get('voice');
  const musicDna = store.get('musicDna');
  const recentTendency = store.getTendency();
  const gameContext = (gameName || gameVibe || gamePresetContext) ? buildGameContext(gameName, gameVibe, gamePresetContext) : null;
  const emotionMomentum = calcEmotionMomentum(store);
  const weather = await getWeather().catch((error) => ({
    source: 'error',
    condition: '未知',
    temperature: null,
    summary: error.message
  }));
  store.set('weather', weather);
  // 世界连续性
  const lastWorld = store.get('lastWorldContext') || {};
  const worldContinuity = buildWorldContinuity(weather, lastWorld);
  store.set('lastWorldContext', {
    condition: weather?.condition || '',
    city: weather?.city || '',
    date: now.toISOString().slice(0, 10)
  });
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
  let candidates = mergeCandidateTracks(currentQueue, freshCandidates);

  // Music DNA 加权：把符合用户口味的歌排前面
  if (musicDna?.music_taste?.length) {
    candidates = sortByDnaWeight(applyDnaWeight(candidates, musicDna));
  }

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
    musicDna,
    recentTendency,
    emotionMomentum,
    gameContext,
    worldContinuity
  });
  const messages = buildMessages(context);
  const plan = await generateDjPlan({ messages, fallbackTracks: candidates, mood }).catch((error) =>
    demoPlan(candidates, mood, `GPT-5.5 暂不可用，已降级：${error.message}`)
  );
  if (!plan.gameVibeSentence && (gameName || gameVibe)) {
    plan.gameVibeSentence = fallbackGameVibeSentence(mood, gameName, gameVibe);
  }
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
    cardTts,
    regenerate: autoContinue ? {
      need: true,
      userRequest: userRequest || '',
      gameName: gameName || '',
      gameVibe: gameVibe || '',
      presetId: gamePresetId || gamePresetContext?.presetId || '',
      gamePresetContext: gamePresetContext || null
    } : null
  };
  store.set('planToday', todayPlan);
  store.set('plan-' + mode, todayPlan);
  if (queue[0]) store.set('now', { mode, track: queue[0], progress: 0, playing: false, speaking: Boolean(tts.ok), mood });
  if (deferTts) {
    // 主导读 TTS 优先异步生成（确保 WebSocket 推送后客户端可播放）
    await buildTts({ store, text: ttsText, mood, voiceStyle: plan.voiceStyle, nonce: planId })
      .then((result) => updatePlanTts({ store, planId: todayPlan.id, tts: result, onTtsReady }))
      .catch((error) => updatePlanTts({
        store, planId: todayPlan.id,
        tts: { ok: false, pending: false, url: null, message: error.message, text: ttsText },
        onTtsReady
      }));
    // 每首歌导读卡片 TTS（并行生成）
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

export function fillQueueTracks(selected, candidates, limit, playedSet) {
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

export function buildTrackReason(track, index, plan, mood) {
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
  return `${segue} ${reason} ${songId}${albumLine}。`.replace(/\s+/g, ' ').trim();
}

export function buildIntroText({ plan, specialDates, track }) {
  const dateHint = specialDates?.[0]?.name ? `今天靠近${specialDates[0].name}。` : '';
  // Pre-intro: elegant opening only, no song reference (handled by card intro)
  return `${dateHint}${plan.say || '夜晚独享这个幽静的时光。'}`.replace(/\s+/g, ' ').trim();
}

export function buildTimeContext(now) {
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

export function periodName(hour) {
  if (hour < 5) return '深夜';
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '午后';
  if (hour < 18) return '下午';
  if (hour < 22) return '夜晚';
  return '夜深';
}

// Emotion Momentum: 根据连续播放历史计算 DJ 语气倾斜
export function calcEmotionMomentum(store) {
  const recent = store.recentPlays(20);
  if (!recent.length) return null;
  const moods = recent.map(r => r.mood).filter(Boolean);
  if (!moods.length) return null;
  // 统计近期情绪分布
  const quiet = moods.filter(m => ['平静', '悲伤', '治愈'].includes(m)).length;
  const ratio = quiet / moods.length;
  if (ratio >= 0.7) return '用户近期情绪偏安静、内敛。DJ 语气应比平时更慢、更温柔、更多留白。';
  if (ratio <= 0.3) return '用户近期情绪偏活跃。DJ 语气可以稍微轻快一点，但仍保持克制。';
  return null;
}

// 世界连续性：比较本次天气与上次，生成连续性提示
export function buildWorldContinuity(current, last) {
  if (!current?.condition || !last?.condition) return null;
  const sameCity = current.city && last.city && current.city === last.city;
  const sameCondition = current.condition === last.condition;
  const isDifferentDay = last.date && last.date !== new Date().toISOString().slice(0, 10);
  if (!isDifferentDay && sameCondition && sameCity) return null; // 同一天不重复
  if (sameCondition && sameCity) {
    return `上一次也是${current.condition}天，天气还没变。可以自然地提一句"还是没放晴"。`;
  }
  if (sameCity && !sameCondition) {
    return `上次是${last.condition}，今天变成了${current.condition}。可以自然地提一句天气变化。`;
  }
  return null;
}
