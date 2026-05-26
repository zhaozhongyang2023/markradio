import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const serverEntry = path.join(projectRoot, 'server', 'index.js');

const TEST_API_PORT = 19876;
const TEST_WEB_PORT = 19880;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {},
      timeout: 15000
    };
    const req = http.request(`http://127.0.0.1:${TEST_API_PORT}${urlPath}`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const api = { get: (p) => request('GET', p), post: (p, b) => request('POST', p, b), put: (p, b) => request('PUT', p, b) };

async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try { const r = await api.get('/api/health'); if (r.status === 200 && r.body) return; }
    catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Server did not start');
}

let server;

test.before(async () => {
  return new Promise((resolve, reject) => {
    server = spawn('node', [serverEntry], {
      cwd: projectRoot,
      env: {
        ...process.env,
        MOODWAVE_API_PORT: String(TEST_API_PORT), MOODWAVE_WEB_PORT: String(TEST_WEB_PORT),
        MOODWAVE_HOST: '127.0.0.1', APP_MODE: 'standard',
        MARKRADIO_API_PORT: '', MARKRADIO_WEB_PORT: '', MARKRADIO_HOST: '', MARKRADIO_WEB_ORIGIN: '',
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let started = false;
    const timeout = setTimeout(() => { if (!started) reject(new Error('start timeout')); }, 20000);
    const onData = (data) => {
      const text = data.toString();
      if (text.includes(String(TEST_API_PORT)) || text.includes('listening')) {
        started = true; clearTimeout(timeout);
        setTimeout(async () => { try { await waitForServer(); resolve(); } catch (e) { reject(e); } }, 1000);
      }
    };
    server.stdout.on('data', onData); server.stderr.on('data', onData);
    server.on('error', (err) => { clearTimeout(timeout); reject(err); });
    server.on('exit', (code) => { if (!started) { clearTimeout(timeout); reject(new Error(`exited ${code}`)); } });
  });
});

test.after(() => { if (server) server.kill('SIGTERM'); });

test('GET /api/health', async () => {
  const { status, body } = await api.get('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.name, 'MoodWave');
});

test('GET /api/status', async () => {
  const { status, body } = await api.get('/api/status');
  assert.equal(status, 200);
  assert.ok('app' in body);
  assert.ok('station' in body);
  assert.ok('ai' in body);
  assert.ok('voice' in body);
  assert.ok('music' in body);
  assert.ok('features' in body);
});

test('GET /api/mood', async () => {
  const { status, body } = await api.get('/api/mood');
  assert.equal(status, 200);
  assert.ok(body.current);
  assert.ok(Array.isArray(body.moods));
});

test('GET /api/game/preset', async () => {
  const { status, body } = await api.get('/api/game/preset?gameName=%E5%88%BA%E5%AE%A2%E4%BF%A1%E6%9D%A1%C2%B7%E5%BD%B1');
  assert.equal(status, 200);
  assert.equal(body.fallback, false);
  assert.equal(body.preset.id, 'assassins-creed-shadows');
  assert.ok(Array.isArray(body.scenes));
});

test('GET /api/game/presets', async () => {
  const { status, body } = await api.get('/api/game/presets');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.presets));
  assert.ok(body.presets.some((preset) => preset.id === 'assassins-creed-shadows' && preset.source === 'builtin'));
  assert.ok(Array.isArray(body.errors));
});

test('GET /api/game/preset supports presetId', async () => {
  const { status, body } = await api.get('/api/game/preset?presetId=assassins-creed-shadows&gameName=unknown');
  assert.equal(status, 200);
  assert.equal(body.fallback, false);
  assert.equal(body.preset.id, 'assassins-creed-shadows');
});

test('community game preset CRUD', async () => {
  const id = `test-pack-${Date.now()}`;
  const preset = {
    id,
    displayName: 'Test Pack',
    gameNames: ['Test Game'],
    scenes: [{ id: 'default', label: 'Default' }]
  };
  const created = await api.post('/api/game/presets', { preset });
  assert.equal(created.status, 200);
  assert.equal(created.body.preset.id, id);

  const selected = await api.get(`/api/game/preset?presetId=${id}`);
  assert.equal(selected.status, 200);
  assert.equal(selected.body.preset.id, id);

  const deleted = await request('DELETE', `/api/game/presets/${id}`);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.ok, true);
});

test('community game preset rejects builtin overwrite', async () => {
  const { status, body } = await api.post('/api/game/presets', {
    preset: {
      id: 'assassins-creed-shadows',
      displayName: 'Overwrite',
      scenes: [{ id: 'default', label: 'Default' }]
    }
  });
  assert.equal(status, 409);
  assert.equal(body.ok, false);
});

test('POST /api/game/presets/reload', async () => {
  const { status, body } = await api.post('/api/game/presets/reload', {});
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.presets));
});

