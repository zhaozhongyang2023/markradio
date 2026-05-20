import { callNetease } from '../netease-auth.js';

export async function getLikedSongs(store, limit = 500) {
  const res = await callNetease('/likelist', { limit }, store);
  return (res?.ids || []).map(String);
}

export async function getUserPlaylists(store) {
  const res = await callNetease('/user/playlist', { uid: store.get('neteaseAuth')?.profile?.userId || '' }, store);
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


export async function getUserAlbums(store) {
  const res = await callNetease('/album/sublist', { limit: 100 }, store).catch(() => ({ data: [] }));
  return (res?.data || []).map((a) => ({
    id: String(a.id),
    name: a.name,
    artist: (a.artists || []).map((ar) => ar.name).join('/') || a.artist?.name || '',
    size: a.size || 0
  }));
}

export async function collectNeteaseLibrary(store) {
  const liked = await getLikedSongs(store).catch(() => []);
  const playlists = await getUserPlaylists(store).catch(() => []);
  const albums = await getUserAlbums(store).catch(() => []);
  const playlistSamples = [];
  for (const pl of playlists.slice(0, 5)) {
    const tracks = await getPlaylistTracks(store, pl.id).catch(() => []);
    playlistSamples.push({ name: pl.name, tracks: tracks.slice(0, 20).map((t) => t.name) });
  }
  return {
    likedCount: liked.length,
    playlistCount: playlists.length,
    playlistSamples,
    albumCount: albums.length,
    albumSamples: albums.slice(0, 5).map((a) => a.name)
  };
}
