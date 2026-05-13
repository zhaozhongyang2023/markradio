// Fish Audio 代理 — 运行在 Mac 上，转发 Pi 的 TTS 请求
import http from 'node:http';
import https from 'node:https';

const PORT = 3099;
const FISH_BASE = 'https://api.fish.audio';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const proxy = https.request(`${FISH_BASE}${req.url}`, {
    method: req.method,
    headers: { ...req.headers, host: 'api.fish.audio' },
    timeout: 30000,
    rejectUnauthorized: true,
  }, (pres) => {
    res.writeHead(pres.statusCode, pres.headers);
    pres.pipe(res);
  });
  proxy.on('error', (e) => { res.writeHead(502); res.end(e.message); });
  proxy.end(body);
});

server.listen(PORT, () => console.log(`Fish proxy on :${PORT}`));
