#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const text = process.env.MOODWAVE_TTS_TEXT || process.env.MARKRADIO_TTS_TEXT || '';
const reference = process.env.MOODWAVE_TTS_REFERENCE || process.env.MARKRADIO_TTS_REFERENCE || '';
const output = process.env.MOODWAVE_TTS_OUTPUT || process.env.MARKRADIO_TTS_OUTPUT || '';
const refText = process.env.LOCAL_TTS_REF_TEXT || '';
const model = process.env.LOCAL_TTS_MODEL || 'F5TTS_v1_Base';
const nfeStep = process.env.LOCAL_TTS_NFE_STEP || '16';
const speed = process.env.LOCAL_TTS_SPEED || '1';
const device = process.env.LOCAL_TTS_DEVICE || 'cpu';
const maxCharsPerChunk = Number(process.env.LOCAL_TTS_MAX_CHARS_PER_CHUNK || 120);
const removeSilence = process.env.LOCAL_TTS_REMOVE_SILENCE === '1';
const cli = process.env.MOODWAVE_F5_TTS_CLI || process.env.MARKRADIO_F5_TTS_CLI || resolve(process.cwd(), '.venv-tts/bin/f5-tts_infer-cli');
const commandEnv = {
  ...process.env,
  PATH: ['/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', path.join(os.homedir(), '.local', 'bin'), process.env.PATH || ''].filter(Boolean).join(':')
};

if (!text.trim()) fail('MOODWAVE_TTS_TEXT 为空');
if (!reference || !existsSync(reference)) fail(`参考音频不存在：${reference}`);
if (!output) fail('MOODWAVE_TTS_OUTPUT 为空');
if (!existsSync(cli)) fail(`F5-TTS 命令不存在：${cli}`);

const outDir = dirname(output);
mkdirSync(outDir, { recursive: true });
const wavOutput = output.replace(/\.mp3$/i, '.wav');
const chunks = splitText(text);
const genFile = wavOutput.replace(/\.wav$/i, '.gen.txt');
writeFileSync(genFile, chunks.map((chunk) => `[main]${chunk}`).join('\n'));

const f5Args = [
  '--model', model,
  '--ref_audio', reference,
  '--ref_text', refText,
  '--gen_file', genFile,
  '--output_dir', outDir,
  '--output_file', wavOutput.split('/').pop(),
  '--nfe_step', nfeStep,
  '--speed', speed,
  '--device', device
];
if (removeSilence) f5Args.push('--remove_silence');
run(cli, f5Args);

const ffmpegCandidates = [
  process.env.FFMPEG_BIN,
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
].filter(Boolean);
const ffmpeg = ffmpegCandidates.find((p) => existsSync(p)) || ffmpegCandidates[0];
if (!existsSync(wavOutput)) fail(`F5-TTS 未生成 wav：${wavOutput}`);

if (existsSync(ffmpeg)) {
  run(ffmpeg, ['-y', '-i', wavOutput, '-codec:a', 'libmp3lame', '-q:a', '3', output]);
} else {
  renameSync(wavOutput, output);
}

if (!existsSync(output)) fail(`本地 TTS 未生成输出：${output}`);

function splitText(value) {
  const clauses = value
    .replace(/\s+/g, ' ')
    .match(/[^。！？!?；;，,、]+[。！？!?；;，,、]?/g) || [value];
  const chunks = [];
  let current = '';
  for (const clause of clauses) {
    const next = `${current}${clause}`.trim();
    if (current && next.length > maxCharsPerChunk) {
      chunks.push(current.trim());
      current = clause;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((item) => item.replace(/[，,、]\s*$/u, '。'));
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: commandEnv });
  if (result.status !== 0) fail(`${command} 执行失败`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
