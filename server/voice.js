import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { promisify } from 'node:util';
import { config } from './config.js';
import { assertServiceAvailable, markServiceFailure, markServiceSuccess } from './circuit-breaker.js';

const cacheDir = path.resolve(process.cwd(), 'data/cache/tts');
fs.mkdirSync(cacheDir, { recursive: true });
const execAsync = promisify(exec);

export function ttsHash(text, mood, voiceStyle, nonce = '') {
  return crypto.createHash('sha256')
    .update(`${text}\n${mood}\n${voiceStyle}\n${config.voiceProvider}\n${config.fishVoiceId}\n${config.localTtsSpeed}\n${config.localTtsNfeStep}\n${config.localTtsMaxCharsPerChunk}\n${nonce}\nv3`)
    .digest('hex')
    .slice(0, 24);
}

export async function synthesizeVoice({ store, text, mood, voiceStyle, nonce = '' }) {
  const hash = ttsHash(text, mood, voiceStyle, nonce);
  const cached = store.getTtsCache(hash);
  if (cached && fs.existsSync(cached.path)) {
    // 安全校验：缓存的文本必须与请求文本一致，防止哈希碰撞或脏数据
    if (cached.text === text) {
      return { ok: true, cached: true, url: `/tts/${hash}.mp3`, hash };
    }
    // 不匹配则清除脏缓存
    fs.unlinkSync(cached.path);
    store.db.prepare('DELETE FROM tts_cache WHERE hash = ?').run(hash);
  }

  const filePath = path.join(cacheDir, `${hash}.mp3`);
  if (resolveVoiceProvider(store) === 'local-voice') {
    return synthesizeLocalVoice({ store, text, mood, voiceStyle, hash, filePath });
  }

  if (!config.fishApiKey || !config.fishVoiceId) {
    store.putTtsCache({ hash, text, mood, filePath: '' });
    return {
      ok: false,
      cached: false,
      url: null,
      hash,
      message: '未配置 Fish Audio，保留文字 DJ。'
    };
  }

  assertServiceAvailable("fish-audio");
  const requestBody = JSON.stringify({
    text,
    reference_id: config.fishVoiceId,
    format: 'mp3',
    normalize: true,
    latency: 'normal'
  });
  const apiUrl = new URL(`${config.fishApiBase.replace(/\/$/, '')}/v1/tts`);

  // 重试逻辑：最多 3 次，指数退避
  let buffer;
  let lastError;
  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      buffer = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: apiUrl.hostname,
          port: apiUrl.port || 443,
          path: apiUrl.pathname,
          method: 'POST',
          rejectUnauthorized: false,
          timeout: 30000,
          headers: {
            Authorization: `Bearer ${config.fishApiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
          }
        }, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Fish Audio ${res.statusCode}`));
            }
          });
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Fish Audio request timeout')); });
        req.write(requestBody);
        req.end();
      });
      markServiceSuccess('fish-audio');
      break; // 成功，退出重试循环
    } catch (error) {
      lastError = error;
      markServiceFailure("fish-audio");      // 重试耗尽，由调用方处理
    }
  }

  if (!buffer) {
    throw lastError || new Error('Fish Audio TTS failed after retries');
  }

  fs.writeFileSync(filePath, buffer);
  store.putTtsCache({ hash, text, mood, filePath });
  return { ok: true, cached: false, url: `/tts/${hash}.mp3`, hash };
}

export function getVoicePublicConfig(store) {
  const voice = store.get('voice') || {};
  const provider = resolveVoiceProvider(store);
  const hasLocalSample = fs.existsSync(config.localVoiceSamplePath);
  return {
    provider,
    voiceId: voice.voiceId || (provider === 'local-voice' ? 'chuanglaoli' : config.fishVoiceId) || '',
    configured: provider === 'local-voice'
      ? Boolean(config.localTtsCommand && hasLocalSample)
      : Boolean(config.fishApiKey && (voice.voiceId || config.fishVoiceId)),
    localSample: {
      configured: hasLocalSample,
      path: config.localVoiceSamplePath
    },
    localTts: {
      configured: Boolean(config.localTtsCommand)
    },
    style: voice.style || ''
  };
}

export function updateVoiceConfig(store, body) {
  const current = store.get('voice') || {};
  const next = {
    provider: String(body.provider || current.provider || config.voiceProvider || 'local-voice'),
    voiceId: String(body.voiceId || current.voiceId || 'chuanglaoli'),
    style: String(body.style || current.style || '')
  };
  store.set('voice', next);
  return getVoicePublicConfig(store);
}

export function ttsFilePath(hash) {
  return path.join(cacheDir, `${hash}.mp3`);
}

function resolveVoiceProvider(store) {
  const voice = store.get('voice') || {};
  return config.voiceProvider || voice.provider || 'local-voice';
}

async function synthesizeLocalVoice({ store, text, mood, voiceStyle, hash, filePath }) {
  if (config.localTtsCommand) {
    await execAsync(config.localTtsCommand, {
      timeout: config.localTtsTimeoutMs,
      env: {
        ...process.env,
        MARKRADIO_TTS_TEXT: text,
        MARKRADIO_TTS_MOOD: mood,
        MARKRADIO_TTS_STYLE: voiceStyle,
        MARKRADIO_TTS_REFERENCE: config.localVoiceSamplePath,
        MARKRADIO_TTS_OUTPUT: filePath
      }
    });
    if (!fs.existsSync(filePath)) throw new Error('本地 TTS 命令未生成音频文件');
    store.putTtsCache({ hash, text, mood, filePath });
    return { ok: true, cached: false, provider: 'local-voice', mode: 'command', url: `/tts/${hash}.mp3`, hash };
  }

  if (!fs.existsSync(config.localVoiceSamplePath)) {
    store.putTtsCache({ hash, text, mood, filePath: '' });
    return {
      ok: false,
      cached: false,
      provider: 'local-voice',
      url: null,
      hash,
      message: `本地声音样本不存在：${config.localVoiceSamplePath}`
    };
  }

  store.putTtsCache({ hash, text, mood, filePath: '' });
  return {
    ok: false,
    cached: false,
    provider: 'local-voice',
    mode: 'reference-ready',
    url: null,
    hash,
    message: '本地声音样本已配置；需要配置 LOCAL_TTS_COMMAND 调用本地声音克隆模型生成朗读。'
  };
}
