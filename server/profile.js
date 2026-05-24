import { config } from './config.js';
import { collectNeteaseLibrary, getNeteaseLibraryCounts } from './providers/netease.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';

import OpenAI from 'openai';

export function loadMusicDNA(store) {
  const raw = store.get('musicDna');
  if (!raw) return null;
  // 迁移旧版 DNA 到新版结构
  return migrateDna(raw);
}

export function saveMusicDNA(store, dna) {
  // 历史归档：保存旧 DNA 到时间轴（最多 10 条）
  const old = migrateDna(store.get("musicDna"));
  if (old && old.core_moods?.length) {
    const history = store.get("musicDnaHistory") || [];
    history.push({
      generated_at: old.generated_at || new Date().toISOString(),
      core_moods: old.core_moods || [],
      listening_habits: old.listening_habits || old.listening_state || old.preferred_scenes || [],
      music_taste: old.music_taste || old.music_personality || old.favorite_styles || [],
      game_vibes: old.game_vibes || [],
      confidence: old.confidence || "low",
    });
    if (history.length > 10) history.shift();
    store.set("musicDnaHistory", history);
  }

  store.set('musicDna', { ...dna, generated_at: new Date().toISOString() });
  return dna;
}

export function getMusicDNASummary(dna) {
  if (!dna) return '';
  const parts = [];
  if (dna.core_moods?.length) parts.push(dna.core_moods.slice(0, 3).join(' / '));
  if (dna.listening_habits?.length) parts.push(dna.listening_habits.slice(0, 2).join(' / '));
  if (dna.music_taste?.length) parts.push(dna.music_taste.slice(0, 3).join(' / '));
  if (dna.game_vibes?.length) parts.push(dna.game_vibes.slice(0, 2).join(' / '));
  // 兼容旧版
  if (!parts.length) {
    if (dna.core_feelings?.length) parts.push(dna.core_feelings.slice(0, 3).join(' / '));
    if (dna.favorite_styles?.length) parts.push(dna.favorite_styles.slice(0, 3).join(' / '));
  }
  return parts.join(' · ') || '';
}

// ─── 行为信号累积 ───

export function accumulateDnaSignal(store, type, value) {
  if (!type || !value) return;
  const v = String(value).trim();
  if (!v) return;
  const signals = store.get('dnaSignals') || [];
  const existing = signals.find(s => s.type === type && s.value === v);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.lastAt = new Date().toISOString();
  } else {
    signals.push({ type, value: v, count: 1, lastAt: new Date().toISOString() });
  }
  // 上限 50 条，超出淘汰最旧（按 lastAt 排序）
  if (signals.length > 50) {
    signals.sort((a, b) => new Date(a.lastAt) - new Date(b.lastAt));
    signals.splice(0, signals.length - 50);
  }
  store.set('dnaSignals', signals);
}

export function getDnaSignalsSummary(store) {
  const signals = store.get('dnaSignals') || [];
  if (!signals.length) return '';
  const typeLabels = { mood: '心情', search: '搜索', gameVibe: '游戏氛围' };
  const grouped = {};
  for (const s of signals) {
    const key = `${s.type}|${s.value}`;
    if (!grouped[key]) grouped[key] = { type: s.type, value: s.value, count: 0 };
    grouped[key].count += s.count || 1;
  }
  const sorted = Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 8);
  if (!sorted.length) return '';
  const lines = sorted.map(g => {
    const label = typeLabels[g.type] || g.type;
    return `${label}了"${g.value}"${g.count > 1 ? ' ×' + g.count : ''}`;
  });
  return '近期行为：' + lines.join('，') + '。';
}

// ─── 自动检测与更新 ───

let _dnaRegenerating = false;

export function maybeRegenerateDna(store) {
  if (_dnaRegenerating) return;
  _dnaRegenerating = true;

  // 异步执行，fire-and-forget
  (async () => {
    try {
      const existing = migrateDna(store.get('musicDna'));
      let needRegen = false;

      // 检查是否超过 6 小时
      if (existing?.generated_at) {
        const ageMs = Date.now() - new Date(existing.generated_at).getTime();
        if (ageMs > 6 * 3600 * 1000) needRegen = true;
      } else {
        needRegen = true; // 从未生成过
      }

      // 检查网易云数据是否变化
      if (!needRegen && existing?.source === 'ai_analysis') {
        const counts = await getNeteaseLibraryCounts(store).catch(() => null);
        if (counts) {
          const prevTracks = existing.analyzed_tracks || 0;
          const prevPlaylists = existing.analyzed_playlists || 0;
          const prevAlbums = existing.analyzed_albums || 0;
          if (counts.likedCount !== null && counts.likedCount !== prevTracks) needRegen = true;
          if (counts.playlistCount !== null && counts.playlistCount !== prevPlaylists) needRegen = true;
          if (counts.albumCount !== null && counts.albumCount !== prevAlbums) needRegen = true;
        }
      }

      if (needRegen) {
        const dna = await generateMusicDNA(store);
        saveMusicDNA(store, dna);

        // 行为信号足够多 → 自动提级
        const signals = store.get("dnaSignals") || [];
        const totalSignals = signals.reduce((sum, s) => sum + (s.count || 1), 0);
        if (dna.confidence === "medium" && totalSignals >= 30) {
          dna.confidence = "high";
          saveMusicDNA(store, dna);
        } else if (dna.confidence === "low" && totalSignals >= 15) {
          dna.confidence = "medium";
          saveMusicDNA(store, dna);
        }
      }
    } catch {
      // 静默失败，不影响主流程
    } finally {
      _dnaRegenerating = false;
    }
  })();
}

