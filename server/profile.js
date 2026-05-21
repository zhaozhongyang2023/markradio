import { config } from './config.js';
import { collectNeteaseLibrary } from './providers/netease.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';

import OpenAI from 'openai';

export function loadMusicDNA(store) {
  const raw = store.get('musicDna');
  if (!raw) return null;
  // 迁移旧版 DNA 到新版结构
  return migrateDna(raw);
}

export function saveMusicDNA(store, dna) {
  store.set('musicDna', { ...dna, generated_at: new Date().toISOString() });
  return dna;
}

export function getMusicDNASummary(dna) {
  if (!dna) return '';
  const parts = [];
  if (dna.core_feelings?.length) parts.push(dna.core_feelings.slice(0, 3).join(' / '));
  if (dna.listening_state?.length) parts.push(dna.listening_state.slice(0, 2).join(' / '));
  if (dna.music_personality?.length) parts.push(dna.music_personality.slice(0, 2).join(' / '));
  // 兼容旧版
  if (!parts.length && dna.favorite_styles?.length) parts.push(dna.favorite_styles.slice(0, 3).join(' / '));
  return parts.join(' · ') || '';
}

export async function generateMusicDNA(store, preferences = '') {
  if (!config.aiApiKey) {
    return {
      core_feelings: [],
      listening_state: [],
      music_personality: [],
      source: 'empty',
      reason: '未配置 AI'
    };
  }

  // 拉取网易云数据
  let neteaseData = null;
  const neteaseAuth = store.get('neteaseAuth');
  if (neteaseAuth?.cookie && config.neteaseApiBase) {
    try {
      neteaseData = await collectNeteaseLibrary(store);
    } catch {
      // 网易云数据拉取失败不影响后续
    }
  }

  // 构建分析 prompt
  const libraryInfo = neteaseData
    ? `喜欢歌曲 ${neteaseData.likedCount} 首，收藏歌单 ${neteaseData.playlistCount} 个，收藏专辑 ${neteaseData.albumCount || 0} 张。
歌单样本：${neteaseData.playlistSamples.map((p) => `【${p.name}】${p.tracks.slice(0, 5).join('、')}`).join('\n')}
${neteaseData.albumCount ? '专辑样本：' + neteaseData.albumSamples.join('、') : ''}
${neteaseData.playlistInsights?.length ? '歌单简介：' + neteaseData.playlistInsights.map(p => '【' + p.name + '】' + p.description + (p.tags?.length ? ' 标签：' + p.tags.join('、') : '')).join('\n') : ''}`
    : '暂无网易云数据。';

  // 加载已有 DNA，用于叠加分析
  const existingDna = migrateDna(store.get('musicDna'));

  const systemPrompt = `你是 MoodWave 的 AI DJ 音乐人格分析器。
你不是在分析音乐标签，而是在理解用户是一个什么样的听歌者。

分析维度：
- core_feelings: 用户听歌时的核心情绪状态 2~4 个（如：怀旧、平静、一个人、深夜思绪）
- listening_state: 用户听歌习惯和状态 2~4 个（如：喜欢长时间循环、喜欢跑图时听、深夜必戴耳机）
- music_personality: 用户整体音乐气质 2~4 个（如：更偏安静温暖、偏爱器乐氛围、喜欢低频沉浸）

不要输出音乐风格标签（如"LoFi""JRPG OST"），而是输出对用户的深层理解。
返回纯 JSON，无 Markdown，无解释。`;

  const userPrompt = existingDna?.source === 'ai_analysis'
    ? `之前对用户的理解：
- 核心情绪：${existingDna.core_feelings?.join('、') || '无'}
- 听歌状态：${existingDna.listening_state?.join('、') || '无'}
- 音乐气质：${existingDna.music_personality?.join('、') || '无'}

网易云数据：
${libraryInfo}

用户新增偏好：${preferences || '无'}

请融合更新。新增偏好优先级更高，但保留之前合理判断。返回 JSON：
{
  "core_feelings": ["", ""],
  "listening_state": ["", ""],
  "music_personality": ["", ""]
}`
    : `网易云数据：
${libraryInfo}

用户自述偏好：${preferences || '无'}

请分析并返回 JSON：
{
  "core_feelings": ["", ""],
  "listening_state": ["", ""],
  "music_personality": ["", ""]
}`;

  assertServiceAvailable(config.aiProvider);
  const client = new OpenAI({
    apiKey: config.aiApiKey,
    ...(config.aiBaseUrl ? { baseURL: config.aiBaseUrl } : {})
  });

  try {
    const completion = await client.chat.completions.create({
      model: config.aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    }, { timeout: 15000 });
    markServiceSuccess(config.aiProvider);

    const text = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    return {
      core_feelings: Array.isArray(parsed.core_feelings) ? parsed.core_feelings.slice(0, 4) : [],
      listening_state: Array.isArray(parsed.listening_state) ? parsed.listening_state.slice(0, 4) : [],
      music_personality: Array.isArray(parsed.music_personality) ? parsed.music_personality.slice(0, 4) : [],
      source: 'ai_analysis',
      ...(neteaseData ? {
        analyzed_tracks: neteaseData.likedCount,
        analyzed_playlists: neteaseData.playlistCount,
        analyzed_albums: neteaseData.albumCount || 0
      } : {})
    };
  } catch (error) {
    markServiceFailure(config.aiProvider);
    throw error;
  }
}

// 迁移旧版 DNA → 新版结构（兼容存量数据）
function migrateDna(raw) {
  if (!raw) return null;
  // 已经是新版结构，直接返回
  if (raw.listening_state || raw.music_personality) return raw;
  // 旧版结构：favorite_styles / core_feelings / preferred_scenes
  return {
    core_feelings: raw.core_feelings || [],
    listening_state: (raw.preferred_scenes || []),
    music_personality: (raw.favorite_styles || []),
    source: raw.source || 'migrated',
    analyzed_tracks: raw.analyzed_tracks,
    analyzed_playlists: raw.analyzed_playlists,
    analyzed_albums: raw.analyzed_albums,
    generated_at: raw.generated_at
  };
}
