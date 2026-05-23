import { callNetease, getNeteaseLoginStatus } from '../netease-auth.js';

async function ensureNeteaseProfile(store) {
  const auth = store.get('neteaseAuth');
  if (!auth?.cookie || auth.profile?.userId) return auth?.profile?.userId || null;
  try {
    const status = await getNeteaseLoginStatus(store);
    if (status.loggedIn && status.profile) {
      store.set('neteaseAuth', { ...auth, profile: status.profile });
      return status.profile.userId;
    }
  } catch { /* 静默失败，不影响主流程 */ }
  return null;
}

export async function getLikedSongs(store, limit = 500) {
  const res = await callNetease('/likelist', { limit }, store);
  return (res?.ids || []).map(String);
}

export async function getUserPlaylists(store) {
  const uid = await ensureNeteaseProfile(store);
  const res = await callNetease('/user/playlist', { uid: uid || '' }, store);
  return (res?.playlist || []).map((pl) => ({
    id: String(pl.id),
    name: pl.name,
    trackCount: pl.trackCount || 0
  }));
}

export async function getPlaylistTracks(store, playlistId) {
  const res = await callNetease('/playlist/track/all', { id: playlistId, limit: 500 }, store);
  return (res?.songs || []).map((s) => ({
    id: String(s.id),
    name: s.name,
    artists: (s.ar || []).map((a) => a.name).join('/')
  }));
}

export async function getPlaylistDetail(store, playlistId) {
  const res = await callNetease('/playlist/detail', { id: playlistId }, store).catch(() => ({}));
  const pl = res?.playlist || {};
  return {
    id: String(pl.id || playlistId),
    name: pl.name || '',
    description: (pl.description || '').slice(0, 300),
    tags: (pl.tags || []).slice(0, 5)
  };
}

export async function getUserAlbums(store) {
  const res = await callNetease('/album/sublist', { limit: 100 }, store).catch(() => ({ data: [] }));
  return (res?.data || []).map((a) => ({
    id: String(a.id),
    name: a.name,
    artist: (a.artists || []).map((ar) => ar.name).join('/') || a.artist?.name || '',
    size: a.size || 0
  }));
}

export async function getNeteaseLibraryCounts(store) {
  try {
    const uid = await ensureNeteaseProfile(store);
    if (!uid) return null;
    const [likedRes, playlistRes, albumRes] = await Promise.all([
      callNetease('/likelist', { limit: 1 }, store).catch(() => null),
      callNetease('/user/playlist', { uid }, store).catch(() => null),
      callNetease('/album/sublist', { limit: 1 }, store).catch(() => null)
    ]);
    return {
      likedCount: Array.isArray(likedRes?.ids) ? likedRes.ids.length : null,
      playlistCount: Array.isArray(playlistRes?.playlist) ? playlistRes.playlist.length : null,
      albumCount: typeof albumRes?.total === 'number' ? albumRes.total : (Array.isArray(albumRes?.data) ? albumRes.data.length : null)
    };
  } catch {
    return null;
  }
}

export async function collectNeteaseLibrary(store) {
  const liked = await getLikedSongs(store).catch(() => []);
  const playlists = await getUserPlaylists(store).catch(() => []);
  const albums = await getUserAlbums(store).catch(() => []);
  const playlistSamples = [];
  const playlistInsights = [];
  for (const pl of playlists.slice(0, 5)) {
    const [tracks, detail] = await Promise.all([
      getPlaylistTracks(store, pl.id).catch(() => []),
      getPlaylistDetail(store, pl.id).catch(() => ({}))
    ]);
    playlistSamples.push({ name: pl.name, tracks: tracks.slice(0, 20).map((t) => t.name) });
    if (detail.description || detail.tags?.length) {
      playlistInsights.push({
        name: pl.name,
        description: detail.description || '',
        tags: detail.tags || []
      });
    }
  }
  return {
    likedCount: liked.length,
    playlistCount: playlists.length,
    playlistSamples,
    playlistInsights,
    albumCount: albums.length,
    albumSamples: albums.slice(0, 5).map((a) => a.name)
  };
}
