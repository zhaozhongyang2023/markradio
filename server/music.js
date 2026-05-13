import { demoTracks } from './defaults.js';
import { config } from './config.js';
import { scoreTrackForMood } from './mood.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';
import { callNetease, getNeteaseLoginStatus } from './netease-auth.js';

export async function getCandidateTracks({ store, mood }) {
  const neteaseTracks = await getNeteaseCandidates(store, mood).catch(() => []);
  const tracks = neteaseTracks.length ? neteaseTracks : store.get('tracks') || demoTracks;
  const recent = new Set(store.recentPlays(100).map((item) => item.trackId));
  // 直接剔除已推荐/播放过的歌曲，保证每组都是新歌
  const fresh = tracks.filter((track) => !recent.has(track.id));
  if (fresh.length < 4) {
    // 兜底：候选不足时放宽限制，只惩罚不剔除
    return tracks
      .map((track) => ({
        ...track,
        score: scoreTrackForMood(track, mood) + (recent.has(track.id) ? -0.4 : 0)
      }))
      .sort((a, b) => b.score - a.score);
  }
  return fresh
    .map((track) => ({
      ...track,
      score: scoreTrackForMood(track, mood)
    }))
    .sort((a, b) => b.score - a.score);
}

export async function buildQueue(tracks, store, limit = 4) {
  const queue = await Promise.all(tracks.slice(0, limit).map((track) => resolveTrackMedia(track, store)));
  return queue.map((track, index) => ({ ...track, queueIndex: index }));
}

async function getNeteaseCandidates(store, mood) {
  if (!config.neteaseApiBase) return [];
  assertServiceAvailable('netease');
  const tracks = [];
  const status = await getNeteaseLoginStatus(store).catch(() => ({ loggedIn: false, profile: null }));

  if (status.profile?.userId) {
    tracks.push(...(await getLikedTracks(store, status.profile.userId, mood)));
    tracks.push(...(await getPlaylistTracks(store, status.profile.userId, mood)));
  }

  tracks.push(...(await getEndpointTracks(store, 'recommend/songs', {}, mood, '网易云每日推荐')));
  tracks.push(...(await getEndpointTracks(store, 'personalized/newsong', { limit: 30 }, mood, '网易云新歌推荐')));
  tracks.push(...(await getEndpointTracks(store, 'top/song', { type: 7 }, mood, '网易云热歌推荐')));

  const unique = uniqueTracks(tracks);
  if (unique.length) markServiceSuccess('netease');
  return unique;
}

async function getLikedTracks(store, userId, mood) {
  const liked = await getEndpointTracks(store, 'likelist', { uid: userId }, mood, '我喜欢的音乐');
  const ids = liked.map((track) => track.sourceId).filter(Boolean).slice(0, 40);
  if (!ids.length) return [];
  return getEndpointTracks(store, 'song/detail', { ids: ids.join(',') }, mood, '我喜欢的音乐');
}

async function getPlaylistTracks(store, userId, mood) {
  const data = await callNetease('user/playlist', { uid: userId, limit: 8 }, store).catch(() => null);
  const playlists = (data?.playlist || []).filter((playlist) => playlist?.id).slice(0, 4);
  const results = await Promise.all(playlists.map((playlist) =>
    getEndpointTracks(store, 'playlist/track/all', { id: playlist.id, limit: 18 }, mood, `收藏歌单：${playlist.name || '网易云歌单'}`)
  ));
  return results.flat();
}

async function getEndpointTracks(store, endpoint, params, mood, sourceLabel) {
  const data = await callNetease(endpoint, params, store).catch((error) => {
    markServiceFailure('netease');
    return { error };
  });
  if (data?.error) return [];
  return normalizeNeteaseResponse(data, mood, sourceLabel);
}

function normalizeNeteaseResponse(data, mood, sourceLabel = '网易云音乐') {
  const likedIds = Array.isArray(data?.ids) ? data.ids : [];
  if (likedIds.length) {
    return likedIds.slice(0, 40).map((id) => ({
      id: `netease-${id}`,
      source: 'netease',
      sourceId: String(id),
      title: `网易云歌曲 ${id}`,
      artist: '我喜欢的音乐',
      album: sourceLabel,
      duration: 210,
      mood: [mood, '平静'],
      energy: 0.58,
      reason: sourceLabel
    }));
  }

  const rawSongs = data?.data?.dailySongs || data?.recommend || data?.result || data?.data || data?.songs || [];
  return rawSongs
    .map((item) => item.song || item)
    .filter((song) => song?.id && song?.name)
    .slice(0, 32)
    .map((song) => {
      const artists = song.ar || song.artists || [];
      const album = song.al || song.album || {};
      return {
        id: `netease-${song.id}`,
        source: 'netease',
        sourceId: String(song.id),
        title: song.name,
        artist: artists.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
        album: album.name || '网易云音乐',
        duration: Math.max(30, Math.round((song.dt || song.duration || 210000) / 1000)),
        mood: [mood, '平静'],
        energy: estimateEnergy(song),
        reason: `来自${sourceLabel}，结合当前心情重新排序。`
      };
    });
}

function uniqueTracks(tracks) {
  const byId = new Map();
  for (const track of tracks) {
    if (!track?.sourceId && !track?.id) continue;
    const key = track.sourceId || track.id;
    if (!byId.has(key)) byId.set(key, track);
  }
  return [...byId.values()];
}

function estimateEnergy(song) {
  const popularity = typeof song.pop === 'number' ? song.pop / 100 : 0.5;
  return Math.max(0.18, Math.min(0.9, popularity || 0.5));
}

async function resolveTrackUrl(track, store) {
  if (track.url || track.source !== 'netease') return { ...track, url: track.url || null };
  const sourceId = track.sourceId || track.id?.replace(/^netease-/, '');
  const endpoints = [
    ['song/url/v1', { id: sourceId, level: 'standard' }],
    ['song/url', { id: sourceId }]
  ];

  for (const [endpoint, params] of endpoints) {
    const data = await callNetease(endpoint, params, store).catch(() => null);
    const url = data?.data?.[0]?.url;
    if (url) return { ...track, originalUrl: url, url: `/media/audio?id=${encodeURIComponent(sourceId)}` };
  }
  return { ...track, url: null };
}

async function resolveTrackMedia(track, store) {
  const withUrl = await resolveTrackUrl(track, store);
  if (withUrl.source !== 'netease') return withUrl;
  const sourceId = withUrl.sourceId || withUrl.id?.replace(/^netease-/, '');
  const data = await callNetease('lyric', { id: sourceId }, store).catch(() => null);
  const lyric = parseLyric(data?.lrc?.lyric || data?.klyric?.lyric || '');
  return { ...withUrl, lyric };
}

function parseLyric(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?](.*)$/);
      if (!match) return null;
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const ms = Number((match[3] || '0').padEnd(3, '0'));
      const text = match[4].trim();
      if (!text) return null;
      return {
        time: minutes * 60 + seconds + ms / 1000,
        text
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

export function buildDemoQueue(tracks, limit = 4) {
  return tracks.slice(0, limit).map((track, index) => ({
    ...track,
    queueIndex: index,
    url: track.url || null
  }));
}