test('POST /api/ai/game-whisper returns Witcher line', async () => {
  const { status, body } = await api.post('/api/ai/game-whisper', {
    gameName: '巫师3',
    presetId: 'the-witcher-3',
    event: 'start'
  });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'preset');
  assert.ok(body.text);
});

test('POST /api/ai/game-whisper returns Assassin line', async () => {
  const { status, body } = await api.post('/api/ai/game-whisper', {
    gameName: '刺客信条·影',
    presetId: 'assassins-creed-shadows',
    event: 'night'
  });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'preset');
  assert.ok(body.text);
});

test('POST /api/ai/game-whisper returns fallback for unknown game', async () => {
  const { status, body } = await api.post('/api/ai/game-whisper', {
    gameName: '未知游戏',
    gameVibe: '探索地图',
    event: 'track_change'
  });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'fallback');
  assert.ok(body.text);
});

test('PUT /api/mood', async () => {
  const { status, body } = await api.put('/api/mood', { mood: '开心' });
  assert.equal(status, 200);
  assert.equal(body.current, '开心');
  await api.put('/api/mood', { mood: '平静' });
});

test('GET /api/now', async () => {
  const { status, body } = await api.get('/api/now');
  assert.equal(status, 200);
  assert.ok(typeof body === 'object');
});

test('GET /api/taste', async () => {
  const { status, body } = await api.get('/api/taste');
  assert.equal(status, 200);
  assert.ok(body.taste);
  assert.ok(body.routines);
});

test('PUT /api/taste', async () => {
  const { status, body } = await api.put('/api/taste', { taste: '摇滚', routines: '夜', moodRules: '开' });
  assert.equal(status, 200);
  assert.equal(body.taste, '摇滚');
});

test('GET /api/voice', async () => {
  const { status, body } = await api.get('/api/voice');
  assert.equal(status, 200);
  assert.ok('provider' in body);
  assert.ok('style' in body);
});

test('GET /api/special-dates', async () => {
  const { status, body } = await api.get('/api/special-dates');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.dates));
});

test('GET /api/plan/today', async () => {
  const { status } = await api.get('/api/plan/today');
  assert.ok(status === 200 || status === 204);
});

test('POST /api/plan/today keeps ordinary radio mode', async () => {
  const { status, body } = await api.post('/api/plan/today', { mood: '平静' });
  assert.equal(status, 200);
  assert.equal(body.mode, 'radio');
  assert.equal(body.mood, '平静');
  assert.equal(body.regenerate, null);
  assert.ok(Array.isArray(body.queue));
});

test('POST /api/plan/today accepts game parameters', async () => {
  const { status, body } = await api.post('/api/plan/today', {
    mode: 'game',
    gameName: '巫师3',
    gameVibe: '猎魔人上路',
    presetId: 'the-witcher-3',
    autoContinue: true
  });
  assert.equal(status, 200);
  assert.equal(body.mode, 'game');
  assert.equal(body.regenerate.gameName, '巫师3');
  assert.equal(body.regenerate.presetId, 'the-witcher-3');
  assert.ok(body.plan.gameVibeSentence || body.regenerate.gameVibe);
});

test('POST /api/plan/today does not persist invalid presetId', async () => {
  const { status, body } = await api.post('/api/plan/today', {
    mode: 'game',
    gameName: '巫师3',
    gameVibe: '猎魔人上路',
    presetId: 'missing-preset',
    autoContinue: true
  });
  assert.equal(status, 200);
  assert.equal(body.mode, 'game');
  assert.equal(body.regenerate.presetId, 'the-witcher-3');
});

test('GET /api/profile/music-dna', async () => {
  const { status, body } = await api.get('/api/profile/music-dna');
  assert.equal(status, 200);
  assert.ok('dna' in body);
});

test('GET /api/profile/music-dna/history', async () => {
  const { status, body } = await api.get('/api/profile/music-dna/history');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.history));
});

test('POST /api/switch-mode', async () => {
  const { status, body } = await api.post('/api/switch-mode', { mode: 'radio' });
  assert.equal(status, 200);
  assert.ok(body.ok);
  assert.ok('now' in body);
});

test('WebSocket /ws/stream upgrades', async () => {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${TEST_API_PORT}/ws/stream`, {
      headers: { Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' }
    });
    req.on('upgrade', (res, socket) => { assert.equal(res.statusCode, 101); socket.end(); resolve(); });
    req.on('error', reject); req.end();
    setTimeout(() => reject(new Error('WS timeout')), 5000);
  });
});
