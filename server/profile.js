import { config } from './config.js';
import { collectNeteaseLibrary } from './providers/netease.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';

export function loadMusicDNA(store) {
  return store.get('musicDna') || null;
}

export function saveMusicDNA(store, dna) {
  store.set('musicDna', { ...dna, generated_at: new Date().toISOString() });
  return dna;
}

export function getMusicDNASummary(dna) {
  if (!dna) return '';
  const parts = [];
  if (dna.favorite_styles?.length) parts.push(dna.favorite_styles.slice(0, 3).join(' / '));
  if (dna.core_feelings?.length) parts.push(dna.core_feelings.slice(0, 3).join(' / '));
  if (dna.preferred_scenes?.length) parts.push(dna.preferred_scenes.slice(0, 2).join(' / '));
  return parts.join(' · ') || '';
}

export async function generateMusicDNA(store, preferences = '') {
  if (!config.aiApiKey) {
    return {
      favorite_styles: [],
      core_feelings: [],
      preferred_scenes: [],
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
${neteaseData.albumCount ? '专辑样本：' + neteaseData.albumSamples.join('、') : ''}`
    : '暂无网易云数据。';
  const systemPrompt = `你是 MoodWave 的 AI DJ 音乐人格分析器。
根据用户的网易云音乐收藏和自述偏好，分析用户的 Music DNA。
返回纯 JSON，无 Markdown，无解释。

分析维度：
- favorite_styles: 用户最喜欢的 2-5 个音乐风格
- core_feelings: 用户常听音乐的核心情绪 2-4 个
- preferred_scenes: 用户偏好的听歌场景 2-4 个`;

  const userPrompt = `网易云数据：
${libraryInfo}

用户自述偏好：${preferences || '无'}

请分析并返回 JSON：
{
  "favorite_styles": ["风格1", "风格2"],
  "core_feelings": ["情绪1", "情绪2"],
  "preferred_scenes": ["场景1", "场景2"]
}`;

  assertServiceAvailable(config.aiProvider);
  const { default: OpenAI } = await import('openai');
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
      favorite_styles: Array.isArray(parsed.favorite_styles) ? parsed.favorite_styles.slice(0, 5) : [],
      core_feelings: Array.isArray(parsed.core_feelings) ? parsed.core_feelings.slice(0, 4) : [],
      preferred_scenes: Array.isArray(parsed.preferred_scenes) ? parsed.preferred_scenes.slice(0, 4) : [],
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
