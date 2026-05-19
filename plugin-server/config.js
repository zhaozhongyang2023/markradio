import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const envPaths = [
  process.env.MOODWAVE_CONFIG,
  path.join(os.homedir(), '.config', 'moodwave', 'config.env'),
  path.resolve(process.cwd(), '.env')
].filter(Boolean);

for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function firstExistingPath(paths) {
  return paths.find((item) => fs.existsSync(item)) || paths[0];
}

export const config = {
  appMode: process.env.APP_MODE || 'standard',
  host: process.env.MOODWAVE_HOST || process.env.MARKRADIO_HOST || '0.0.0.0',
  apiPort: Number(process.env.PLUGIN_API_PORT || process.env.MOODWAVE_API_PORT || process.env.MOODWAVE_PORT || process.env.MARKRADIO_API_PORT || 38766),
  webPort: Number(process.env.MOODWAVE_WEB_PORT || process.env.MARKRADIO_WEB_PORT || 8080),
  webOrigin: process.env.MOODWAVE_WEB_ORIGIN || process.env.MARKRADIO_WEB_ORIGIN || (() => { try { return `http://${os.hostname()}.local:${Number(process.env.MOODWAVE_WEB_PORT || process.env.MOODWAVE_PORT || process.env.MARKRADIO_WEB_PORT || 8080)}`; } catch { return 'http://localhost:8080'; } })(),
  aiProvider: process.env.AI_PROVIDER || (process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai'),
  aiBaseUrl: process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || (process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : ''),
  aiApiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
  aiModel: process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : process.env.OPENAI_MODEL || 'gpt-5.5'),
  openaiApiKey: process.env.OPENAI_API_KEY || (process.env.AI_PROVIDER === 'openai' ? process.env.AI_API_KEY : '') || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.5',
  voiceProvider: process.env.VOICE_PROVIDER || 'local-voice',
  localVoiceSamplePath: process.env.LOCAL_VOICE_SAMPLE_PATH || firstExistingPath([
    path.resolve(process.cwd(), 'voice', 'chuanglaoli.mp3'),
    path.resolve(process.cwd(), 'voice', 'reference.wav'),
    path.join(os.homedir(), 'Music', 'chuanglaoli.mp3'),
  ]),
  localTtsCommand: process.env.LOCAL_TTS_COMMAND || '',
  localTtsTimeoutMs: Number(process.env.LOCAL_TTS_TIMEOUT_MS || 30000),
  localTtsSpeed: process.env.LOCAL_TTS_SPEED || '1',
  localTtsNfeStep: process.env.LOCAL_TTS_NFE_STEP || '32',
  localTtsMaxCharsPerChunk: process.env.LOCAL_TTS_MAX_CHARS_PER_CHUNK || '120',
  fishApiKey: process.env.FISH_AUDIO_API_KEY || '',
  fishVoiceId: process.env.FISH_AUDIO_VOICE_ID || '',
  fishApiBase: process.env.FISH_AUDIO_API_BASE || 'https://api.fish.audio',
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
  openWeatherCity: process.env.OPENWEATHER_CITY || '',
  neteaseApiBase: process.env.NETEASE_API_BASE || '',
  musicDir: process.env.MUSIC_DIR || '',
  enableTts: process.env.ENABLE_TTS !== 'false',
  enableWeather: process.env.ENABLE_WEATHER !== 'false',
  enableHoliday: process.env.ENABLE_HOLIDAY !== 'false',
  enableLocation: process.env.ENABLE_LOCATION !== 'false'
};
