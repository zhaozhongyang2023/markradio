import OpenAI from 'openai';
import { config } from './config.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';

export const MAX_AI_PLAN_TRACKS = 60;

export function parseDjJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : trimmed;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('模型没有返回 JSON 对象');
  const parsed = JSON.parse(source.slice(start, end + 1));
  return normalizePlan(parsed);
}

export function normalizePlan(plan) {
  const trackReasons = {};
  const playIds = [];
  if (Array.isArray(plan.play)) {
    for (const item of plan.play) {
      if (typeof item === 'string') {
        playIds.push(item);
      } else if (item && typeof item === 'object' && item.id) {
        playIds.push(String(item.id));
        if (item.reason) trackReasons[String(item.id)] = String(item.reason);
      }
    }
  }
  // 也合并 AI 直接返回的 trackReasons 字段（与 play 数组分离时）
  if (plan.trackReasons && typeof plan.trackReasons === 'object') {
    for (const [id, reason] of Object.entries(plan.trackReasons)) {
      if (!trackReasons[id]) trackReasons[String(id)] = String(reason);
    }
  }
  return {
    intent: String(plan.intent || 'create'),
    reply: String(plan.reply || '今晚适合慢一点。'),
    say: String(plan.say || '夜色缓缓铺开，声音是最好的陪伴。我们从一首契合此刻的歌开始。'),
    play: playIds.slice(0, MAX_AI_PLAN_TRACKS),
    trackReasons,
    planTitle: String(plan.planTitle || plan.title || 'MoodWave 播出计划'),
    planSummary: String(plan.planSummary || plan.summary || plan.reason || '根据当前对话生成的播出计划。'),
    changes: Array.isArray(plan.changes) ? plan.changes.map(String).slice(0, 12) : [],
    shouldSwitchNow: Boolean(plan.shouldSwitchNow),
    reason: String(plan.reason || '今晚适合慢一点。'),
    segue: String(plan.segue || '下一首，继续留在这个夜里。'),
    mood: String(plan.mood || '平静'),
    tags: Array.isArray(plan.tags) ? plan.tags.map(String).slice(0, 8) : [],
    voiceStyle: String(plan.voiceStyle || '语速适中，温柔克制，停顿自然。')
  };
}

export async function generateDjPlan({ messages, fallbackTracks, mood }) {
  if (!config.aiApiKey) {
    return demoPlan(fallbackTracks, mood, '未配置 AI API Key，使用 Demo DJ 计划。');
  }

  assertServiceAvailable(config.aiProvider);
  const client = new OpenAI({
    apiKey: config.aiApiKey,
    ...(config.aiBaseUrl ? { baseURL: config.aiBaseUrl } : {})
  });
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: config.aiModel,
      messages,
      temperature: 0.88,
      response_format: { type: 'json_object' }
    }, { timeout: 15000 });
    markServiceSuccess(config.aiProvider);
  } catch (error) {
    markServiceFailure(config.aiProvider);
    throw error;
  }

  const text = completion.choices?.[0]?.message?.content || '';
  const plan = parseDjJson(text);
  if (!plan.play.length) plan.play = fallbackTracks.slice(0, 5).map((track) => track.id);
  return plan;
}

export function demoPlan(fallbackTracks, mood, reason = 'Demo 模式') {
  const first = fallbackTracks[0];
  const title = first?.title || '这首歌';
  const artist = first?.artist || '';
  return {
    reply: `今晚先按${mood}，慢慢听。`,
    say: `今晚适合安静一点。从${artist ? artist + '的' : ''}《${title}》开始。`,
    play: fallbackTracks.slice(0, 5).map((track) => track.id),
    trackReasons: first ? { [first.id]: `${artist ? artist + '的' : ''}《${title}》，适合戴耳机慢慢听。` } : {},
    reason,
    segue: '下一首，把声音再放低一点。',
    mood,
    tags: [mood, 'MoodWave', '深夜电台'],
    voiceStyle: '语速偏慢，温柔，句子短，句尾自然停顿，像深夜电台。'
  };
}