export async function generateMusicDNA(store, preferences = '') {
  if (!config.aiApiKey) {
    return {
      core_moods: [],
      listening_habits: [],
      music_taste: [],
      game_vibes: [],
      confidence: 'low',
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

  const systemPrompt = `你是 MoodWave 的 Music DNA 分析器。
你的任务是根据用户的网易云音乐数据和行为信号，生成用户的音乐人格画像。

返回 JSON，结构如下：
{
  "core_moods": ["情绪1", "情绪2", "情绪3"],
  "listening_habits": ["习惯1", "习惯2", "习惯3"],
  "music_taste": ["风格1", "风格2", "风格3", "风格4"],
  "game_vibes": [],
  "confidence": "medium"
}

分析规则：
1. core_moods（3~4个）：从歌单和喜好歌中感知情绪氛围，不是风格名。例：安静向歌单 → ["治愈","安静"]
2. listening_habits（3~4个）：从歌单名称、描述推断听歌场景。如歌单名"深夜专属" → 深夜听歌。
3. music_taste（4~6个）：提取具体音乐风格名，不要解释。从歌单标签、曲库中归纳。
4. game_vibes：从用户行为信号中提取 gameVibe 记录。格式"游戏→氛围"。无记录则返回 []。
5. confidence：
   - "high"：网易云50+喜欢、3+歌单、有行为信号
   - "medium"：有网易云数据或行为信号
   - "low"：只有Demo数据

禁止输出 Markdown。纯 JSON。`;

  const userPrompt = existingDna?.source === 'ai_analysis'
    ? `之前对用户的理解：
- 情绪偏好：${existingDna.core_moods?.join('、') || existingDna.core_feelings?.join('、') || '无'}
- 听歌习惯：${existingDna.listening_habits?.join('、') || existingDna.listening_state?.join('、') || '无'}
- 音乐口味：${existingDna.music_taste?.join('、') || existingDna.music_personality?.join('、') || '无'}
- 游戏氛围：${existingDna.game_vibes?.join('、') || '无'}

网易云数据：
${libraryInfo}

用户行为信号：
${getDnaSignalsSummary(store) || '暂无近期行为信号。'}

用户自述偏好：${preferences || '无'}

请在之前分析的基础上增量更新，不要推倒重来。
- 之前合理的维度词条尽量保留（除非新数据明显矛盾）
- 行为信号中出现的新模式可以补充到对应维度
- 最多增减 1~2 个词条，保持整体稳定
返回 JSON：
{
  "core_moods": ["", ""],
  "listening_habits": ["", ""],
  "music_taste": ["", ""],
  "game_vibes": [],
  "confidence": "medium"
}`
    : `网易云数据：
${libraryInfo}

用户行为信号：
${getDnaSignalsSummary(store) || '暂无近期行为信号。'}

用户自述偏好：${preferences || '无'}

请分析并返回 JSON：
{
  "core_moods": ["", ""],
  "listening_habits": ["", ""],
  "music_taste": ["", ""],
  "game_vibes": [],
  "confidence": "medium"
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
      core_moods: Array.isArray(parsed.core_moods) ? parsed.core_moods.slice(0, 4) : [],
      listening_habits: Array.isArray(parsed.listening_habits) ? parsed.listening_habits.slice(0, 4) : [],
      music_taste: Array.isArray(parsed.music_taste) ? parsed.music_taste.slice(0, 6) : [],
      game_vibes: Array.isArray(parsed.game_vibes) ? parsed.game_vibes.slice(0, 4) : [],
      confidence: parsed.confidence || 'medium',
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
  // 已经是 V2 新版结构，直接返回
  if (raw.listening_habits || raw.music_taste || raw.game_vibes) return raw;
  // V2 迁移 V1 → V2
  return {
    core_moods: raw.core_feelings || raw.core_moods || [],
    listening_habits: raw.listening_state || raw.preferred_scenes || raw.listening_habits || [],
    music_taste: raw.music_personality || raw.favorite_styles || raw.music_taste || [],
    game_vibes: raw.game_vibes || [],
    confidence: raw.confidence || 'medium',
    source: raw.source || 'migrated',
    analyzed_tracks: raw.analyzed_tracks,
    analyzed_playlists: raw.analyzed_playlists,
    analyzed_albums: raw.analyzed_albums,
    generated_at: raw.generated_at
  };
}
