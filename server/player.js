// ─── 服务端顺序音频播放器 ───
import { spawn } from 'node:child_process';
import { config } from './config.js';

let currentProcess = null;
let activeSequenceId = 0;
let pendingTimer = null;

export function getPlayerState() {
  return { state: currentProcess ? 'playing' : 'idle', pid: currentProcess?.pid || null };
}

// 强制终止当前播放序列（递增 ID 使所有旧回调失效）
function killCurrent() {
  ++activeSequenceId;
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  if (currentProcess) {
    try { currentProcess.kill('SIGKILL'); } catch {}
    currentProcess = null;
  }
}

// 启动新播放序列：按顺序播放 urls，全部播完后调用 onEnd
export function playSequence(urls, { onEnd = null, onTrackStart = null } = {}) {
  killCurrent();
  if (!urls || !urls.length) return getPlayerState();
  const seqId = ++activeSequenceId;
  playOne(urls, 0, onEnd, onTrackStart, seqId);
  return getPlayerState();
}

function playOne(urls, index, onEnd, onTrackStart, seqId) {
  if (seqId !== activeSequenceId) return; // 序列已过期
  if (index >= urls.length) {
    if (onEnd) pendingTimer = setTimeout(() => { pendingTimer = null; onEnd(); }, 300);
    return;
  }
  const url = urls[index];
  // ffplay 无法解析相对路径，转成全 HTTP URL
  const resolvedUrl = url.startsWith('/') ? `http://127.0.0.1:${config.apiPort}${url}` : url;
  // 非 TTS URL = 实际歌曲，触发 onTrackStart
  if (onTrackStart && !resolvedUrl.includes('/tts/')) onTrackStart();
  const startTime = Date.now();
  const proc = spawn('/usr/bin/ffplay', [
    '-nodisp', '-autoexit', '-loglevel', 'error', '-infbuf', resolvedUrl
  ], { stdio: 'ignore' });

  proc.on('spawn', () => {
    if (seqId !== activeSequenceId) { try { proc.kill('SIGKILL'); } catch {} return; }
    currentProcess = proc;
  });

  proc.on('exit', () => {
    if (currentProcess === proc) currentProcess = null;
    if (seqId !== activeSequenceId) return;
    if (Date.now() - startTime < 2000) { /* 播太快 → 跳过继续下一个 */ }
    playOne(urls, index + 1, onEnd, onTrackStart, seqId);
  });

  proc.on('error', () => {
    if (currentProcess === proc) currentProcess = null;
    if (seqId !== activeSequenceId) return;
    playOne(urls, index + 1, onEnd, onTrackStart, seqId);
  });
}

export function stop() {
  killCurrent();
  return getPlayerState();
}
