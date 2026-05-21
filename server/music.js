import { demoTracks } from './defaults.js';
import { config } from './config.js';
import { scoreTrackForMood } from './mood.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';
import { callNetease, getNeteaseLoginStatus } from './netease-auth.js';

export async function getCandidateTracks({ store, mood, userRequest = '' }) {
  const languageIntent = detectLanguageIntent(userRequest);
  const requestedSongs = extractRequestedSongs(userRequest);
  const neteaseTracks = await getNeteaseCandidates(store, mood, { languageIntent, requestedSongs }).catch(() => []);
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
      .sort((a, b) => {
        const langDiff = languageScore(b, languageIntent) - languageScore(a, languageIntent);
        if (langDiff !== 0) return langDiff;
        return b.score - a.score;
      });
  }
  return fresh
    .map((track) => ({
      ...track,
      score: scoreTrackForMood(track, mood)
    }))
    .sort((a, b) => {
        const langDiff = languageScore(b, languageIntent) - languageScore(a, languageIntent);
        if (langDiff !== 0) return langDiff;
        return b.score - a.score;
      });
}

export async function buildQueue(tracks, store, limit = 4) {
  const queue = await Promise.all(tracks.slice(0, limit).map((track) => resolveTrackMedia(track, store)));
  return queue.map((track, index) => ({ ...track, queueIndex: index }));
}

async function getNeteaseCandidates(store, mood, { languageIntent = null, requestedSongs = [] } = {}) {
  if (!config.neteaseApiBase) return [];
  assertServiceAvailable('netease');
  const tracks = [];
  const status = await getNeteaseLoginStatus(store).catch(() => ({ loggedIn: false, profile: null }));

  for (const title of requestedSongs) {
    tracks.push(...(await searchNeteaseTracks(store, title, mood)));
  }

  if (languageIntent === 'english') {
    tracks.push(...(await getEndpointTracks(store, 'top/song', { type: 96 }, mood, '网易云欧美新歌榜')));
  }

  if (status.profile?.userId) {
    tracks.push(...(await getLikedTracks(store, status.profile.userId, mood)));
    tracks.push(...(await getPlaylistTracks(store, status.profile.userId, mood)));
  }

  tracks.push(...(await getEndpointTracks(store, 'recommend/songs', {}, mood, '网易云每日推荐')));
  tracks.push(...(await getEndpointTracks(store, 'personalized/newsong', { limit: 30 }, mood, '网易云新歌推荐')));
  if (languageIntent !== 'english') {
    tracks.push(...(await getEndpointTracks(store, 'top/song', { type: 7 }, mood, '网易云热歌推荐')));
  }

  const unique = uniqueTracks(tracks);
  if (unique.length) markServiceSuccess('netease');
  return unique;
}

async function searchNeteaseTracks(store, title, mood) {
  const params = { keywords: title, type: 1, limit: 8 };
  const cloud = await getEndpointTracks(store, 'cloudsearch', params, mood, `网易云搜索：${title}`);
  const results = cloud.length ? cloud : await getEndpointTracks(store, 'search', params, mood, `网易云搜索：${title}`);
  return results.sort((a, b) => requestedSongScore(b, title) - requestedSongScore(a, title));
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

export function normalizeNeteaseResponse(data, mood, sourceLabel = '网易云音乐') {
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

  const rawSongs = data?.data?.dailySongs || data?.recommend || data?.result?.songs || data?.result || data?.data || data?.songs || [];
  if (!Array.isArray(rawSongs)) return [];
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
        language: inferTrackLanguage({ title: song.name, artist: artists.map((artist) => artist.name).filter(Boolean).join(' / '), sourceLabel }),
        mood: [mood, '平静'],
        energy: estimateEnergy(song),
        reason: `来自${sourceLabel}，结合当前心情重新排序。`
      };
    });
}

export function detectLanguageIntent(text = '') {
  const value = String(text).toLowerCase();
  if (/(英文|英语|欧美|英伦|english|western|american|british)/i.test(value)) return 'english';
  if (/(中文|国语|华语|粤语|chinese|mandarin|cantonese)/i.test(value)) return 'chinese';
  return null;
}

