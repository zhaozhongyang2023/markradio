// ─── 网易云听歌偏好推导 ───
// 从 liked songs + 收藏歌单中提取用户真实音乐品味
import { getNeteaseCookie } from './netease-auth.js';
import { config } from './config.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时刷新

export async function deriveNeteaseTaste(store) {
  if (!config.neteaseApiBase) return null;

  const cookie = getNeteaseCookie(store);
  if (!cookie) return null;

  // 检查缓存
  const cached = store.get('neteaseTaste');
  if (cached?.fetchedAt && (Date.now() - new Date(cached.fetchedAt).getTime()) < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const profile = await buildTasteProfile(store);
    const neteaseTaste = {
      ...profile,
      fetchedAt: new Date().toISOString()
    };
    store.set('neteaseTaste', neteaseTaste);
    return neteaseTaste;
  } catch {
    // 获取失败时返回缓存（即使过期），不阻断流程
    return cached || null;
  }
}

async function buildTasteProfile(store) {
  const callNetease = (await import('./netease-auth.js')).callNetease;

  // 1. 获取收藏歌单名称
  const playlistLabels = [];
  try {
    const playlistData = await callNetease('user/playlist', { uid: await getUserId(store), limit: 8 }, store);
    const playlists = (playlistData?.playlist || []).slice(0, 4);
    for (const pl of playlists) {
      if (pl.name) playlistLabels.push(String(pl.name).slice(0, 20));
    }
  } catch { /* 忽略 */ }

  // 2. 获取喜欢的歌曲 ID 列表
  let likedIds = [];
  try {
    const likelistData = await callNetease('likelist', { uid: await getUserId(store) }, store);
    likedIds = (Array.isArray(likelistData?.ids) ? likedIds : likelistData?.ids || []).slice(0, 40);
  } catch { /* 忽略 */ }

  // 3. 从喜欢歌曲获取艺人、语言分布
  let topArtists = [];
  let chineseCount = 0;
  let englishCount = 0;
  let totalEnergy = 0;
  let trackCount = 0;

  if (likedIds.length) {
    try {
      const ids = likedIds.map((id) => String(id.id || id)).join(',');
      const detailData = await callNetease('song/detail', { ids }, store);
      const songs = detailData?.songs || [];

      const artistCount = {};
      for (const song of songs) {
        const artists = (song.ar || song.artists || []).map((a) => a.name).filter(Boolean);
        for (const a of artists) {
          artistCount[a] = (artistCount[a] || 0) + 1;
        }

        // 语言判断
        const text = `${song.name || ''} ${artists.join(' ')}`;
        if (/[\u4e00-\u9fff]/.test(text)) chineseCount++;
        else if (/[a-z]/i.test(text)) englishCount++;

        // energy 估算（基于 popularity）
        totalEnergy += song.pop ? song.pop / 100 : 0.5;
        trackCount++;
      }

      // Top 8 艺人
      topArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name]) => name);
    } catch { /* 忽略 */ }
  }

  // 4. 生成摘要
  const avgEnergy = trackCount ? totalEnergy / trackCount : 0.5;
  const totalLang = chineseCount + englishCount || 1;
  const languageRatio = {
    chinese: Math.round((chineseCount / totalLang) * 100) / 100,
    english: Math.round((englishCount / totalLang) * 100) / 100
  };

  const summaryParts = [];
  if (topArtists.length) {
    summaryParts.push(`常听艺人：${topArtists.slice(0, 5).join('、')}`);
  }
  if (playlistLabels.length) {
    summaryParts.push(`收藏歌单：${playlistLabels.join('、')}`);
  }
  if (trackCount > 0) {
    const langDesc = languageRatio.chinese >= 0.7 ? '偏好中文' :
      languageRatio.english >= 0.7 ? '偏好英文' :
        languageRatio.chinese >= 0.5 ? '中英文各半' : '偏英文';
    summaryParts.push(langDesc);
  }
  if (trackCount > 0) {
    const energyDesc = avgEnergy >= 0.7 ? '偏好高能量' : avgEnergy >= 0.4 ? '中等能量' : '偏好低刺激';
    summaryParts.push(energyDesc);
  }

  return {
    topArtists,
    playlistLabels,
    languageRatio,
    avgEnergy: Math.round(avgEnergy * 100) / 100,
    trackCount,
    summary: summaryParts.join('；') + '。' || '',
    source: 'netease'
  };
}

async function getUserId(store) {
  const { getNeteaseLoginStatus } = await import('./netease-auth.js');
  const status = await getNeteaseLoginStatus(store).catch(() => ({ profile: null }));
  return status?.profile?.userId || '';
}