export function extractRequestedSongs(text = '') {
  const value = String(text || '').trim();
  if (!value) return [];

  const titles = [];
  for (const match of value.matchAll(/《([^》]{1,80})》/g)) {
    titles.push(match[1]);
  }

  const directPattern = /(?:想听|要听|播放|放一下|放一首|放|来一首|点一首|点播|听一下|找一下)[:：\s]*(?:一首|歌曲|歌)?\s*([^，。！？,.!?；;\n]{2,60}?)(?:这首歌|这首|这歌|这首歌曲|$|[，。！？,.!?；;])/g;
  for (const match of value.matchAll(directPattern)) {
    titles.push(match[1]);
  }

  const seen = new Set();
  return titles
    .map(cleanRequestedSongTitle)
    .filter(isSpecificSongTitle)
    .filter((title) => {
      const key = normalizeTitle(title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

export function trackMatchesRequestedTitle(track, requestedTitle) {
  if (!requestedTitle) return false;
  return requestedSongScore(track, requestedTitle) > 0;
}

export function trackMatchesLanguage(track, languageIntent) {
  if (!languageIntent) return true;
  const language = String(track?.language || '').toLowerCase();
  if (language === languageIntent) return true;
  if (languageIntent === 'english') return inferTrackLanguage(track) === 'english';
  if (languageIntent === 'chinese') return inferTrackLanguage(track) === 'chinese';
  return false;
}

function languageScore(track, languageIntent) {
  if (!languageIntent) return 0;
  return trackMatchesLanguage(track, languageIntent) ? 1 : 0;
}

function requestedSongScore(track, requestedTitle) {
  const wanted = normalizeTitle(requestedTitle);
  const title = normalizeTitle(track?.title || '');
  if (!wanted || !title) return 0;
  if (title === wanted) return 3;
  if (title.startsWith(wanted)) return 2;
  if (title.includes(wanted) || wanted.includes(title)) return 1;
  return 0;
}

function cleanRequestedSongTitle(title) {
  return String(title || '')
    .replace(/^(?:我想|想|要|请|帮我|给我|推荐|播放|放|听|点播)\s*/, '')
    .replace(/(?:这首歌|这首歌曲|这首|这歌|歌曲|歌)$/g, '')
    .trim();
}

function isSpecificSongTitle(title) {
  const value = cleanRequestedSongTitle(title);
  if (value.length < 2) return false;
  if (/(?:英文|英语|欧美|英伦|中文|国语|华语|粤语|老歌|新歌|安静一点|几首|一些|适合|推荐)/.test(value)) return false;
  if (/^(?:英文|英语|欧美|英伦|中文|国语|华语|粤语|老歌|新歌|歌|歌曲|音乐|歌单|计划|英文歌|中文歌|粤语歌)$/.test(value)) return false;
  return true;
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)|（[^）]*）/g, '')
    .replace(/[《》"'“”‘’\s·•.,，。！？!?;；:：_-]/g, '')
    .trim();
}

function inferTrackLanguage({ title = '', artist = '', sourceLabel = '' } = {}) {
  const source = String(sourceLabel);
  if (/欧美|英文|英语/i.test(source)) return 'english';
  if (/华语|中文|国语|粤语/i.test(source)) return 'chinese';

  const text = `${title} ${artist}`;
  if (/[\u4e00-\u9fff]/.test(text)) return 'chinese';
  if (/[a-z]/i.test(text)) return 'english';
  return '';
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
  const lyric = parseLyric(data?.lrc?.lyric || data?.klyric?.lyric || data?.tlyric?.lyric || '');
  return { ...withUrl, lyric };
}

export function parseLyric(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // 解析 LRC offset 标签，修正所有时间戳
  let offsetMs = 0;
  const offsetMatch = String(value || '').match(/^\[offset:([+-]?\d+)\]/im);
  if (offsetMatch) {
    offsetMs = Number(offsetMatch[1]) || 0;
  }

  const timed = lines
    .map((line) => {
      const match = line.match(/^\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?](.*)$/);
      if (!match) return null;
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const ms = Number((match[3] || '0').padEnd(3, '0'));
      const text = match[4].trim();
      if (!text) return null;
      const rawTime = minutes * 60 + seconds + ms / 1000;
      const adjustedTime = Math.max(0, rawTime + offsetMs / 1000);
      return {
        time: adjustedTime,
        text,
        synced: true
      };
    })
    .filter(Boolean)
    .slice(0, 80);

  if (timed.length) return timed;

  return lines
    .filter((line) => !/^\[[a-z]+:/i.test(line))
    .slice(0, 80)
    .map((text, index) => ({
      time: index * 6,
      text,
      synced: false
    }));
}

export function buildDemoQueue(tracks, limit = 4) {
  return tracks.slice(0, limit).map((track, index) => ({
    ...track,
    queueIndex: index,
    url: track.url || null
  }));
}
