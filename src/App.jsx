import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { api, apiAssetUrl, castActionBeacon, streamUrl } from './api.js';

const moodLabels = [
  { name: '开心', iconKey: 'happy', icon: '☼', en: 'Joy', tone: '#f0c96a' },
  { name: '平静', iconKey: 'calm', icon: '∿', en: 'Calm', tone: '#74d8c4' },
  { name: '忧郁', iconKey: 'melancholy', icon: '◐', en: 'Muse', tone: '#9daee8' },
  { name: '悲伤', iconKey: 'sad', icon: '☂', en: 'Blue', tone: '#82b5df' },
  { name: '治愈', iconKey: 'heal', icon: '✚', en: 'Heal', tone: '#82cf8b' },
  { name: '愤怒', iconKey: 'anger', icon: '⚡', en: 'Fire', tone: '#ef8d62' }
];

const moodIcon = {
  开心: '☼',
  平静: '∿',
  忧郁: '◐',
  悲伤: '☂',
  治愈: '✚',
  愤怒: '⚡'
};

const BED_VOLUME = 0.10;
const CARD_BED_VOLUME = 0.075;
const PARTICLE_BARS = 48;
const PULSE_PARTICLE_COUNT = 48;
const PULSE_DAMPING = 0.98;
const PULSE_PIXEL_SIZE = 10;
const PULSE_RING_COUNT = 4;
const LOW_POWER_READ_PROGRESS_MS = 110;
const CAST_LEASE_TTL_MS = 15 * 60 * 1000;
const CAST_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const CAST_PLAYBACK_LEASE_BUFFER_MS = 2 * 60 * 1000;
const SILENT_AUDIO_URL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

function detectLowPowerRuntime() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0;
  const screenW = typeof window !== 'undefined' ? window.screen?.width || 0 : 0;
  const screenH = typeof window !== 'undefined' ? window.screen?.height || 0 : 0;
  const forced = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lowPower');
  const kioskPortrait = /Linux/i.test(ua) && Math.min(screenW, screenH) <= 1200 && Math.max(screenW, screenH) >= 1600;
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Mobile/i.test(ua);
  return forced ||
    !isMobile && /Raspberry|armv|aarch64|Linux arm/i.test(`${ua} ${platform}`) ||
    kioskPortrait ||
    !isMobile && (cores > 0 && cores <= 4) ||
    !isMobile && (memory > 0 && memory <= 4);
}

function formatTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(1, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function weatherIcon(condition = '') {
  if (condition.includes('雨')) return '☔';
  if (condition.includes('雪')) return '✳';
  if (condition.includes('云')) return '☁';
  if (condition.includes('晴')) return '☀';
  return '✦';
}

function pixelCafe() {
  return (
    <div className="pixel-cup" aria-hidden="true">
      <span />
      <i />
    </div>
  );
}

function V4PersonaAvatar({ role }) {
  const id = useId();
  const isUser = role === 'user';
  const coreId = `${id}-core`;
  const ringId = `${id}-ring`;
  return (
    <svg
      className={`v4-avatar-glyph ${isUser ? 'user' : 'dj'}`}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={coreId} cx="50%" cy="38%" r="68%">
          <stop offset="0%" stopColor={isUser ? '#f4f0ff' : '#fff8df'} />
          <stop offset="54%" stopColor={isUser ? '#7d8dff' : '#42d8b2'} />
          <stop offset="100%" stopColor={isUser ? '#151a3b' : '#071510'} />
        </radialGradient>
        <linearGradient id={ringId} x1="6" y1="6" x2="42" y2="42">
          <stop offset="0%" stopColor={isUser ? '#f6f3ff' : '#f5d98e'} />
          <stop offset="45%" stopColor={isUser ? '#8ea0ff' : '#42d8b2'} />
          <stop offset="100%" stopColor={isUser ? '#44d8ff' : '#f6f3ec'} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#${coreId})`} />
      <circle cx="24" cy="24" r="20.2" fill="none" stroke={`url(#${ringId})`} strokeWidth="1.8" />
      <circle cx="24" cy="24" r="14.5" fill="rgba(0,0,0,0.42)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {isUser ? (
        <>
          <path d="M10 29c6.5-8.8 19-14.4 29-11.8" fill="none" stroke="rgba(255,255,255,0.64)" strokeWidth="1.25" strokeLinecap="round" strokeDasharray="2 4" />
          <path d="M15 32V18l9 8 9-8v14" fill="none" stroke="#f7f5ff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="37" cy="17" r="2.2" fill="#44d8ff" />
        </>
      ) : (
        <>
          <path d="M15 31h18M18 31l6-17 6 17M20 24h8" fill="none" stroke="#f7f0d8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 18c3-3.8 6.9-5.8 12-5.8S33 14.2 36 18M15 21c2.2-2.5 5.2-3.8 9-3.8s6.8 1.3 9 3.8" fill="none" stroke="#42d8b2" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="24" cy="14" r="2.6" fill="#f5d98e" />
        </>
      )}
    </svg>
  );
}

function segmentText(value) {
  const source = String(value || '').trim();
  if (!source) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(source)]
      .map((item) => item.segment)
      .filter((item) => item.trim());
  }
  return source.match(/[\u4e00-\u9fa5]{1,2}|[a-zA-Z0-9]+|[^\s]/g) || [];
}

function segmentTextWithOffsets(value) {
  const source = String(value || '').trim();
  const tokens = segmentText(source);
  let cursor = 0;
  return tokens.map((token) => {
    const start = source.indexOf(token, cursor);
    const safeStart = start >= 0 ? start : cursor;
    const end = safeStart + token.length;
    cursor = end;
    return { token, start: safeStart, end };
  });
}

function activeTokenIndex(segments, charCount) {
  if (!segments.length) return 0;
  const index = segments.findIndex((segment) => charCount < segment.end);
  return index === -1 ? segments.length - 1 : Math.max(0, index);
}

function currentLyricIndex(lyrics, seconds) {
  if (!lyrics?.length) return 0;
  // 若第一个歌词的时间戳还没到，返回 -1 避免提前显示
  if (lyrics[0].time > seconds) return -1;
  let index = 0;
  for (let i = 0; i < lyrics.length; i += 1) {
    if (lyrics[i].time <= seconds) index = i;
    else break;
  }
  return index;
}

function estimatedPlainLyricIndex(lyrics, seconds, duration) {
  if (!lyrics?.length) return 0;
  const total = Number(duration) || 0;
  if (total > 12) {
    const leadIn = Math.min(8, total * 0.05);
    const activeSeconds = Math.max(1, total - leadIn);
    const ratio = Math.min(0.999, Math.max(0, (Number(seconds) - leadIn) / activeSeconds));
    return Math.min(lyrics.length - 1, Math.max(0, Math.floor(ratio * lyrics.length)));
  }
  return Math.min(lyrics.length - 1, Math.max(0, currentLyricIndex(lyrics, seconds)));
}

function isCreditLine(text = '') {
  return /^(作词|作曲|编曲|制作人|词|曲)\s*[:：]/.test(String(text).trim());
}

function normalizeTitleText(value = '') {
  return String(value).toLowerCase().replace(/[\s《》"“”'’‘()（）\-_/]+/g, '');
}

function buildTrackIntroText({ isPlanIntroTrack, plan, queueIndex, track, ttsText }) {
  if (isPlanIntroTrack && ttsText) return ttsText;
  const song = track?.title ? `接下来是《${track.title}》。` : '';
  const reason = plan?.plan?.reason || '这首歌来自此刻的天气、心情和你的音乐记忆。';
  const segue = plan?.plan?.segue || '下一首，继续把情绪慢慢放平。';
  if (queueIndex === 1) return `${reason} ${song}`.replace(/\s+/g, ' ').trim();
  return `${segue} ${song}`.replace(/\s+/g, ' ').trim();
}

function buildLevelsFromFrequency(data, count) {
  return Array.from({ length: count }, (_, index) => {
    const curveStart = Math.pow(index / count, 1.35);
    const curveEnd = Math.pow((index + 1) / count, 1.35);
    const start = Math.floor(curveStart * data.length);
    const end = Math.max(start + 1, Math.floor(curveEnd * data.length));
    let total = 0;
    for (let i = start; i < end; i += 1) total += data[i] || 0;
    const value = total / (end - start) / 255;
    const skyline = 0.78 + Math.sin(index * 0.53) * 0.16 + Math.sin(index * 0.21 + 1.4) * 0.1;
    const accent = index % 11 === 0 || index % 17 === 5 ? 0.1 : 0;
    const shaped = Math.max(0, value - 0.04) * (index < count * 0.18 ? 0.62 : 1.18);
    return Math.max(0.12, Math.min(0.98, 0.16 + shaped * 1.65 * skyline + accent));
  });
}

function buildFallbackLevels(seconds, count) {
  return Array.from({ length: count }, (_, index) => {
    const slow = Math.sin(seconds * 2.1 + index * 0.24);
    const fast = Math.sin(seconds * 5.8 - index * 0.11);
    const beat = Math.max(0, Math.sin(seconds * 3.2 + index * 0.05));
    const skyline = 0.8 + Math.sin(index * 0.47) * 0.16 + Math.sin(index * 0.19 + 1.7) * 0.12;
    return Math.max(0.16, Math.min(0.98, (0.24 + Math.abs(slow) * 0.3 + Math.abs(fast) * 0.14 + beat * 0.2) * skyline));
  });
}

function buildIdleSpectrumLevels(count) {
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index * 0.46) * 0.24 + Math.sin(index * 0.18 + 1.6) * 0.18;
    const cluster = index % 9 === 0 || index % 13 === 4 ? 0.18 : 0;
    return Math.max(0.2, Math.min(0.92, 0.48 + wave + cluster));
  });
}

const SPEC_PEAKS = {};

function paintSpectrumCanvas(canvas, levels) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width || canvas.clientWidth || window.innerWidth);
  const h = Math.round(rect.height || canvas.clientHeight || 70);
  if (w <= 0 || h <= 0) return;

  const nextWidth = Math.round(w * dpr);
  const nextHeight = Math.round(h * dpr);
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const pulse = levels?.length
    ? levels.reduce((total, level) => total + level, 0) / levels.length
    : 0.16;
  ctx.clearRect(0, 0, w, h);
  // Transparent background — let hero-panel bg show through
  // Glow baseline
  ctx.fillStyle = `rgba(0, 245, 212, ${0.06 + pulse * 0.09})`;
  ctx.fillRect(0, Math.max(0, h - 14 - pulse * 8), w, 2);

  // Smaller blocks on mobile portrait
  const isMobilePortrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
  const sp = isMobilePortrait
    ? { size: 10, gap: 6, cell: 16 }
    : SPEC_PX;
  const { size, gap, cell } = sp;
  const numBars = Math.max(1, Math.floor((w - 24) / cell));
  const maxBlocks = Math.floor(h / cell);
  const gravity = 0.09;

  const barLevels = levels?.length ? levels : buildIdleSpectrumLevels(numBars);

  const insetX = Math.max(8, Math.floor((w - numBars * cell) / 2));
  for (let i = 0; i < numBars; i++) {
    const level = barLevels[i] ?? 0.18;
    // Pulse factor: each bar breathes at a slightly different phase
    const x = insetX + i * cell;
    const blockCount = Math.floor(level * maxBlocks);

    const peak = SPEC_PEAKS[i] || 0;
    if (blockCount > peak) {
      SPEC_PEAKS[i] = blockCount;
    } else {
      SPEC_PEAKS[i] = Math.max(0, peak - gravity);
    }
    const peakBlock = Math.round(SPEC_PEAKS[i] || 0);

    for (let b = 0; b < Math.max(blockCount, peakBlock + 1); b++) {
      const y = h - (b + 1) * cell;

      if (b === peakBlock && b > blockCount) {
        ctx.fillStyle = '#d8fff3';
        ctx.shadowColor = 'rgba(0, 245, 212, 0.28)';
        ctx.shadowBlur = 4;
      } else if (b >= blockCount - 2 && b < blockCount && blockCount > 2) {
        const t = (b - (blockCount - 2)) / 2;
        const cr = Math.round(192 - 65 * t);
        const cg = Math.round(245 - 14 * t);
        const cb = Math.round(225 - 32 * t);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.shadowColor = 'rgba(0,245,212,0.16)';
        ctx.shadowBlur = 3;
      } else {
        ctx.fillStyle = '#8fdcca';
        ctx.shadowColor = 'rgba(143,220,202,0.12)';
        ctx.shadowBlur = 2;
      }

      ctx.fillRect(x + gap, y + gap, size, size);
    }
  }

  ctx.shadowBlur = 0;
}

function paintLevels(container, levels) {
  if (!container) return;
  const bars = container.querySelectorAll('span');
  bars.forEach((bar, index) => {
    const level = levels?.[index] ?? 0.18;
    bar.style.setProperty('--level', level.toFixed(3));
  });
}

function lerpColor(start, end, ratio) {
  const t = Math.max(0, Math.min(1, ratio));
  const next = start.map((value, index) => Math.round(value + (end[index] - value) * t));
  return `rgb(${next[0]},${next[1]},${next[2]})`;
}

// ── 7-segment style 5×7 pixel digit patterns (1=on, 0=off, row-major) ──
const PX = {
  size: 10,  // pixel square side in px
  gap: 4,    // gap between pixels
  cols: 5,
  rows: 7,
  cell: 14,  // size + gap
  digits: {
    '0': [1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1],
    '1': [0,0,1,0,0, 0,1,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 1,1,1,1,1],
    '2': [1,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 1,1,1,1,1, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
    '3': [1,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 0,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 1,1,1,1,1],
    '4': [1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 0,0,0,0,1],
    '5': [1,1,1,1,1, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 1,1,1,1,1],
    '6': [1,1,1,1,1, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1],
    '7': [1,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 0,1,0,0,0],
    '8': [1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1],
    '9': [1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 1,1,1,1,1],
  },
  // top-left origin for each element in cell units
  layout: {
    padX: 3, padY: 3,
    digitW: 5, digitH: 7,
    gapW: 2,
    colonW: 1,
    // computed layout: D0 gap D1 gap colon gap D2 gap D3
    // x offsets in cells: 3, 8, 10, 15, 17, 18, 20, 25, 27
  },
  canvasW: 3 + 5 + 2 + 5 + 2 + 1 + 2 + 5 + 2 + 5 + 3, // = 35 cells
  canvasH: 3 + 7 + 3, // = 13 cells
};


// 11x11 pixel mood icons (1=on, 0=off, row-major).
// ── SVG 极简心情图标 ──
const moodSvgs = {
  happy: { viewBox: '0 0 24 24', path: 'M12 2a10 10 0 100 20 10 10 0 000-20zM8 9h.01M16 9h.01M8 13s2 3 4 3 4-3 4-3' },
  calm:  { viewBox: '0 0 24 24', path: 'M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0' },
  melancholy: { viewBox: '0 0 24 24', path: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z' },
  sad:   { viewBox: '0 0 24 24', path: 'M12 2a10 10 0 100 20 10 10 0 000-20zM8 9h.01M16 9h.01M8 15s2-2 4-2 4 2 4 2' },
  heal:  { viewBox: '0 0 24 24', path: 'M12 21.4C8.5 18.1 2 13.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 4.8-6.5 9.6-10 12.9z' },
  anger: { viewBox: '0 0 24 24', path: 'M13 2L4 14h5l-2 8 9-12h-5l2-8' },
};

function MoodSvgIcon({ iconKey, active, hover, tone }) {
  const svg = moodSvgs[iconKey];
  if (!svg) return null;
  const color = active ? tone : hover ? tone : '#888a8e';
  return (
    <svg
      className="mood-svg-icon"
      viewBox={svg.viewBox}
      fill="none"
      stroke={color}
      strokeWidth={active || hover ? 2.2 : 1.6}
      strokeDasharray={active || hover ? 'none' : '1 3'}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transition: 'stroke 0.25s ease, stroke-width 0.25s ease', width: '100%', height: '100%' }}
    >
      <path d={svg.path} />
    </svg>
  );
}


function drawBgDots(ctx, w, h) {
  const c = PX.cell;
  ctx.fillStyle = '#1a1a1a';
  for (let y = c / 2; y < h; y += c) {
    for (let x = c / 2; x < w; x += c) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPixelDigit(ctx, ox, oy, ch) {
  const { size, gap, cols, rows, digits, cell } = PX;
  const pattern = digits[ch] || digits['0'];
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,0.18)';
  ctx.shadowBlur = 5;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (pattern[row * cols + col]) {
        const x = ox + col * cell;
        const y = oy + row * cell;
        ctx.fillRect(x, y, size, size);
      }
    }
  }
  ctx.shadowBlur = 0;
}

function PixelClockCanvas({ hours, minutes, lowPower = false }) {
  const canvasRef = useRef(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), lowPower ? 30000 : 500);
    return () => clearInterval(id);
  }, [lowPower]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const { cell, canvasW, canvasH } = PX;
    const baseW = canvasW * cell;
    const baseH = canvasH * cell;
    const fitW = Math.max(260, Math.min(window.innerWidth - 48, baseW));
    const scale = Math.min(1, fitW / baseW);
    const logicalW = Math.round(baseW * scale);
    const logicalH = Math.round(baseH * scale);
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, baseW, baseH);
    drawBgDots(ctx, baseW, baseH);

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const chars = [hh[0], hh[1], ':', mm[0], mm[1]];

    // x positions for each element (cell units)
    const xPos = [
      PX.layout.padX,
      PX.layout.padX + PX.layout.digitW + PX.layout.gapW,
      0, // colon placeholder
      PX.layout.padX + 2 * PX.layout.digitW + 3 * PX.layout.gapW,
      PX.layout.padX + 3 * PX.layout.digitW + 4 * PX.layout.gapW,
    ];
    // colon x center
    const colonX = xPos[1] + PX.layout.digitW + PX.layout.gapW;

    // draw digits
    for (let i = 0; i < 5; i++) {
      if (chars[i] === ':') continue;
      drawPixelDigit(ctx, xPos[i] * cell, PX.layout.padY * cell, chars[i]);
    }

    // draw colon (two squares, blink together)
    const t = Date.now() / 1000;
    const blinkAlpha = lowPower ? 1 : 0.2 + 0.8 * (0.5 + 0.5 * Math.cos(t * Math.PI / 1.5)); // 1Hz breathing
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.18)';
    ctx.shadowBlur = 5;
    // top dot at row 2, bottom dot at row 4
    const colCY = PX.layout.padY * cell;
    ctx.fillRect(colonX * cell, colCY + 2 * cell, PX.size, PX.size);
    ctx.fillRect(colonX * cell, colCY + 4 * cell, PX.size, PX.size);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [hours, minutes, lowPower, tick]);

  return <canvas ref={canvasRef} className="pixel-clock-canvas" aria-hidden="true" />;
}


// ── 频谱像素块常量（匹配点阵时钟 PX 参数）──
const SPEC_PX = {
  size: 13,
  gap: 8,
  cell: 21,
};
function Spectrum({ active, progressRatio, visualRef }) {
  return (
    <canvas
      ref={visualRef}
      className={`spectrum-canvas${active ? ' is-active' : ''}`}
      aria-hidden="true"
    />
  );
}

function ParticleWave({ progressRatio, active, onSeek, onPreview, onCommit, onSeekStart, visualRef }) {
  return (
    <div className={`particle-wave ${active ? 'is-active' : ''}`} ref={visualRef}>
      <div className="particle-bars" aria-hidden="true">
        {Array.from({ length: PARTICLE_BARS }, (_, index) => {
          const played = index / PARTICLE_BARS <= progressRatio;
          return (
            <span
              className={played ? 'played' : ''}
              key={index}
              style={{ '--i': index, '--h': `${14 + ((index * 7) % 26)}px` }}
            />
          );
        })}
      </div>
      <input
        aria-label="拖动播放进度"
        max="1000"
        min="0"
        onBlur={(event) => onCommit?.(Number(event.currentTarget.value) / 1000)}
        onChange={(event) => (onPreview || onSeek)(Number(event.currentTarget.value) / 1000)}
        onInput={(event) => onPreview?.(Number(event.currentTarget.value) / 1000)}
        onKeyUp={(event) => onCommit?.(Number(event.currentTarget.value) / 1000)}
        onPointerDown={onSeekStart}
        onPointerUp={(event) => onCommit?.(Number(event.currentTarget.value) / 1000)}
        type="range"
        value={Math.round(progressRatio * 1000)}
      />
    </div>
  );
}

function DjFeed({ introSegments, lyrics, lyricIndex, lyricsSynced, plan, queue, reading, readWordIndex, showLyrics, readingCardIndex, introText, introDoneFor, cardSegments, cardWordIndex }) {
  const displayTracks = queue?.slice(0, 2) || [];
  const djText = introText || plan?.plan?.say || '';
  const showIntroPara = !showLyrics && djText && (
    (!reading && introDoneFor === null) || (reading && readingCardIndex === -1)
  );
  const activeCardIndex = reading && readingCardIndex >= 0 ? readingCardIndex : null;
  const visibleCards = (() => {
    if (activeCardIndex !== null) {
      return displayTracks.filter((_, idx) => idx === activeCardIndex);
    }
    // 仅当第二首歌为当前曲目时过滤，第一首歌播放时显示全部
    if (introDoneFor && displayTracks.length >= 2) {
      const matchIdx = displayTracks.findIndex(t => t?.id === introDoneFor);
      if (matchIdx === 1) return displayTracks.filter((t) => t?.id === introDoneFor);
    }
    return displayTracks;
  })();
  return (
    <div className={reading ? 'dj-feed is-reading' : 'dj-feed'}>
      {showLyrics ? (
        <div className="lyrics-view">
          <span className="feed-meta">MarkRadio · {lyricsSynced ? formatTime(lyrics[lyricIndex]?.time || 0) : 'LYRICS · EST'}</span>
          {[-1, 0, 1].map((offset) => {
            const idx = lyricIndex + offset;
            const line = lyrics[idx];
            if (!line?.text) return null;
            const dist = Math.abs(offset);
            const cls = lyricsSynced
              ? (dist === 0 ? 'active' : `distance-${dist}`)
              : (dist === 0 ? 'active plain' : `distance-${dist} plain`);
            return (
              <p key={idx} className={`lyric-line ${cls}`}>
                {line.text}
              </p>
            );
          })}
        </div>
      ) : (
        <>
          {showIntroPara ? (
          <p>
            <span className="feed-meta">MarkRadio · 0:01</span>
            <span className="typing-line word-line">
              {reading && readingCardIndex === -1 ? (
                introSegments.map((segment, index) => (
                  <span
                    className={
                      reading && index === readWordIndex
                        ? 'word active'
                        : index < readWordIndex
                          ? 'word read'
                          : 'word pending'
                    }
                    key={`${segment.token}-${index}`}
                  >
                    {segment.token}
                    {reading && index === readWordIndex ? <b className="cursor">▌</b> : null}
                  </span>
                ))
              ) : (
                <span>{djText}</span>
              )}
            </span>
          </p>
          ) : null}
          {visibleCards.map((track, i) => {
            const actualIndex = activeCardIndex !== null ? activeCardIndex : i;
            const title = track?.title ? `《${track.title}》${track.artist ? ' - ' + track.artist : ''}` : '';
            const isReadingThis = reading && readingCardIndex === actualIndex;
            const reason = track?.reason || plan?.plan?.segue || '';
            const isFinished = !isReadingThis && introDoneFor && track?.id !== introDoneFor;
            return (
              <div className={`dj-track-card${isReadingThis ? ' is-reading-card' : ''}${isFinished ? ' is-finished' : ''}`} key={track.id || i}>
                {reason ? (
                <p className={i === 0 ? 'soft-line' : 'muted-line'}>
                  <span className="feed-meta">MarkRadio · {i === 0 ? '0:08' : '0:14'}</span>
                  <span>
                    {isReadingThis && cardSegments.length > 0 ? (
                      cardSegments.map((segment, idx) => (
                        <span
                          className={
                            idx === cardWordIndex
                              ? 'word active'
                              : idx < cardWordIndex
                                ? 'word read'
                                : 'word pending'
                          }
                          key={`card-${segment.token}-${idx}`}
                        >
                          {segment.token}
                          {idx === cardWordIndex ? <b className="cursor">▌</b> : null}
                        </span>
                      ))
                    ) : (
                      <>{isReadingThis ? <b className="cursor">▌</b> : null}{reason}</>
                    )}
                  </span>
                </p>
                ) : null}
                {title ? <p className="dj-track-title">{title}</p> : null}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function MoodStrip({ busy, chooseMood, selectedMood }) {
  const [hoverKey, setHoverKey] = useState(null);

  return (
    <div className="mood-strip" aria-label="选择心情">
      {moodLabels.map((mood) => {
        const isActive = mood.name === selectedMood;
        const isHover = hoverKey === mood.iconKey;
        return (
          <button
            className={(isActive ? 'active' : '') + (isHover ? ' hover' : '')}
            disabled={busy}
            key={mood.name}
            onClick={() => chooseMood(mood.name)}
            onMouseEnter={() => setHoverKey(mood.iconKey)}
            onMouseLeave={() => setHoverKey(null)}
            onTouchStart={() => setHoverKey(mood.iconKey)}
            onTouchEnd={() => setHoverKey(null)}
            style={{
              '--mood-tone': mood.tone,
              '--mood-tone-soft': `${mood.tone}26`,
              '--mood-tone-mid': `${mood.tone}44`
            }}
            aria-label={`${mood.name} · ${mood.en}`}
            title={`${mood.name} · ${mood.en}`}
          >
            <MoodSvgIcon iconKey={mood.iconKey} active={isActive} hover={isHover && !isActive} tone={mood.tone} />
            <small>{mood.en}</small>
          </button>
        );
      })}
    </div>
  );
}

function QueuePreview({ queue, currentId, onRefresh, busy }) {
  return (
    <div className={busy ? 'queue-preview is-refreshing' : 'queue-preview'}>
      <div className="queue-title">
        <span>Next Signal</span>
        <button aria-label="刷新推荐" disabled={busy} onClick={onRefresh}>{busy ? '…' : '↻'}</button>
      </div>
      {queue.slice(0, 2).map((item) => (
        <div className={item.id === currentId ? 'queue-item current' : 'queue-item'} key={item.id}>
          <span>{item.title}</span>
          <small>{item.artist}</small>
        </div>
      ))}
    </div>
  );
}

function V4RadioView({
  audioNodes,
  beginTrackSeek,
  busy,
  castState,
  chatBusy,
  chatInput,
  chatMessages,
  clock,
  commitTrackSeek,
  displayProgressRatio,
  duration,
  handleChatSubmit,
  isPlaying,
  liveLyricLine,
  netease,
  nextTrack,
  onBack,
  onCastOpen,
  onLogin,
  onRefresh,
  onSelectTrack,
  onSpeechInput,
  onToggleFavorite,
  onVolumeChange,
  playback,
  pendingPlay,
  plan,
  previousTrack,
  previewTrackSeek,
  progress,
  queue,
  reading,
  servicesOk,
  setChatInput,
  speechMessage,
  speechState,
  track,
  trackIsFavorite,
  userVolume,
  eqLevelsRef,
  lowPowerMode,
  pulseCanvasRef
}) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentTrack = track?.title ? `${track.title} - ${track.artist || 'Unknown'}` : '等待选曲';
  const casting = castState === 'playing';
  const queueCount = queue?.length || 0;
  const lastMessages = chatMessages.slice(-10);
  const planTitle = plan?.plan?.planTitle
    ? `自动推荐歌曲 · ${plan.plan.planTitle}`
    : '自动推荐歌曲模块';
  const planSummary = plan?.plan?.planSummary || plan?.plan?.reason || '';

  const eqRef = useRef(null);
  const eqSpansRef = useRef(null);
  useEffect(() => {
    if (!eqRef.current) return;
    eqSpansRef.current = Array.from(eqRef.current.querySelectorAll('span'));
    let raf;
    function apply() {
      const spans = eqSpansRef.current;
      const levels = eqLevelsRef?.current;
      for (let i = 0; i < spans.length; i++) {
        spans[i].style.setProperty('--level', (levels?.[i] ?? 0.18).toFixed(3));
      }
      raf = requestAnimationFrame(apply);
    }
    raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [eqLevelsRef]);


  const renderPlanCard = (messagePlan, keyPrefix = 'plan') => {
    const planQueue = messagePlan?.queue || [];
    if (!planQueue.length) return null;
    return (
      <div className="v4-plan-card">
        <div className="v4-plan-title">
          <span>{messagePlan.title ? `自动推荐歌曲 · ${messagePlan.title}` : '自动推荐歌曲模块'}</span>
          <small>{planQueue.length} TRACKS</small>
        </div>
        {messagePlan.summary ? <p>{messagePlan.summary}</p> : null}
        {messagePlan.changes?.length ? (
          <ul>
            {messagePlan.changes.map((change, index) => <li key={`${keyPrefix}-change-${index}`}>{change}</li>)}
          </ul>
        ) : null}
        <div className="v4-plan-list">
          {planQueue.map((item, index) => {
            const active = item.id === track?.id;
            return (
              <button
                className={active ? 'active' : ''}
                key={`${keyPrefix}-${item.id || index}`}
                onClick={() => onSelectTrack(index, item.id)}
                type="button"
              >
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <span>
                  <b>{item.title || '未知歌曲'}</b>
                  <small>{item.artist || '未知歌手'}</small>
                  {item.reason ? <em>{item.reason}</em> : null}
                </span>
                <i>{active ? 'ON AIR' : 'PLAY'}</i>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className={`v4-shell${lowPowerMode ? ' low-power' : ''}`}>
      <section className={`v4-radio${lowPowerMode ? ' low-power' : ''}${isPlaying || reading || casting ? ' is-active' : ''}`} aria-label="MarkRadio V4版本">
        <canvas className="pixel-pulse-canvas" ref={pulseCanvasRef} aria-hidden="true" />
        {audioNodes}
        <header className="v4-topbar">
          <div className="v4-brand">
            <button className="v4-avatar" onClick={onBack} title="自动荐歌">
              {netease.loggedIn && netease.profile?.avatarUrl ? (
                <img alt="网易云头像" src={netease.profile.avatarUrl} />
              ) : pixelCafe()}
            </button>
            <button className="v4-wordmark" onClick={onBack} title="自动荐歌">MarkRadio</button>
          </div>
          <div className="v4-actions">
            <button onClick={onLogin}>{netease.loggedIn ? 'LOGGED' : 'LOGIN'}</button>
            <button className="active">DARK</button>
            <button onClick={onCastOpen}>{castState === 'playing' ? 'CASTING' : 'CAST'}</button>
          </div>
        </header>

        <section className="v4-clock-panel">
          <PixelClockCanvas hours={clock.getHours()} minutes={clock.getMinutes()} />
          <p>{weekdays[clock.getDay()]}</p>
          <small>{clock.getDate()} · {months[clock.getMonth()].toUpperCase()} · {clock.getFullYear()}</small>
          <div className={servicesOk ? 'v4-onair' : 'v4-onair idle'}>
            <span />
            {servicesOk ? 'ON AIR' : 'STANDBY'}
          </div>
        </section>

        <section className="v4-player-strip">
          <div className="v4-now-eq" aria-hidden="true" ref={eqRef}>
            {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
          </div>
          <div className="v4-now-text">
            <strong>{currentTrack}</strong>
            <small>{reading ? 'SPEAKING' : casting ? 'CASTING' : isPlaying ? 'PLAYING' : 'READY'}</small>
          </div>
          <div className="v4-controls">
            <button onClick={previousTrack} aria-label="上一首">‹</button>
            <button onClick={playback} aria-label="播放或暂停">{pendingPlay && !reading ? '…' : isPlaying || reading || casting ? 'Ⅱ' : '▶'}</button>
            <button onClick={nextTrack} aria-label="下一首">›</button>
            <button onClick={onRefresh} aria-label="刷新下一组">↻</button>
            <button
              aria-label={trackIsFavorite ? '取消收藏' : '收藏'}
              aria-pressed={trackIsFavorite}
              className={trackIsFavorite ? 'is-favorite' : ''}
              onClick={onToggleFavorite}
              type="button"
            >
              {trackIsFavorite ? '♥' : '♡'}
            </button>
          </div>
          <div className="v4-volume">
            <span>VOL</span>
            <input
              aria-label="音量"
              max="100"
              min="0"
              onChange={(event) => onVolumeChange(Number(event.currentTarget.value) / 100)}
              type="range"
              value={Math.round(userVolume * 100)}
            />
          </div>
        </section>

        <div className="v4-progress-row">
          <span>{formatTime(progress)}</span>
          <div className="v4-progress">
            <b style={{ width: `${displayProgressRatio * 100}%` }} />
            <input
              aria-label="拖动歌曲进度"
              max="1000"
              min="0"
              onBlur={(event) => commitTrackSeek(Number(event.currentTarget.value) / 1000)}
              onChange={(event) => previewTrackSeek(Number(event.currentTarget.value) / 1000)}
              onInput={(event) => previewTrackSeek(Number(event.currentTarget.value) / 1000)}
              onKeyUp={(event) => commitTrackSeek(Number(event.currentTarget.value) / 1000)}
              onPointerDown={beginTrackSeek}
              onPointerUp={(event) => commitTrackSeek(Number(event.currentTarget.value) / 1000)}
              type="range"
              value={Math.round(displayProgressRatio * 1000)}
            />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        <section className="v4-queue-head">
          <span>QUEUE</span>
          <span>{queueCount} TRACKS</span>
        </section>
        <section className="v4-live-row">
          {liveLyricLine ? (
            <div className="v4-live-lyric">{liveLyricLine}</div>
          ) : (
            <>
              <div><span /> MarkRadio</div>
              <strong>{servicesOk ? 'LIVE' : 'LOCAL'}</strong>
            </>
          )}
        </section>

        {queue?.length ? (
          <section className="v4-plan-panel" aria-label="自动推荐歌曲模块">
            <div className="v4-plan-title">
              <span>{planTitle}</span>
              <button onClick={onRefresh} type="button">ADJUST</button>
            </div>
            {planSummary ? <p className="v4-plan-summary">{planSummary}</p> : null}
            <div className="v4-plan-list">
              {queue.map((item, index) => {
                const active = item.id === track?.id;
                return (
                  <button
                    className={active ? 'active' : ''}
                    key={item.id || index}
                    onClick={() => onSelectTrack(index, item.id)}
                    type="button"
                  >
                    <strong>{String(index + 1).padStart(2, '0')}</strong>
                    <span>
                      <b>{item.title || '未知歌曲'}</b>
                      <small>{item.artist || '未知歌手'}</small>
                      {item.reason ? <em>{item.reason}</em> : null}
                    </span>
                    <i>{active ? 'ON AIR' : 'PLAY'}</i>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="v4-chat-log" aria-label="AI寻歌模块">
          <p className="v4-system-line">Connected to MarkRadio server</p>
          {lastMessages.map((message) => (
            <article className={`v4-message ${message.role}`} key={message.id}>
              <div className="v4-message-avatar">
                <V4PersonaAvatar role={message.role} />
              </div>
              <div>
                <span>{message.role === 'user' ? 'MMGUO' : 'MARKRADIO'}</span>
                {message.text ? <p>{message.text}</p> : null}
                {message.type === 'plan' ? renderPlanCard(message.plan, message.id) : null}
                {message.meta ? <small>{message.meta}</small> : null}
              </div>
            </article>
          ))}
          {track?.title ? <p className="v4-now-playing">Now playing: {track.title} · {track.artist}</p> : null}
        </section>

        <form className="v4-chat-input" onSubmit={handleChatSubmit}>
          <input
            aria-label="AI寻歌输入"
            disabled={chatBusy}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask for a song, a mood, a memory..."
            value={chatInput}
          />
          <button
            aria-label="语音输入"
            className={speechState === 'listening' ? 'listening' : ''}
            onClick={onSpeechInput}
            title={speechMessage || '语音输入'}
            type="button"
          >
            <span className="v4-mic-dot" aria-hidden="true" />
          </button>
          <button disabled={chatBusy || busy || !chatInput.trim()} type="submit">
            {chatBusy ? '…' : '↑'}
          </button>
        </form>
        {speechMessage ? <p className="v4-speech-hint">{speechMessage}</p> : null}
      </section>
    </main>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState('v3');
  const [state, setState] = useState(null);
  const [status, setStatus] = useState(null);
  const [selectedMood, setSelectedMood] = useState('平静');
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [netease, setNetease] = useState({ loggedIn: false, profile: null });
  const [qr, setQr] = useState(null);
  const [qrMessage, setQrMessage] = useState('');
  const [castDevices, setCastDevices] = useState([]);
  const [castDevice, setCastDevice] = useState(null);
  const [castState, setCastState] = useState('idle');
  const [showCastPanel, setShowCastPanel] = useState(false);
  const [castDiscovering, setCastDiscovering] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [reading, setReading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [introDoneFor, setIntroDoneFor] = useState(null);
  const [readingCardIndex, setReadingCardIndex] = useState(-1);
  const [userVolume, setUserVolume] = useState(1);
  const [volumeTarget, setVolumeTarget] = useState(1);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState([]);
  const [chatMessages, setChatMessages] = useState(() => [{
    id: 'hello',
    role: 'dj',
    text: '我是 MarkRadio，十三哥的音乐之声。你可以告诉我今晚想听什么，我会重新规划歌单。',
    meta: 'READY'
  }]);
  const [speechState, setSpeechState] = useState('idle');
  const [speechMessage, setSpeechMessage] = useState('');
  const audioRef = useRef(null);
  const djAudioRef = useRef(null);
  const activeDjClipRef = useRef(null);
  const activeDjSourceRef = useRef(null);
  const prestartedDjRef = useRef(null);
  const djAudioUnlockedRef = useRef(false);
  const speechRecognitionRef = useRef(null);
  const spectrumRef = useRef(null);
  const particleRef = useRef(null);
  const pulseCanvasRef = useRef(null);
  const v4EqLevelsRef = useRef(null);
  const pulseParticlesRef = useRef([]);
  const pulseWavesRef = useRef([]);
  const pulseFrameRef = useRef(null);
  const lastPulseAtRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioKeepAliveRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserDataRef = useRef(null);
  const mediaSourcesRef = useRef(new Map());
  const visualFrameRef = useRef(null);
  const lastReadProgressAtRef = useRef(0);
  const typeTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const readRafRef = useRef(null);
  const seekCommitTimerRef = useRef(null);
  const introAudioCacheRef = useRef(new Map());
  const introBufferCacheRef = useRef(new Map());
  const introBufferWarmupRef = useRef(new Map());
  const introWarmupRef = useRef(new Map());
  const autoplayOptionsRef = useRef({ skipIntro: false });
  const [autoplayToken, setAutoplayToken] = useState(0);
  const planRef = useRef(null);
  const planDjUrlRef = useRef(null);
  const planIdRef = useRef(null);
  const castDeviceRef = useRef(null);
  const castStateRef = useRef('idle');
  const castHeartbeatTimerRef = useRef(null);
  const castProgressTimerRef = useRef(null);
  const castVolumeTimerRef = useRef(null);
  const pendingCastVolumeRef = useRef(null);
  const playbackRunRef = useRef(0);
  const localProgressRef = useRef(0);
  const [seekDraftRatio, setSeekDraftRatio] = useState(null);
  const lowPowerMode = useMemo(() => detectLowPowerRuntime(), []);
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    viewModeRef.current = viewMode;
    if (viewMode === 'v3') { triggerPixelPulse(true); startFallbackVisuals(); }
  }, [viewMode]);

  useEffect(() => {
    castDeviceRef.current = castDevice;
  }, [castDevice]);

  useEffect(() => {
    castStateRef.current = castState;
  }, [castState]);

  useEffect(() => {
    localProgressRef.current = localProgress;
  }, [localProgress]);

  function syncReadProgress(ratio) {
    const safeRatio = Math.min(1, Math.max(0, ratio));
    const nowMs = performance.now();
    if (lowPowerMode && safeRatio < 1 && nowMs - lastReadProgressAtRef.current < LOW_POWER_READ_PROGRESS_MS) return;
    lastReadProgressAtRef.current = nowMs;
    setReadProgress(safeRatio);
  }

  function paintPixelPulse() {
    const canvas = pulseCanvasRef.current;
    const particles = pulseParticlesRef.current;
    const waves = pulseWavesRef.current;
    if (!canvas || (!particles.length && !waves.length)) {
      pulseFrameRef.current = null;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(rect.width || window.innerWidth);
    const h = Math.round(rect.height || window.innerHeight);
    const nextWidth = Math.round(w * dpr);
    const nextHeight = Math.round(h * dpr);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    const ctx = canvas.getContext('2d');
    const nowMs = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'lighter';

    for (let index = waves.length - 1; index >= 0; index -= 1) {
      const wave = waves[index];
      const age = (nowMs - wave.createdAt) / 1000;
      const lifeRatio = age / wave.life;
      if (lifeRatio >= 1) {
        waves.splice(index, 1);
        continue;
      }

      for (let ring = 0; ring < PULSE_RING_COUNT; ring += 1) {
        const radius = age * 360 - ring * 28;
        if (radius < 10) continue;
        const opacity = Math.max(0, 1 * (1 - lifeRatio) * (1 - ring * 0.1));
        const points = Math.min(132, Math.max(24, Math.floor(radius / 5)));
        ctx.globalAlpha = opacity;
        ctx.fillStyle = lerpColor([80, 120, 140], [0, 200, 180], lifeRatio + ring * 0.08);
        ctx.shadowColor = 'rgba(0,180,160,0.12)';
        ctx.shadowBlur = 5;
        for (let i = 0; i < points; i += 1) {
          const angle = wave.seed + (i / points) * Math.PI * 2;
          const x = wave.x + Math.cos(angle) * radius;
          const y = wave.y + Math.sin(angle) * radius;
          if (x < -8 || x > w + 8 || y < -8 || y > h + 8) continue;
          ctx.fillRect(Math.round(x), Math.round(y), 10, 10);
        }
      }
    }

    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const p = particles[index];
      const age = (nowMs - p.createdAt) / 1000;
      const lifeRatio = age / p.life;
      if (lifeRatio >= 1 || p.opacity <= 0.01) {
        particles.splice(index, 1);
        continue;
      }

      p.vx *= PULSE_DAMPING;
      p.vy *= PULSE_DAMPING;
      p.curve += p.spin * 0.016;
      p.x += p.vx;
      p.y += p.vy + Math.sin(p.curve) * 0.16;

      const fadeStart = Math.max(0.01, p.life - 0.5);
      const fadeRatio = age > fadeStart ? (age - fadeStart) / 0.5 : 0;
      const opacity = Math.max(0, 1 - fadeRatio);
      const size = p.size * (1 - fadeRatio * 0.28);
      ctx.globalAlpha = opacity * (0.55 + p.energy * 0.12);
      ctx.fillStyle = lerpColor([60, 100, 130], [0, 220, 190], lifeRatio);
      ctx.shadowColor = lifeRatio < 0.35 ? 'rgba(0,180,160,0.25)' : 'rgba(0,200,180,0.2)';
      ctx.shadowBlur = 10;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(2, size), Math.max(2, size));
      p.opacity = opacity;
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    if (particles.length || waves.length) {
      pulseFrameRef.current = requestAnimationFrame(paintPixelPulse);
    } else {
      ctx.clearRect(0, 0, w, h);
      pulseFrameRef.current = null;
    }
  }

  function triggerPixelPulse(force = false) {
    const isV4LowPower = lowPowerMode && viewModeRef.current === 'v4';
    const nowMs = performance.now();
    if (!force && nowMs - lastPulseAtRef.current < 900) return;
    lastPulseAtRef.current = nowMs;

    const canvas = pulseCanvasRef.current;
    const host = document.querySelector('.v4-clock-panel') || document.querySelector('.top-status time') || document.querySelector('.phone');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    let originX = canvasRect.width / 2;
    let originY = canvasRect.height * 0.3;
    if (host) {
      const hostRect = host.getBoundingClientRect();
      originX = Math.min(canvasRect.width - 64, hostRect.left + hostRect.width / 2 - canvasRect.left);
      originY = Math.max(96, hostRect.top + hostRect.height / 2 - canvasRect.top);
    }

    const particles = pulseParticlesRef.current;
    pulseWavesRef.current.push({
      x: originX,
      y: originY,
      life: 1.7,
      seed: Math.random() * Math.PI * 2,
      createdAt: nowMs - 320
    });
    const count = isV4LowPower ? Math.floor(PULSE_PARTICLE_COUNT / 3) : PULSE_PARTICLE_COUNT;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = isV4LowPower ? 4 + Math.random() * 5 : 9 + Math.random() * 10;
      const launch = isV4LowPower ? Math.random() * 26 : Math.random() * 52;
      particles.push({
        x: originX + Math.cos(angle) * launch,
        y: originY + Math.sin(angle) * launch,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 1.2,
        curve: Math.random() * Math.PI * 2,
        size: PULSE_PIXEL_SIZE + Math.random() * 2,
        life: 1.5 + Math.random() * 1.05,
        opacity: 1,
        energy: Math.random(),
        createdAt: nowMs
      });
    }

    if (!pulseFrameRef.current) {
      pulseFrameRef.current = requestAnimationFrame(paintPixelPulse);
    }
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([api.status(), api.now(), api.neteaseStatus()]).then(([statusData, nowData, neteaseData]) => {
      if (!mounted) return;
      setStatus(statusData);
      setState(nowData);
      setNetease(neteaseData);
      const initialMood = nowData.now?.mood || '平静';
      setSelectedMood(initialMood);
      if (!nowData.plan?.queue?.length && !nowData.now?.track) {
        setBusy(true);
        api.planToday(initialMood)
          .then((nextPlan) => api.now().then((nextNow) => {
            if (!mounted) return;
            setState({ ...nextNow, plan: nextPlan });
            setSelectedMood(nextPlan?.mood || nextNow.now?.mood || initialMood);
          }))
          .catch(() => {})
          .finally(() => {
            if (mounted) setBusy(false);
          });
      }
    }).catch(() => {});
    // Draw idle spectrum on mount — retry until canvas has valid dimensions
    let idleTries = 0;
    const drawIdle = () => {
      if (!spectrumRef.current || !mounted) return;
      const rect = spectrumRef.current.getBoundingClientRect();
      const w = rect.width || spectrumRef.current.clientWidth || window.innerWidth;
      const h = rect.height || spectrumRef.current.clientHeight;
      if ((w > 0 && h > 0) || idleTries >= 5) {
        const n = Math.max(1, Math.floor(w / SPEC_PX.cell));
        paintSpectrumCanvas(spectrumRef.current, buildIdleSpectrumLevels(n));
        return;
      }
      idleTries++;
      requestAnimationFrame(drawIdle);
    };
    const timer = setTimeout(drawIdle, 400);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), lowPowerMode ? 60000 : 1000);
    return () => clearInterval(timer);
  }, [lowPowerMode]);

  useEffect(() => {
    let socket;
    let reconnectTimer;
    let reconnectDelay = 1000;
    const maxDelay = 30000;

    function connect() {
      try {
        socket = new WebSocket(streamUrl());
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.event === 'now') setState(message.payload);
          if (message.event === 'plan') setState((current) => ({ ...(current || {}), plan: message.payload }));
          if (message.event === 'mood') setSelectedMood(message.payload.current);
        };
        socket.onopen = () => { reconnectDelay = 1000; };
        socket.onclose = () => {
          reconnectTimer = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(maxDelay, reconnectDelay * 1.5);
        };
        socket.onerror = () => { socket?.close(); };
      } catch {
        reconnectTimer = setTimeout(connect, reconnectDelay);
      }
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const now = state?.now || {};
  const plan = state?.plan;
  const queue = plan?.queue || [];
  const track = now.track || queue[0] || {};
  const queueIndex = queue.findIndex((item) => item.id === track.id);
  const trackUrl = apiAssetUrl(track.url || '');
  const ttsText = plan?.tts?.text || '';
  const isPlanIntroTrack = Boolean(queue[0]?.id && track.id === queue[0].id);
  const ttsMatchesTrack = Boolean(
    ttsText && track.title && normalizeTitleText(ttsText).includes(normalizeTitleText(track.title))
  );
  const planDjUrl = isPlanIntroTrack && Boolean(plan?.tts?.url)
    ? apiAssetUrl(plan.tts.url)
    : '';
  // 服务健康检查：AI、语音、音乐源均正常则为 OK
  const servicesOk = Boolean(
    status?.ai?.configured &&
    (status?.fishAudio?.configured || status?.voice?.configured) &&
    (status?.music?.mode === 'demo' || (status?.music?.mode === 'netease' && netease?.loggedIn))
  );
  const duration = audioRef.current?.duration && Number.isFinite(audioRef.current.duration)
    ? audioRef.current.duration
    : track.duration || 207;
  const progress = localProgress;
  const progressRatio = Math.min(1, Math.max(0, progress / duration));
  const displayProgressRatio = seekDraftRatio ?? progressRatio;
  const weather = plan?.weather || {};
  const metaLine = `${weather.city || '本地'} | ${weatherIcon(weather.condition)} ${weather.temperature ? `${Math.round(weather.temperature)}°` : weather.condition || '天气'} | ${moodIcon[selectedMood]} ${selectedMood} | 十三哥的音乐之声`;
  const introText = useMemo(() => {
    return buildTrackIntroText({ isPlanIntroTrack, plan, queueIndex, track, ttsText });
  }, [isPlanIntroTrack, plan, queueIndex, track, ttsText]);
  const readingSequence = useMemo(() => {
    const parts = [{ text: introText, cardIndex: -1 }];
    if (queue[0]?.reason) parts.push({ text: queue[0].reason, cardIndex: 0 });
    if (queue[1]?.reason) parts.push({ text: queue[1].reason, cardIndex: 1 });
    const fullText = parts.map((p) => p.text).filter(Boolean).join('\n');
    const boundaries = [];
    let total = 0;
    for (const p of parts) { total += (p.text || '').length; boundaries.push(total); }
    return { parts, fullText, boundaries, totalLength: fullText.length };
  }, [introText, queue]);
  const introSegments = useMemo(() => segmentTextWithOffsets(introText), [introText]);
  const readCharCount = Math.ceil(introText.length * readProgress);
  const readWordIndex = activeTokenIndex(introSegments, readCharCount);

  const cardSegments = useMemo(() => {
    if (readingCardIndex < 0 || !queue[readingCardIndex]?.reason) return [];
    return segmentTextWithOffsets(queue[readingCardIndex].reason);
  }, [readingCardIndex, queue]);
  const cardReadCharCount = useMemo(() => {
    if (!cardSegments.length) return 0;
    return Math.ceil((queue[readingCardIndex]?.reason || '').length * readProgress);
  }, [cardSegments, readProgress, readingCardIndex, queue]);
  const cardWordIndex = useMemo(() => {
    if (!cardSegments.length) return 0;
    return activeTokenIndex(cardSegments, cardReadCharCount);
  }, [cardSegments, cardReadCharCount]);

  const realLyrics = useMemo(() => (
    (track.lyric || []).filter((line) => line.text?.trim() && !isCreditLine(line.text))
  ), [track.lyric]);
  const lyricsSynced = realLyrics.some((line) => line.synced !== false && Number.isFinite(line.time));
  const lyrics = useMemo(() => (
    lyricsSynced
      ? realLyrics.filter((line) => line.synced !== false && Number.isFinite(line.time))
      : realLyrics
  ), [lyricsSynced, realLyrics]);
  const lyricIndex = lyricsSynced
    ? currentLyricIndex(lyrics, progress)
    : estimatedPlainLyricIndex(lyrics, progress, duration);
  const showLyrics = introDoneFor === track.id && !reading && lyrics.length > 0;
  const liveLyricLine = showLyrics && (isPlaying || castState === 'playing')
    ? lyrics[Math.max(0, lyricIndex)]?.text || ''
    : '';
  const trackIsFavorite = Boolean(track.id && favoriteTrackIds.includes(track.id));

  // Keep pulse light: only on song switch / refresh / load, not periodic.

  function applyMusicVolume(ratio = 1) {
    const nextVolume = Math.max(0, Math.min(1, userVolume * ratio));
    const audio = audioRef.current;
    if (audio) audio.volume = nextVolume;
    setVolumeTarget(nextVolume);
    return nextVolume;
  }

  function changeVolume(nextVolume) {
    const safeVolume = Math.max(0, Math.min(1, nextVolume));
    setUserVolume(safeVolume);
    const audio = audioRef.current;
    if (audio) {
      const bedRatio = reading ? BED_VOLUME : 1;
      audio.volume = Math.max(0, Math.min(1, safeVolume * bedRatio));
      setVolumeTarget(audio.volume);
    }
    if (castDeviceRef.current || castDevice) {
      scheduleCastVolume(safeVolume);
    }
  }

  function hasCastDevice() {
    return Boolean(castDeviceRef.current || castDevice);
  }

  function scheduleCastVolume(volume) {
    pendingCastVolumeRef.current = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    if (castVolumeTimerRef.current) return;
    castVolumeTimerRef.current = setTimeout(() => {
      const nextVolume = pendingCastVolumeRef.current;
      castVolumeTimerRef.current = null;
      pendingCastVolumeRef.current = null;
      if (nextVolume == null || !castDeviceRef.current) return;
      api.castAction('volume', { volume: nextVolume }).catch(() => {});
    }, 120);
  }

  function castLeaseForDuration(seconds = 0) {
    const durationMs = Math.max(0, Number(seconds) || 0) * 1000;
    return Math.max(CAST_LEASE_TTL_MS, durationMs + CAST_PLAYBACK_LEASE_BUFFER_MS);
  }

  function refreshCastLease(ttlMs = CAST_LEASE_TTL_MS) {
    if (!castDeviceRef.current) return;
    api.castHeartbeat({ ttlMs }).catch(() => {});
  }

  function startCastHeartbeat() {
    if (castHeartbeatTimerRef.current) return;
    const beat = () => {
      if (!castDeviceRef.current) {
        clearInterval(castHeartbeatTimerRef.current);
        castHeartbeatTimerRef.current = null;
        return;
      }
      refreshCastLease();
    };
    beat();
    castHeartbeatTimerRef.current = setInterval(beat, CAST_HEARTBEAT_INTERVAL_MS);
  }

  function stopCastHeartbeat() {
    clearInterval(castHeartbeatTimerRef.current);
    castHeartbeatTimerRef.current = null;
  }

  function isPlaybackRunCurrent(runId) {
    return !runId || playbackRunRef.current === runId;
  }

  function cancelPlaybackFlow() {
    playbackRunRef.current += 1;
    clearInterval(typeTimerRef.current);
    clearInterval(fadeTimerRef.current);
    clearInterval(castProgressTimerRef.current);
    castProgressTimerRef.current = null;
    cancelAnimationFrame(readRafRef.current);
    stopAudioVisuals();
    audioRef.current?.pause();
    djAudioRef.current?.pause();
    activeDjClipRef.current?.pause();
    activeDjClipRef.current = null;
    try { activeDjSourceRef.current?.stop?.(); } catch {}
    activeDjSourceRef.current = null;
    prestartedDjRef.current = null;
    stopAudioKeepAlive();
    window.speechSynthesis?.cancel?.();
    setIsPlaying(false);
    setReading(false);
  }

  function stopCastProgress() {
    clearInterval(castProgressTimerRef.current);
    castProgressTimerRef.current = null;
  }

  function startCastProgress(totalSeconds = duration, offsetSeconds = 0) {
    stopCastProgress();
    const safeTotal = Math.max(5, Number(totalSeconds) || duration || 207);
    const startedAt = Date.now() - Math.max(0, offsetSeconds) * 1000;
    localProgressRef.current = Math.max(0, offsetSeconds);
    setLocalProgress(Math.max(0, offsetSeconds));
    castProgressTimerRef.current = setInterval(() => {
      if (!hasCastDevice() || castStateRef.current !== 'playing') return;
      const elapsed = Math.min(safeTotal, (Date.now() - startedAt) / 1000);
      localProgressRef.current = elapsed;
      setLocalProgress(elapsed);
      if (elapsed >= safeTotal - 0.25) {
        stopCastProgress();
        handleEnded();
      }
    }, 1000);
  }

  useEffect(() => {
    clearInterval(typeTimerRef.current);
    clearInterval(fadeTimerRef.current);
    cancelAnimationFrame(readRafRef.current);
    stopAudioVisuals();
    clearTimeout(seekCommitTimerRef.current);
    setLocalProgress(0);
    setSeekDraftRatio(null);
    setReading(false);
    setReadProgress(0);
    applyMusicVolume(1);
    if (djAudioRef.current) {
      djAudioRef.current.pause();
      djAudioRef.current.removeAttribute('src');
    }
    activeDjClipRef.current?.pause();
    activeDjClipRef.current = null;
    try { activeDjSourceRef.current?.stop?.(); } catch {}
    activeDjSourceRef.current = null;
    prestartedDjRef.current = null;
    stopAudioKeepAlive();
    setReadingCardIndex(-1);
    if (track.id) triggerPixelPulse();
  }, [track.id]);

  // Auto-play: starts after song advance / group refresh (first play is user-initiated)
  useEffect(() => {
    if (!autoplayToken || !track.id || !trackUrl) return undefined;
    const options = autoplayOptionsRef.current;
    const timer = setTimeout(() => startPlayback(options), 400);
    return () => clearTimeout(timer);
  }, [autoplayToken, track.id, trackUrl]);

  useEffect(() => {
    planRef.current = plan;
    planDjUrlRef.current = planDjUrl;
    planIdRef.current = plan?.id || null;
  }, [plan, planDjUrl]);

  useEffect(() => {
    const text = plan?.tts?.text || '';
    if (!text) return undefined;
    const key = `${plan?.id || 'plan'}:${text}`;
    if (introWarmupRef.current.get(key)) return undefined;
    let cancelled = false;
    const warmup = (async () => {
      let url = plan?.tts?.url ? apiAssetUrl(plan.tts.url) : introAudioCacheRef.current.get(text);
      if (!url) {
        const result = await api.voicePreview({ text, mood: plan?.mood || selectedMood });
        url = result?.ok && result.url ? apiAssetUrl(result.url) : '';
      }
        if (!url || cancelled) return;
        introAudioCacheRef.current.set(text, url);
        if (planIdRef.current === plan?.id) planDjUrlRef.current = url;
      await warmDjAudioBuffer(url);
    })()
      .catch(() => {})
      .finally(() => {
        introWarmupRef.current.delete(key);
      });
    introWarmupRef.current.set(key, warmup);
    return () => {
      cancelled = true;
    };
  }, [plan?.id, plan?.tts?.text, plan?.tts?.url, plan?.mood, selectedMood]);

  useEffect(() => {
    const likedIds = (plan?.queue || [])
      .filter((item) => item?.source === 'netease' && /我喜欢的音乐/.test(`${item.album || ''} ${item.reason || ''}`))
      .map((item) => item.id)
      .filter(Boolean);
    if (likedIds.length) {
      setFavoriteTrackIds((ids) => [...new Set([...ids, ...likedIds])]);
    }
  }, [plan?.id, plan?.queue]);

  useEffect(() => () => {
    clearInterval(typeTimerRef.current);
    clearInterval(fadeTimerRef.current);
    clearInterval(castHeartbeatTimerRef.current);
    clearInterval(castProgressTimerRef.current);
    clearTimeout(castVolumeTimerRef.current);
    cancelAnimationFrame(readRafRef.current);
    stopAudioVisuals();
    clearTimeout(seekCommitTimerRef.current);
    cancelAnimationFrame(pulseFrameRef.current);
    speechRecognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => {
    const stopCastOnExit = () => {
      if (!castDeviceRef.current && castStateRef.current === 'idle') return;
      castActionBeacon('stop', { reason: 'browser-exit' });
    };
    // Keep cast alive when iPhone Safari locks the screen. pagehide can fire on lock,
    // so only use beforeunload for explicit refresh / close best-effort cleanup.
    window.addEventListener('beforeunload', stopCastOnExit);
    return () => {
      window.removeEventListener('beforeunload', stopCastOnExit);
    };
  }, []);

  useEffect(() => {
    const resumeWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      resumeSharedAudioContext();
    };
    document.addEventListener('visibilitychange', resumeWhenVisible);
    return () => document.removeEventListener('visibilitychange', resumeWhenVisible);
  }, []);

  useEffect(() => {
    window.triggerPixelPulse = triggerPixelPulse;
    return () => {
      if (window.triggerPixelPulse === triggerPixelPulse) delete window.triggerPixelPulse;
    };
  }, []);

  async function chooseMood(mood) {
    setSelectedMood(mood);
    setBusy(true);
    try {
      await api.setMood(mood);
      await refreshPlan(mood, true);
    } finally {
      refreshingRef.current = false;
      setBusy(false);
    }
  }

  async function refreshPlan(mood = selectedMood, autoplay = false) {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setBusy(true);
    triggerPixelPulse();
    try {
      await pausePlayback();
      // 新计划：重置 intro 状态，清缓存
      setIntroDoneFor(null);
      setReading(false);
      setReadProgress(0);
      setReadingCardIndex(-1);
      introAudioCacheRef.current = new Map();
      const nextPlan = await api.planToday(mood);
      const nextNow = await api.now();
      setState({ ...nextNow, plan: nextPlan });
      if (autoplay) {
        autoplayOptionsRef.current = { skipIntro: false };
        setAutoplayToken((value) => value + 1);
      }
    } finally {
      refreshingRef.current = false;
      setBusy(false);
    }
  }

  async function playback() {
    if (pendingPlay) return;
    unlockMobileAudio();
    if (isPlaying || reading || castState === 'playing') {
      await pausePlayback();
      return;
    }
    if (hasCastDevice() && castState === 'paused') {
      const status = await api.castAction('resume').catch(() => null);
      const nextState = status?.state || 'playing';
      castStateRef.current = nextState;
      setCastState(nextState);
      startCastProgress(duration, localProgressRef.current);
      await api.playback('play').catch(() => {});
      return;
    }
    // First play: init autoplayToken so subsequent songs auto-advance
    if (autoplayToken === 0) setAutoplayToken(1);
    await startPlayback();
  }

  async function pausePlayback() {
    cancelPlaybackFlow();
    if (hasCastDevice() && castStateRef.current === 'playing') {
      const status = await api.castAction('pause').catch(() => null);
      const nextState = status?.state || 'paused';
      castStateRef.current = nextState;
      setCastState(nextState);
    }
    await api.playback('pause').catch(() => {});
  }


  function unlockMobileAudio() {
    // 在用户手势内恢复 AudioContext，解锁移动端音频自动播放
    ensureSharedAudioOutput();
    primeDjAudioForMobile();
    // 用临时静音音频预热，避免污染真正的 DJ 导读音频元素。
  }

  async function startPlayback(options = {}) {
    if (pendingPlay) return;
    setPendingPlay(true);
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    const audio = audioRef.current;
    try {
      if (!audio) return;
      // 解锁移动端音频自动播放（iOS Safari 要求在用户手势内触发首次播放）
      unlockMobileAudio();
      audio.onended = handleEnded;
      const needsIntro = !options.skipIntro && introDoneFor !== track.id;
      const shouldReadStationIntro = !options.skipStationIntro && !introDoneFor;
      if (needsIntro && shouldReadStationIntro) {
        startImmediateDjIntro(planRef.current?.tts?.text || introText, runId);
      }

      if (needsIntro) {
        // Phase 1: Pre-intro (first play only) — pause music, read pre-intro DJ text
        if (shouldReadStationIntro) {
          await runPreIntro(runId);
          if (!isPlaybackRunCurrent(runId)) return;
        }
        // Phase 2: Card intro — music at low volume, read song DJ text
        const idx = queueIndex >= 0 ? queueIndex : 0;
        if (queue.length > 0) {
          await runCardIntro(idx, runId);
          if (!isPlaybackRunCurrent(runId)) return;
        }
        // Phase 3: Fade music to full, show lyrics
        if (hasCastDevice()) {
          await playCastTrack(track);
          if (!isPlaybackRunCurrent(runId)) return;
        } else if (audio) {
          const started = await playLocalMusic({ ratio: 1, fade: true, runId });
          if (!started || !isPlaybackRunCurrent(runId)) return;
        }
        setIntroDoneFor(track.id);
        setReading(false);
        setReadingCardIndex(null);
        setReadProgress(1);
      } else {
        // Resume: play music directly
        if (hasCastDevice()) {
          await playCastTrack(track);
          if (!isPlaybackRunCurrent(runId)) return;
        } else if (trackUrl) {
          const started = await playLocalMusic({ ratio: 1, runId });
          if (!started || !isPlaybackRunCurrent(runId)) return;
        }
      }
      await api.playback('play').catch(() => {});
    } finally {
      setPendingPlay(false);
    }
  }

  async function resolveCardAudioUrl(index) {
    // 优先用 ref 中的预生成 TTS
    const latestPlan = planRef.current || plan;
    const cardTts = latestPlan?.cardTts?.[index];
    if (cardTts?.ok && cardTts.url) {
      return apiAssetUrl(cardTts.url);
    }
    if (!cardTts?.deferred && (cardTts?.pending || !cardTts?.ok)) {
      // 如果 TTS 仍在生成，轮询 API（绕过 WebSocket 延迟）
      const waited = await new Promise((resolve) => {
        const start = Date.now();
        const check = async () => {
          try {
            const now = await api.now();
            const p = now?.plan;
            const ct = p?.cardTts?.[index];
            if (ct?.ok && ct.url) { resolve(apiAssetUrl(ct.url)); return; }
          } catch {}
          if (Date.now() - start > 15000) { resolve(null); return; }
          setTimeout(check, 300);
        };
        check();
      });
      if (waited) return waited;
    }
    // 回退：调用 API 生成
    const reason = latestPlan?.queue?.[index]?.reason;
    if (!reason) return '';
    const cached = introAudioCacheRef.current.get(reason);
    if (cached) return cached;
    try {
      const result = await api.voicePreview({ text: reason, mood: selectedMood });
      const url = result?.ok && result.url ? apiAssetUrl(result.url) : '';
      if (url) introAudioCacheRef.current.set(reason, url);
      return url;
    } catch {
      return '';
    }
  }
  
    async function resolveIntroAudioUrl(text, options = {}) {
    const t = text || '';
    if (!t) return '';
    const waitMs = options.waitMs ?? 15000;
    const synthesize = options.synthesize !== false;
    // 优先 planRef 中的 URL
    const latestPlan = planRef.current;
    const djUrl = latestPlan?.tts?.url ? apiAssetUrl(latestPlan.tts.url) : '';
    if (djUrl) return djUrl;
    const cached = introAudioCacheRef.current.get(t);
    if (cached) return cached;
    // 轮询 API 等待 TTS 就绪
    const waited = await new Promise((resolve) => {
      const start = Date.now();
      const check = async () => {
        try {
          const now = await api.now();
          const u = now?.plan?.tts?.url;
          if (u) { resolve(apiAssetUrl(u)); return; }
        } catch {}
        if (Date.now() - start > waitMs) { resolve(''); return; }
        setTimeout(check, 300);
      };
      check();
    });
    if (waited) return waited;
    if (!synthesize) return '';
    // 回退：实时生成
    const result = await api.voicePreview({ text: t, mood: selectedMood }).catch(() => null);
    const url = result?.ok && result.url ? apiAssetUrl(result.url) : '';
    if (url) introAudioCacheRef.current.set(t, url);
    return url;
  }

  function fadeMusicIn() {
    const audio = audioRef.current;
    if (!audio) return;
    const start = audio.volume;
    const target = userVolume;
    let step = 0;
    const totalSteps = 20;
    clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = setInterval(() => {
      step += 1;
      const next = Math.min(target, start + (target - start) * (step / totalSteps));
      audio.volume = next;
      setVolumeTarget(next);
      if (step >= totalSteps) {
        clearInterval(fadeTimerRef.current);
        applyMusicVolume(1);
      }
    }, 120);
  }

  function setMusicVolume(vol) {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, vol));
    }
  }

  function startDjProgressLoop(djAudio, textLen) {
    cancelAnimationFrame(readRafRef.current);
    const len = textLen || introText.length;
    const fallbackTotalMs = Math.max(2000, len * 160);
    const fallbackStartedAt = performance.now() - Math.max(0, djAudio.currentTime || 0) * 1000;
    const tick = () => {
      const hasDuration = djAudio.duration && Number.isFinite(djAudio.duration);
      const ratio = hasDuration
        ? djAudio.currentTime / djAudio.duration
        : (performance.now() - fallbackStartedAt) / fallbackTotalMs;
      syncReadProgress(ratio);
      if (!djAudio.paused && !djAudio.ended && ratio < 1) {
        readRafRef.current = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  function fallbackReadDurationMs(text = '') {
    return Math.max(2000, String(text || '').length * 160);
  }

  function probeAudioDurationMs(url) {
    if (!url) return Promise.resolve(0);
    return new Promise((resolve) => {
      const probe = new Audio();
      const done = (value = 0) => {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        clearTimeout(timer);
        probe.removeAttribute('src');
        resolve(value);
      };
      const timer = setTimeout(() => done(0), 2200);
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        const duration = probe.duration && Number.isFinite(probe.duration)
          ? Math.ceil(probe.duration * 1000)
          : 0;
        done(duration);
      };
      probe.onerror = () => done(0);
      probe.src = url;
    });
  }

  async function readTextSegment(text, options = {}) {
    return new Promise((resolve) => {
      const totalMs = Math.max(options.durationMs || 0, fallbackReadDurationMs(text));
      const startedAt = performance.now();
      setReadProgress(0);
      setReading(true);
      const timer = setInterval(() => {
        if (!isPlaybackRunCurrent(options.runId)) {
          clearInterval(timer);
          resolve();
          return;
        }
        const elapsed = performance.now() - startedAt;
        const ratio = Math.min(1, elapsed / totalMs);
        setReadProgress(ratio);
        if (ratio >= 1) {
          clearInterval(timer);
          resolve();
        }
      }, lowPowerMode ? LOW_POWER_READ_PROGRESS_MS : 30);
    });
  }

  function pickSpeechVoice(text = '') {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const wantsChinese = /[\u3400-\u9fff]/.test(text);
    return voices.find((voice) => wantsChinese && /zh|cmn|mandarin|chinese/i.test(`${voice.lang} ${voice.name}`))
      || voices.find((voice) => !wantsChinese && /^en/i.test(voice.lang || ''))
      || voices[0]
      || null;
  }

  async function speakDjFallback(text, runId) {
    const content = String(text || '').trim();
    if (!content) return;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      await readTextSegment(content, { runId });
      return;
    }
    await new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(content);
      const voice = pickSpeechVoice(content);
      if (voice) utterance.voice = voice;
      utterance.lang = /[\u3400-\u9fff]/.test(content) ? 'zh-CN' : 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = 0.95;
      const totalMs = fallbackReadDurationMs(content);
      const startedAt = performance.now();
      setReadProgress(0);
      setReading(true);
      startFallbackVisuals();
      let timer = null;
      let watchdog = null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        if (watchdog) clearTimeout(watchdog);
        utterance.onend = null;
        utterance.onerror = null;
        stopAudioVisuals();
        resolve();
      };
      timer = setInterval(() => {
        if (!isPlaybackRunCurrent(runId)) {
          window.speechSynthesis.cancel();
          finish();
          return;
        }
        syncReadProgress(Math.min(1, (performance.now() - startedAt) / totalMs));
      }, lowPowerMode ? LOW_POWER_READ_PROGRESS_MS : 60);
      utterance.onend = finish;
      utterance.onerror = finish;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        watchdog = setTimeout(finish, totalMs + 2500);
      } catch {
        finish();
      }
    });
  }

  async function playCastVoiceClip(url, text, meta, runId) {
    const durationMs = await probeAudioDurationMs(url);
    if (!isPlaybackRunCurrent(runId)) return;
    await playCastClip(url, meta);
    if (!isPlaybackRunCurrent(runId)) return;
    await readTextSegment(text, {
      runId,
      durationMs: durationMs ? durationMs + 700 : 0
    });
  }

  function cachedIntroUrl(text = '') {
    return planDjUrlRef.current
      || introAudioCacheRef.current.get(text)
      || introAudioCacheRef.current.get(planRef.current?.tts?.text || '')
      || '';
  }

  function getSharedAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      return context;
    } catch {
      return null;
    }
  }

  async function warmDjAudioBuffer(url) {
    if (!url) return null;
    const cached = introBufferCacheRef.current.get(url);
    if (cached) return cached;
    const pending = introBufferWarmupRef.current.get(url);
    if (pending) return pending;
    const task = (async () => {
      const context = getSharedAudioContext();
      if (!context) return null;
      const response = await fetch(url, { cache: 'force-cache' });
      const bytes = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(bytes.slice(0));
      introBufferCacheRef.current.set(url, buffer);
      return buffer;
    })().catch(() => null).finally(() => {
      introBufferWarmupRef.current.delete(url);
    });
    introBufferWarmupRef.current.set(url, task);
    return task;
  }

  function startBufferedDjClipNow(url, text, runId) {
    const audioBuffer = introBufferCacheRef.current.get(url);
    const context = getSharedAudioContext();
    if (!url || !audioBuffer || !context) return null;
    try {
      context.resume?.().catch?.(() => {});
      startAudioKeepAlive(context);
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      try { activeDjSourceRef.current?.stop?.(); } catch {}
      activeDjSourceRef.current = source;
      startFallbackVisuals();
      setReading(true);
      setReadProgress(0);
      const promise = new Promise((resolve) => {
        let done = false;
        const totalMs = Math.max(800, audioBuffer.duration * 1000 || fallbackReadDurationMs(text));
        const startedAt = performance.now();
        const finish = (ok = true) => {
          if (done) return;
          done = true;
          clearInterval(progressTimer);
          source.onended = null;
          if (activeDjSourceRef.current === source) activeDjSourceRef.current = null;
          resolve(ok);
        };
        const progressTimer = setInterval(() => {
          if (!isPlaybackRunCurrent(runId)) {
            try { source.stop(); } catch {}
            finish(false);
            return;
          }
          syncReadProgress(Math.min(1, (performance.now() - startedAt) / totalMs));
        }, lowPowerMode ? LOW_POWER_READ_PROGRESS_MS : 60);
        source.onended = () => finish(true);
        source.start(0);
      });
      return promise;
    } catch {
      return null;
    }
  }

  function startSpeechDjNow(text, runId) {
    const content = String(text || '').trim();
    if (!content || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return null;
    try {
      const utterance = new SpeechSynthesisUtterance(content);
      const voice = pickSpeechVoice(content);
      if (voice) utterance.voice = voice;
      utterance.lang = /[\u3400-\u9fff]/.test(content) ? 'zh-CN' : 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = 0.95;
      window.speechSynthesis.cancel();
      setReading(true);
      setReadProgress(0);
      startFallbackVisuals();
      const promise = new Promise((resolve) => {
        let done = false;
        let watchdog = null;
        const totalMs = fallbackReadDurationMs(content);
        const startedAt = performance.now();
        const finish = (ok = true) => {
          if (done) return;
          done = true;
          clearInterval(progressTimer);
          if (watchdog) clearTimeout(watchdog);
          utterance.onend = null;
          utterance.onerror = null;
          resolve(ok);
        };
        const progressTimer = setInterval(() => {
          if (!isPlaybackRunCurrent(runId)) {
            window.speechSynthesis.cancel();
            finish(false);
            return;
          }
          syncReadProgress(Math.min(1, (performance.now() - startedAt) / totalMs));
        }, lowPowerMode ? LOW_POWER_READ_PROGRESS_MS : 60);
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        window.speechSynthesis.speak(utterance);
        watchdog = setTimeout(() => finish(true), totalMs + 2500);
      });
      return promise;
    } catch {
      return null;
    }
  }

  function startMediaElementDjNow(url, text, runId) {
    const audio = audioRef.current;
    if (!audio || !url) return null;
    try {
      audio.pause();
      audio.onended = null;
      audio.src = url;
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
      audio.load();
      setIsPlaying(false);
      setReading(true);
      setReadProgress(0);
      startFallbackVisuals();
      const promise = new Promise((resolve) => {
        let done = false;
        let watchdog = null;
        const totalMs = fallbackReadDurationMs(text);
        const startedAt = performance.now();
        const finish = (ok = true) => {
          if (done) return;
          done = true;
          clearInterval(progressTimer);
          if (watchdog) clearTimeout(watchdog);
          audio.onended = null;
          audio.onerror = null;
          audio.onpause = null;
          resolve(ok);
        };
        const progressTimer = setInterval(() => {
          if (!isPlaybackRunCurrent(runId)) {
            finish(false);
            return;
          }
          const hasDuration = audio.duration && Number.isFinite(audio.duration);
          const ratio = hasDuration
            ? audio.currentTime / audio.duration
            : (performance.now() - startedAt) / totalMs;
          syncReadProgress(Math.min(1, ratio));
        }, lowPowerMode ? LOW_POWER_READ_PROGRESS_MS : 60);
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        audio.onpause = () => {
          if (!isPlaybackRunCurrent(runId) || audio.ended) finish(false);
        };
        const playPromise = audio.play();
        if (playPromise) playPromise.catch(() => finish(false));
        watchdog = setTimeout(() => finish(true), totalMs + 6000);
      });
      return promise;
    } catch {
      return null;
    }
  }

  function startImmediateDjIntro(text, runId) {
    if (hasCastDevice()) return null;
    const introUrl = cachedIntroUrl(text);
    const promise = startMediaElementDjNow(introUrl, text, runId)
      || startBufferedDjClipNow(introUrl, text, runId)
      || startSpeechDjNow(text, runId);
    if (!promise) return null;
    prestartedDjRef.current = { runId, text, url: introUrl, promise };
    return promise;
  }

  async function playLocalDjClip(url, text, runId) {
    if (!url) return false;
    const context = await resumeSharedAudioContext();
    if (context) {
      try {
        const audioBuffer = await warmDjAudioBuffer(url);
        if (!audioBuffer) throw new Error('DJ audio buffer not ready');
        if (!isPlaybackRunCurrent(runId)) return false;
        startAudioKeepAlive(context);
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        try { activeDjSourceRef.current?.stop?.(); } catch {}
        activeDjSourceRef.current = source;
        startFallbackVisuals();
        await new Promise((resolve) => {
          let done = false;
          const totalMs = Math.max(800, audioBuffer.duration * 1000 || fallbackReadDurationMs(text));
          const startedAt = performance.now();
          const finish = () => {
            if (done) return;
            done = true;
            clearInterval(progressTimer);
            source.onended = null;
            resolve();
          };
          const progressTimer = setInterval(() => {
            if (!isPlaybackRunCurrent(runId)) {
              try { source.stop(); } catch {}
              finish();
              return;
            }
            syncReadProgress(Math.min(1, (performance.now() - startedAt) / totalMs));
          }, lowPowerMode ? LOW_POWER_READ_PROGRESS_MS : 60);
          source.onended = finish;
          source.start(0);
        });
        if (activeDjSourceRef.current === source) activeDjSourceRef.current = null;
        stopAudioVisuals();
        return isPlaybackRunCurrent(runId);
      } catch {
        if (activeDjSourceRef.current) activeDjSourceRef.current = null;
        stopAudioVisuals();
      }
    }

    const clip = djAudioRef.current || new Audio();
    activeDjClipRef.current?.pause();
    activeDjClipRef.current = clip;
    clip.crossOrigin = 'anonymous';
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.muted = false;
    clip.volume = 1;
    clip.src = url;
    clip.load();
    startFallbackVisuals();
    let failed = false;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(cancelTimer);
        clip.onended = null;
        clip.onerror = null;
        clip.onpause = null;
        resolve();
      };
      const fail = () => {
        failed = true;
        finish();
      };
      const cancelTimer = setInterval(() => {
        if (!isPlaybackRunCurrent(runId)) {
          finish();
          return;
        }
        if (clip.paused && !clip.ended && clip.currentTime > 0.03) {
          fail();
        }
      }, 120);
      clip.onended = finish;
      clip.onerror = fail;
      clip.onpause = () => {
        if (!isPlaybackRunCurrent(runId) || clip.ended) finish();
        else if (clip.currentTime > 0.03) fail();
      };
      const playPromise = clip.play();
      if (playPromise) playPromise.catch(fail);
      startDjProgressLoop(clip, String(text || '').length);
    });
    if (activeDjClipRef.current === clip) activeDjClipRef.current = null;
    clip.pause();
    clip.removeAttribute('src');
    clip.load();
    stopAudioVisuals();
    return !failed && isPlaybackRunCurrent(runId);
  }

  async function runPreIntro(runId) {
    // Read pre-intro DJ text — background music paused
    clearInterval(typeTimerRef.current);
    clearInterval(fadeTimerRef.current);
    cancelAnimationFrame(readRafRef.current);
    stopAudioVisuals();
    setReading(true);
    setReadProgress(0);
    setReadingCardIndex(-1);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.volume = 0;
    }

    const prestarted = prestartedDjRef.current;
    if (prestarted?.runId === runId) {
      const ok = await prestarted.promise;
      if (prestartedDjRef.current === prestarted) prestartedDjRef.current = null;
      stopAudioVisuals();
      if (!ok && isPlaybackRunCurrent(runId)) {
        await readTextSegment(introText, { runId });
      }
      return;
    }

    // Try using pre-generated TTS
    let introUrl = planDjUrlRef.current;
    if (!introUrl && planRef.current?.tts?.pending) {
      introUrl = await new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          if (planDjUrlRef.current) { resolve(planDjUrlRef.current); return; }
          if (Date.now() - start > 900) { resolve(''); return; }
          setTimeout(check, 150);
        };
        check();
      });
    }
    if (!introUrl) {
      try {
        introUrl = await resolveIntroAudioUrl(planRef.current?.tts?.text || introText, {
          waitMs: 900,
          synthesize: false
        });
      } catch {
        introUrl = '';
      }
    }

    if (introUrl && hasCastDevice()) {
      startFallbackVisuals();
      try {
        await playCastVoiceClip(introUrl, introText, { title: 'MarkRadio DJ', artist: 'MarkRadio' }, runId);
        stopAudioVisuals();
        return;
      } catch {
        stopAudioVisuals();
      }
    }

    if (introUrl) {
      const played = await (
        startMediaElementDjNow(introUrl, introText, runId)
        || playLocalDjClip(introUrl, introText, runId)
      );
      if (!played) await speakDjFallback(introText, runId);
      return;
    }
    // Fallback: keep first-play DJ audible even when server TTS is not ready.
    await speakDjFallback(introText, runId);
  }

  async function runCardIntro(cardIndex, runId) {
    // Read song card DJ intro — music at low volume, DJ voice prominent
    clearInterval(typeTimerRef.current);
    cancelAnimationFrame(readRafRef.current);
    stopAudioVisuals();
    
    // Use ref to stay in sync with latest plan, avoiding stale closure queue
    const latestPlan = planRef.current;
    const reason = latestPlan?.queue?.[cardIndex]?.reason
      || `来自${latestPlan?.mood || '此刻'}的选曲。${latestPlan?.plan?.segue || '下一首，继续把情绪慢慢放平。'}`;

    setReading(true);
    setReadProgress(0);
    setReadingCardIndex(cardIndex);

    if (hasCastDevice()) {
      startFallbackVisuals();
      const cardUrl = await resolveCardAudioUrl(cardIndex);
      if (cardUrl) {
        try {
          await playCastVoiceClip(cardUrl, reason, { title: `${track.title || 'MarkRadio'} 导读`, artist: 'MarkRadio' }, runId);
          stopAudioVisuals();
          return;
        } catch {
          stopAudioVisuals();
        }
      }
      await readTextSegment(planRef.current?.queue?.[cardIndex]?.reason || reason, { runId });
      stopAudioVisuals();
      return;
    }

    // Set background music to low volume
    const audio = audioRef.current;
    if (audio && trackUrl && !castDevice) {
      await playLocalMusic({ ratio: BED_VOLUME, runId });
    }

    // Start fallback visuals before DJ TTS plays
    startFallbackVisuals();
    // Play card DJ TTS
    const cardUrl = await resolveCardAudioUrl(cardIndex);
    if (cardUrl) {
      const played = await (
        startMediaElementDjNow(cardUrl, reason, runId)
        || playLocalDjClip(cardUrl, reason, runId)
      );
      if (!played) {
        await speakDjFallback(planRef.current?.queue?.[cardIndex]?.reason || reason, runId);
      }
      return;
    }
    // Fallback — use latestPlan ref to avoid stale closure
    await speakDjFallback(planRef.current?.queue?.[cardIndex]?.reason || reason, runId);
  }

  async function finishIntro() {
    clearInterval(typeTimerRef.current);
    cancelAnimationFrame(readRafRef.current);
    stopAudioVisuals();
    setReading(false);
    setReadingCardIndex(null);
    setReadProgress(1);
    setIntroDoneFor(track.id);
    resumeMusicAfterIntro();
  }

  function resumeMusicAfterIntro() {
    const audio = audioRef.current;
    if (hasCastDevice()) {
      playCastTrack(track).catch((error) => {
        castStateRef.current = 'idle';
        setCastState('idle');
        setChatMessages((items) => [
          ...items,
          { id: `cast-error-${Date.now()}`, role: 'system', text: `投屏失败：${error.message}`, meta: 'CAST' }
        ]);
      });
      return;
    }
    if (!audio || !trackUrl) {
      fadeToFullVolume();
      return;
    }
    if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.3)) {
      applyMusicVolume(1);
      handleEnded();
      return;
    }
    clearInterval(fadeTimerRef.current);
    playLocalMusic({ ratio: 1, fade: true })
      .then((started) => {
        if (started) api.playback('play').catch(() => {});
      });
  }

  function fadeToFullVolume() {
    clearInterval(fadeTimerRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    fadeTimerRef.current = setInterval(() => {
      const next = Math.min(1, audio.volume + 0.035);
      audio.volume = next;
      setVolumeTarget(next);
      if (next >= 1) clearInterval(fadeTimerRef.current);
    }, 160);
  }

  const refreshingRef = useRef(false);

  async function handleEnded() {
    const audio = audioRef.current;
    if (!audio || refreshingRef.current || busy) return;
    triggerPixelPulse();
    try {
      const currentIndex = queue.findIndex((item) => item.id === track.id);
      if (currentIndex >= 0 && currentIndex < queue.length - 1) {
        await api.playback('next').catch(() => {});
        autoplayOptionsRef.current = { skipIntro: false, skipStationIntro: true };
        triggerPixelPulse();
        setAutoplayToken((value) => value + 1);
        return;
      }
      await refreshPlan(selectedMood, true);
    } catch (e) {
      try { await refreshPlan(selectedMood, true); } catch (_) {}
    }
  }

  async function nextTrack() {
    if (refreshingRef.current || busy) return;
    triggerPixelPulse();
    cancelPlaybackFlow();
    const currentIndex = queue.findIndex((item) => item.id === track.id);
    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      await pauseCastOnly();
      await api.playback('next').catch(() => {});
      autoplayOptionsRef.current = { skipIntro: false, skipStationIntro: true };
      setAutoplayToken((value) => value + 1);
      return;
    }
    await refreshPlan(selectedMood, true);
  }

  async function previousTrack() {
    if (refreshingRef.current || busy || pendingPlay) return;
    const currentIndex = queue.findIndex((item) => item.id === track.id);
    if (currentIndex < 0) return;
    triggerPixelPulse();
    cancelPlaybackFlow();
    setIntroDoneFor(null);
    setReading(false);
    setReadProgress(0);
    setReadingCardIndex(-1);
    setLocalProgress(0);
    await pauseCastOnly();
    const nextState = await api.playback('prev').catch(() => null);
    if (nextState?.now) setState(nextState);
    autoplayOptionsRef.current = { skipIntro: false, skipStationIntro: true };
    setAutoplayToken((value) => value + 1);
  }

  async function toggleFavoriteTrack() {
    if (!track.id) return;
    const nextFavorite = !favoriteTrackIds.includes(track.id);
    if (!netease.loggedIn) {
      setChatMessages((items) => [
        ...items,
        { id: `fav-login-${Date.now()}`, role: 'system', text: '请先登录网易云音乐，再同步收藏。', meta: 'FAV' }
      ]);
      startNeteaseLogin();
      return;
    }
    try {
      const result = await api.neteaseLike(track, nextFavorite);
      setFavoriteTrackIds((ids) => (
        result.liked
          ? [...new Set([...ids, track.id])]
          : ids.filter((id) => id !== track.id)
      ));
      setChatMessages((items) => [
        ...items,
        {
          id: `fav-${Date.now()}`,
          role: 'system',
          text: `${result.liked ? '已同步到网易云喜欢音乐' : '已从网易云喜欢音乐移除'}: ${track.title}${track.artist ? ` · ${track.artist}` : ''}`,
          meta: 'FAV'
        }
      ]);
    } catch (error) {
      setChatMessages((items) => [
        ...items,
        { id: `fav-error-${Date.now()}`, role: 'system', text: `网易云收藏失败：${error.message}`, meta: 'ERROR' }
      ]);
    }
  }

  async function selectQueueTrack(index, trackId = '') {
    if (refreshingRef.current || busy || pendingPlay) return;
    const item = queue.find((track) => track.id === trackId) || queue[index];
    if (!item) return;
    const currentIndex = queue.findIndex((track) => track.id === item.id);
    triggerPixelPulse();
    setBusy(true);
    try {
      await pausePlayback();
      setIntroDoneFor(null);
      setReading(false);
      setReadProgress(0);
      setReadingCardIndex(-1);
      setLocalProgress(0);
      const nextState = await api.playback('select', { index: currentIndex, trackId: item.id });
      setState(nextState);
      autoplayOptionsRef.current = { skipIntro: false, skipStationIntro: true };
      setAutoplayToken((value) => value + 1);
      setChatMessages((items) => [
        ...items,
        {
          id: `select-${Date.now()}`,
          role: 'system',
          text: `Switched to: ${item.title}${item.artist ? ` · ${item.artist}` : ''}`,
          meta: 'QUEUE'
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

function seekTo(ratio) {
    commitTrackSeek(ratio);
  }

  function beginTrackSeek() {
    setSeekDraftRatio(progressRatio);
  }

  function previewTrackSeek(ratio) {
    const safeRatio = Math.min(1, Math.max(0, ratio));
    setSeekDraftRatio(safeRatio);
    if (duration) setLocalProgress(safeRatio * duration);
  }

  function commitTrackSeek(ratio) {
    const safeRatio = Math.min(1, Math.max(0, ratio));
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = safeRatio * duration;
    setLocalProgress(audio.currentTime);
    setSeekDraftRatio(null);
    api.playback('seek', { progress: audio.currentTime }).catch(() => {});
  }

  function seekIntroTo(ratio) {
    const safeRatio = Math.min(1, Math.max(0, ratio));
    const djAudio = activeDjClipRef.current || djAudioRef.current;
    if (djAudio?.duration && Number.isFinite(djAudio.duration)) {
      djAudio.currentTime = safeRatio * djAudio.duration;
    }
    syncReadProgress(safeRatio);
  }

  function seekBottomProgress(ratio) {
    if (reading) {
      seekIntroTo(ratio);
      return;
    }
    commitTrackSeek(ratio);
  }

  function startFallbackVisuals() {
    // Drive visuals with time-based fallback — no AudioContext needed
    stopAudioVisuals();
    if (viewModeRef.current === 'v4') return;
    const startedAt = performance.now();
    const numBars = Math.max(1, Math.floor((spectrumRef.current?.clientWidth || window.innerWidth) / SPEC_PX.cell));
    let frameSkip = 0;
    const tick = () => {
      frameSkip = (frameSkip + 1) % 2;
      if (frameSkip !== 0) {
        visualFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = (performance.now() - startedAt) / 1000;
      const levels = buildFallbackLevels(elapsed, numBars);
      paintSpectrumCanvas(spectrumRef.current, levels);
      paintLevels(particleRef.current, levels.slice(0, PARTICLE_BARS));
      v4EqLevelsRef.current = levels.slice(0, 5);
      visualFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  function startAudioVisuals(mediaElement) {
    stopAudioVisuals();
    if (!mediaElement) return;
    const isV4 = viewModeRef.current === 'v4';
    const analyser = isV4 ? null : setupAnalyser(mediaElement);
    const frequencyData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const startedAt = performance.now();
    let frameSkip = 0;
    const tick = () => {
      frameSkip = (frameSkip + 1) % (isV4 ? 6 : 2);
      if (frameSkip !== 0) {
        visualFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      let levels = null;
      const numBars = isV4 ? 6 : Math.max(1, Math.floor((spectrumRef.current?.clientWidth || window.innerWidth) / SPEC_PX.cell));
      if (analyser && frequencyData) {
        analyser.getByteFrequencyData(frequencyData);
        levels = buildLevelsFromFrequency(frequencyData, numBars);
      }
      if (!levels || levels.every((level) => level < 0.02)) {
        levels = buildFallbackLevels(mediaElement.currentTime || (performance.now() - startedAt) / 1000, numBars);
      }
      if (!isV4) {
        paintSpectrumCanvas(spectrumRef.current, levels);
        paintLevels(particleRef.current, levels.slice(0, PARTICLE_BARS));
      }
      v4EqLevelsRef.current = levels.slice(0, 5);
      if (!mediaElement.paused && !mediaElement.ended) {
        visualFrameRef.current = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  function stopAudioVisuals() {
    cancelAnimationFrame(visualFrameRef.current);
    paintSpectrumCanvas(spectrumRef.current, null);
    paintLevels(particleRef.current, null);
  }

  async function resumeSharedAudioContext() {
    try {
      const context = getSharedAudioContext();
      if (!context) return null;
      if (context.state === 'suspended') {
        await context.resume();
      }
      return context;
    } catch {
      return null;
    }
  }

  function startAudioKeepAlive(context = audioContextRef.current) {
    try {
      if (!context || audioKeepAliveRef.current) return;
      const gain = context.createGain();
      gain.gain.value = 0.00001;
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 1;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      audioKeepAliveRef.current = { oscillator, gain };
    } catch {}
  }

  function stopAudioKeepAlive() {
    try { audioKeepAliveRef.current?.oscillator?.stop?.(); } catch {}
    try { audioKeepAliveRef.current?.oscillator?.disconnect?.(); } catch {}
    try { audioKeepAliveRef.current?.gain?.disconnect?.(); } catch {}
    audioKeepAliveRef.current = null;
  }

  async function ensureSharedAudioOutput() {
    await resumeSharedAudioContext();
    connectToAudioContext(audioRef.current);
    connectToAudioContext(djAudioRef.current);
  }

  function primeDjAudioForMobile() {
    if (djAudioUnlockedRef.current) return;
    try {
      djAudioUnlockedRef.current = true;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = AudioContext ? (audioContextRef.current || new AudioContext()) : null;
      if (context) {
        audioContextRef.current = context;
        context.resume?.().catch?.(() => {});
        startAudioKeepAlive(context);
        const silent = context.createBuffer(1, 1, 22050);
        const source = context.createBufferSource();
        source.buffer = silent;
        source.connect(context.destination);
        source.start(0);
      }
      const unlockAudio = new Audio(SILENT_AUDIO_URL);
      unlockAudio.muted = true;
      unlockAudio.volume = 0;
      unlockAudio.preload = 'auto';
      unlockAudio.playsInline = true;
      const playPromise = unlockAudio.play();
      const cleanup = () => {
        unlockAudio.pause();
        unlockAudio.removeAttribute('src');
        unlockAudio.load();
      };
      if (playPromise) {
        playPromise.then(cleanup).catch(() => {
          djAudioUnlockedRef.current = false;
          cleanup();
        });
      } else {
        cleanup();
      }
    } catch {
      djAudioUnlockedRef.current = false;
    }
  }

  async function playLocalMusic({ ratio = 1, fade = false, runId } = {}) {
    const audio = audioRef.current;
    if (!audio || !trackUrl) return false;
    await ensureSharedAudioOutput();
    if (!isPlaybackRunCurrent(runId)) return false;

    const sourceChanged = audio.src !== trackUrl;
    if (sourceChanged) {
      audio.pause();
      audio.src = trackUrl;
      audio.load();
      localProgressRef.current = 0;
      setLocalProgress(0);
    }
    audio.onended = handleEnded;
    audio.muted = false;
    applyMusicVolume(ratio);

    const tryPlay = async () => {
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    };

    let started = await tryPlay();
    if (!started && isPlaybackRunCurrent(runId)) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      await resumeSharedAudioContext();
      started = await tryPlay();
    }
    if (!started || !isPlaybackRunCurrent(runId)) {
      setIsPlaying(false);
      applyMusicVolume(1);
      return false;
    }

    setIsPlaying(true);
    startAudioVisuals(audio);
    if (fade) fadeMusicIn();
    return true;
  }

  function connectToAudioContext(mediaElement) {
    // Route audio element through shared AudioContext so iOS keeps one audio session
    try {
      if (!mediaElement) return null;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }
      let sourceEntry = mediaSourcesRef.current.get(mediaElement);
      if (!sourceEntry) {
        sourceEntry = {
          source: context.createMediaElementSource(mediaElement),
          destinationConnected: false,
          analyserConnected: false
        };
        mediaSourcesRef.current.set(mediaElement, sourceEntry);
      }
      if (!sourceEntry.destinationConnected) {
        sourceEntry.source.connect(context.destination);
        sourceEntry.destinationConnected = true;
      }
      return sourceEntry;
    } catch {
      return null;
    }
  }

  function setupAnalyser(mediaElement) {
    try {
      if (!mediaElement) return null;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
        // Don't route audio through suspended context — it silences native output
        return null;
      }
      let sourceEntry = mediaSourcesRef.current.get(mediaElement);
      if (!sourceEntry) {
        sourceEntry = {
          source: context.createMediaElementSource(mediaElement),
          destinationConnected: false,
          analyserConnected: false
        };
        mediaSourcesRef.current.set(mediaElement, sourceEntry);
      }
      const analyser = analyserRef.current || context.createAnalyser();

      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      if (!sourceEntry.destinationConnected) {
        sourceEntry.source.connect(context.destination);
        sourceEntry.destinationConnected = true;
      }
      if (!sourceEntry.analyserConnected) {
        sourceEntry.source.connect(analyser);
        sourceEntry.analyserConnected = true;
      }
      analyserRef.current = analyser;
      analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      return analyser;
    } catch {
      return null;
    }
  }

  async function handleCastDiscover() {
    setCastDiscovering(true);
    try {
      const result = await api.castDevices();
      setCastDevices(result.devices || []);
    } catch (err) {
      setCastDevices([]);
    } finally {
      setCastDiscovering(false);
    }
  }

  function castTrackUrl(item = track) {
    const rawUrl = item?.url || item?.originalUrl || '';
    const sourceId = item?.sourceId || (String(item?.id || '').startsWith('netease-') ? String(item.id).replace('netease-', '') : '');
    if (sourceId) return `/media/audio/${encodeURIComponent(sourceId)}.mp3`;
    const match = String(rawUrl).match(/^\/media\/audio\?id=([^&]+)/);
    if (match) return `/media/audio/${encodeURIComponent(decodeURIComponent(match[1]))}.mp3`;
    return rawUrl;
  }

  async function playCastClip(url, meta = {}) {
    if (!url) throw new Error('暂无可投放音频');
    stopCastProgress();
    const status = await api.castPlay(url, {
      title: meta.title || 'MarkRadio',
      artist: meta.artist || 'MarkRadio',
      album: meta.album || '',
      leaseMs: castLeaseForDuration(meta.duration || 0)
    });
    const nextState = status.state || 'playing';
    castStateRef.current = nextState;
    setCastState(nextState);
    audioRef.current?.pause();
    djAudioRef.current?.pause();
    setIsPlaying(false);
    return status;
  }

  async function playCastTrack(item = track) {
    const url = castTrackUrl(item);
    if (!url) throw new Error('当前歌曲暂无可投放音源');
    const status = await api.castPlay(url, {
      title: item.title || '',
      artist: item.artist || '',
      album: item.album || '',
      leaseMs: castLeaseForDuration(item.duration || duration)
    });
    const nextState = status.state || 'playing';
    castStateRef.current = nextState;
    setCastState(nextState);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    startCastProgress(item.duration || duration, 0);
    refreshCastLease(castLeaseForDuration(item.duration || duration));
    await api.playback('play').catch(() => {});
    return status;
  }

  async function pauseCastOnly() {
    if (!hasCastDevice() || castStateRef.current !== 'playing') return;
    const status = await api.castAction('pause').catch(() => null);
    stopCastProgress();
    const nextState = status?.state || 'paused';
    castStateRef.current = nextState;
    setCastState(nextState);
  }

  async function handleCastConnect(device) {
    try {
      await api.castConnect(device.host, device.port);
      castDeviceRef.current = device;
      setCastDevice(device);
      castStateRef.current = 'idle';
      setCastState('idle');
      startCastHeartbeat();
    } catch (err) {
      castDeviceRef.current = null;
      setCastDevice(null);
      castStateRef.current = 'idle';
      setCastState('idle');
      setChatMessages((items) => [
        ...items,
        { id: `cast-error-${Date.now()}`, role: 'system', text: `连接音箱失败：${err.message}`, meta: 'CAST' }
      ]);
      return;
    }

    try {
      if (castTrackUrl(track)) {
        if (introDoneFor !== track.id) {
          const runId = playbackRunRef.current + 1;
          playbackRunRef.current = runId;
          if (!introDoneFor) {
            await runPreIntro(runId);
            if (!isPlaybackRunCurrent(runId)) return;
          }
          const idx = queueIndex >= 0 ? queueIndex : 0;
          if (queue.length > 0) {
            await runCardIntro(idx, runId);
            if (!isPlaybackRunCurrent(runId)) return;
          }
          setIntroDoneFor(track.id);
          setReading(false);
          setReadingCardIndex(null);
          setReadProgress(1);
        }
        await playCastTrack(track);
        setShowCastPanel(false);
      } else {
        setChatMessages((items) => [
          ...items,
          { id: `cast-no-url-${Date.now()}`, role: 'system', text: '当前歌曲暂无可投放音源。', meta: 'CAST' }
        ]);
      }
    } catch (err) {
      castStateRef.current = 'idle';
      setCastState('idle');
      setChatMessages((items) => [
        ...items,
        { id: `cast-error-${Date.now()}`, role: 'system', text: `投屏失败：${err.message}`, meta: 'CAST' }
      ]);
    }
  }

  async function handleCastDisconnect() {
    try {
      await api.castAction('stop');
      await api.castAction('disconnect');
    } catch (_) { /* ignore */ }
    stopCastHeartbeat();
    stopCastProgress();
    castDeviceRef.current = null;
    setCastDevice(null);
    castStateRef.current = 'idle';
    setCastState('idle');
  }

  useEffect(() => {
    if (showCastPanel && castDevices.length === 0 && !castDiscovering) {
      handleCastDiscover();
    }
  }, [showCastPanel]);

  async function startNeteaseLogin() {
    setQrMessage('');
    try {
      const nextQr = await api.neteaseQrCreate();
      setQr(nextQr);
      setQrMessage('请用网易云音乐 App 扫码');
    } catch (error) {
      setQr(null);
      setQrMessage(`扫码登录失败：${error.message}`);
    }
  }

  async function handleChatSubmit(event) {
    event?.preventDefault?.();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    const idBase = Date.now();
    setChatInput('');
    setChatBusy(true);
    setSpeechMessage('');
    setChatMessages((items) => [
      ...items,
      {
        id: `user-${idBase}`,
        role: 'user',
        text: message,
        meta: `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`
      }
    ]);
    try {
      introAudioCacheRef.current = new Map();
      const beforeTrackId = track?.id || '';
      const result = await api.chat(message);
      const nextNow = await api.now();
      setState({ ...nextNow, plan: result.plan });
      const firstTrack = result.plan?.queue?.[0];
      const shouldSwitch = Boolean(result.plan?.plan?.shouldSwitchNow) ||
        Boolean(nextNow?.now?.track?.id && nextNow.now.track.id !== beforeTrackId);
      if (shouldSwitch) {
        await pauseCastOnly();
        setIntroDoneFor(null);
        setReading(false);
        setReadProgress(0);
        setReadingCardIndex(-1);
        setLocalProgress(0);
        autoplayOptionsRef.current = { skipIntro: false };
        setAutoplayToken((value) => value + 1);
      }
      const planMessage = result.planMessage
        ? {
            id: `plan-${idBase}`,
            role: 'dj',
            type: 'plan',
            plan: result.planMessage,
            meta: 'PLAN'
          }
        : null;
      setChatMessages((items) => [
        ...items,
        {
          id: `dj-${idBase}`,
          role: 'dj',
          text: result.reply || '收到，我已经重新整理队列。',
          meta: 'REPLY'
        },
        planMessage,
        firstTrack ? {
          id: `now-${idBase}`,
          role: 'system',
          text: `Now playing: ${firstTrack.title}${firstTrack.artist ? ` · ${firstTrack.artist}` : ''}`,
          meta: 'QUEUE'
        } : null
      ].filter(Boolean));
    } catch (error) {
      setChatMessages((items) => [
        ...items,
        { id: `err-${idBase}`, role: 'system', text: `DJ 暂时没接上：${error.message}`, meta: 'ERROR' }
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  function startSpeechInput() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechState('unsupported');
      setSpeechMessage('当前浏览器不支持语音输入，请打字。');
      return;
    }
    if (speechState === 'listening') {
      speechRecognitionRef.current?.stop?.();
      return;
    }
    const recognition = new SpeechRecognition();
    speechRecognitionRef.current = recognition;
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      setSpeechState('listening');
      setSpeechMessage('正在听你说话...');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result?.[0]?.transcript || '')
        .join('')
        .trim();
      if (transcript) setChatInput(transcript);
      if (Array.from(event.results).some((result) => result.isFinal)) {
        setSpeechMessage('已转成文字，可以发送。');
      }
    };
    recognition.onerror = () => {
      setSpeechState('idle');
      setSpeechMessage('语音输入失败，请打字。');
    };
    recognition.onend = () => {
      setSpeechState('idle');
    };
    try {
      recognition.start();
    } catch {
      setSpeechState('idle');
      setSpeechMessage('语音输入没有启动，请打字。');
    }
  }

  useEffect(() => {
    if (!qr?.key) return undefined;
    let stopped = false;
    const timer = setInterval(async () => {
      const result = await api.neteaseQrCheck(qr.key).catch(() => null);
      if (!result || stopped) return;
      setQrMessage(result.message || '');
      if (result.loggedIn) {
        stopped = true;
        clearInterval(timer);
        const statusData = await api.neteaseStatus();
        setNetease(statusData);
        setQr(null);
        setQrMessage('网易云已登录');
        await refreshPlan(selectedMood, false);
      }
      if (result.code === 800) {
        stopped = true;
        clearInterval(timer);
        setQrMessage('二维码已过期，请重新生成');
      }
    }, 2200);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [qr, selectedMood]);

  const audioNodes = (
    <>
      <audio
        crossOrigin="anonymous"
        ref={audioRef}
        src={trackUrl || undefined}
        preload="auto"
        playsInline
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setLocalProgress(event.currentTarget.currentTime)}
      />
      <audio crossOrigin="anonymous" ref={djAudioRef} preload="auto" playsInline />
    </>
  );

  const modalNodes = (
    <>
      {showCastPanel ? (
        <div className="qr-backdrop" role="dialog" aria-modal="true" aria-label="投屏设备选择">
          <div className="qr-card cast-card">
            <h3>投屏到智能音箱</h3>
            {castDiscovering ? (
              <p>正在搜索 UPnP/DLNA 设备...</p>
            ) : castDevices.length === 0 ? (
              <p>未发现设备，请确保音箱在同一网络。</p>
            ) : (
              <div className="cast-list">
                {castDevices.map((device) => (
                  <button
                    key={device.usn}
                    className={castDevice?.usn === device.usn ? 'active' : ''}
                    onClick={() => handleCastConnect(device)}
                  >
                    <span>{castDevice?.usn === device.usn ? '⬢' : '⬡'}</span>
                    <div>
                      <strong>{device.name}</strong>
                      <small>{device.host}</small>
                    </div>
                    {castDevice?.usn === device.usn ? <b className="cast-check">✓</b> : null}
                  </button>
                ))}
              </div>
            )}
            <div className="cast-actions">
              <button onClick={handleCastDiscover}>再搜</button>
              {castDevice ? (
                <button onClick={handleCastDisconnect}>断开</button>
              ) : null}
              <button onClick={() => setShowCastPanel(false)}>关闭</button>
            </div>
          </div>
        </div>
      ) : null}

      {qr ? (
        <div className="qr-backdrop" role="dialog" aria-modal="true" aria-label="网易云扫码登录">
          <div className="qr-card">
            <h3>网易云扫码登录</h3>
            {qr.qrimg ? <img src={qr.qrimg} alt="网易云登录二维码" /> : null}
            <p>{qrMessage}</p>
            <button onClick={() => setQr(null)}>关闭</button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (viewMode === 'v4') {
    return (
      <>
        <V4RadioView
          audioNodes={audioNodes}
          beginTrackSeek={beginTrackSeek}
          busy={busy}
          castState={castState}
          eqLevelsRef={v4EqLevelsRef}
          pulseCanvasRef={pulseCanvasRef}
          chatBusy={chatBusy}
          chatInput={chatInput}
          chatMessages={chatMessages}
          clock={clock}
          commitTrackSeek={commitTrackSeek}
          displayProgressRatio={displayProgressRatio}
          duration={duration}
          handleChatSubmit={handleChatSubmit}
          isPlaying={isPlaying}
          liveLyricLine={liveLyricLine}
          lowPowerMode={lowPowerMode}
          netease={netease}
          nextTrack={nextTrack}
          onBack={() => setViewMode('v3')}
          onCastOpen={() => setShowCastPanel(true)}
          onLogin={startNeteaseLogin}
          onRefresh={() => refreshPlan(selectedMood, false)}
          onSelectTrack={selectQueueTrack}
          onSpeechInput={startSpeechInput}
          onToggleFavorite={toggleFavoriteTrack}
          onVolumeChange={changeVolume}
          playback={playback}
          pendingPlay={pendingPlay}
          plan={plan}
          previousTrack={previousTrack}
          previewTrackSeek={previewTrackSeek}
          progress={progress}
          queue={queue}
          reading={reading}
          servicesOk={servicesOk}
          setChatInput={setChatInput}
          speechMessage={speechMessage}
          speechState={speechState}
          track={track}
          trackIsFavorite={trackIsFavorite}
          userVolume={userVolume}
        />
        {modalNodes}
      </>
    );
  }

  return (
    <main className="shell">
      <section className="stage" aria-label="十三哥的音乐之声播放器">
        <div className="aura" />
        <div className="phone">
          <canvas className="pixel-pulse-canvas" ref={pulseCanvasRef} aria-hidden="true" />
          {audioNodes}
          <header className="hero-panel">
            <div className="topline">
              <div className="brand-lockup">
                <button className="avatar" onClick={() => setViewMode('v4')} title="AI寻歌">
                  {netease.loggedIn && netease.profile?.avatarUrl ? (
                    <img alt="网易云头像" src={netease.profile.avatarUrl} />
                  ) : pixelCafe()}
                </button>
                <div>
                  <button className="brand-title-button" onClick={() => setViewMode('v4')} title="AI寻歌">
                    <h1>MarkRadio</h1>
                  </button>
                  <div className={`speaking${servicesOk ? '' : ' idle'}`}>
                    <span />
                    {servicesOk
                      ? (reading ? 'Speaking...' : isPlaying ? 'Playing...' : 'Ready')
                      : '静止'}
                  </div>
                </div>
              </div>
              <div className="top-status">
                <div className="icon-row">
                  <button
                    className={netease.loggedIn ? 'icon-btn on' : 'icon-btn'}
                    onClick={startNeteaseLogin}
                    title={netease.loggedIn ? '网易云已连接' : '网易云未连接'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  </button>
                  <button
                    className={castState === 'playing' ? 'icon-btn on' : 'icon-btn'}
                    onClick={() => setShowCastPanel(true)}
                    title={castState === 'playing' ? `投屏中: ${castDevice?.name || ''}` : '投屏到智能音箱'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                      <circle cx="12" cy="20" r="1"/>
                    </svg>
                  </button>
                </div>
                <time>{formatTime(progress || clock.getSeconds())}</time>
              </div>
            </div>
{lowPowerMode && (() => {
              const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return (
                <div className="hero-clock">
                  <PixelClockCanvas hours={clock.getHours()} minutes={clock.getMinutes()} lowPower={true} />
                  <p className="hero-clock-weekday">{weekdays[clock.getDay()]}</p>
                  <p className="hero-clock-date">{clock.getDate()} {months[clock.getMonth()]} {clock.getFullYear()}</p>
                  <div className={`hero-clock-status${servicesOk ? '' : ' idle'}`}>
                    <span className="status-dot" />
                    <span className="status-text">{servicesOk ? 'ON AIR' : '静止'}</span>
                  </div>
                </div>
              );
            })()}
            <Spectrum active={isPlaying || reading || castState === 'playing'} progressRatio={displayProgressRatio} visualRef={spectrumRef} />
          </header>

          <section className="card">
            <div className="song-head">
              <div>
                <p className="eyebrow">{metaLine}</p>
                <h2>{track.title || 'Monday Night Exhale'}</h2>
                <p>{track.artist || 'Bread'}</p>
                {!track.url ? <span className="source-note">Demo / 暂无可播放音源</span> : null}
              </div>
            </div>

            <div className="track-row">
              <button className="tiny-play" onClick={playback} aria-label="播放或暂停">
                {pendingPlay && !reading ? '…' : isPlaying || reading || castState === 'playing' ? 'Ⅱ' : '▶'}
              </button>
              <div className="progress draggable">
                <span style={{ width: `${displayProgressRatio * 100}%` }} />
                <input
                  aria-label="拖动歌曲进度"
                  max="1000"
                  min="0"
                  onBlur={(event) => commitTrackSeek(Number(event.currentTarget.value) / 1000)}
                  onChange={(event) => previewTrackSeek(Number(event.currentTarget.value) / 1000)}
                  onInput={(event) => previewTrackSeek(Number(event.currentTarget.value) / 1000)}
                  onKeyUp={(event) => commitTrackSeek(Number(event.currentTarget.value) / 1000)}
                  onPointerDown={beginTrackSeek}
                  onPointerUp={(event) => commitTrackSeek(Number(event.currentTarget.value) / 1000)}
                  type="range"
                  value={Math.round(displayProgressRatio * 1000)}
                />
              </div>
              <span className="duration">{formatTime(progress)} / {formatTime(duration)}</span>
            </div>

            <DjFeed
              introSegments={introSegments}
              lyricIndex={lyricIndex}
              lyrics={lyrics}
              lyricsSynced={lyricsSynced}
              plan={plan}
              queue={queue}
              reading={reading}
              readWordIndex={readWordIndex}
              showLyrics={showLyrics}
              readingCardIndex={readingCardIndex}
              introText={introText}
              introDoneFor={introDoneFor}
              cardSegments={cardSegments}
              cardWordIndex={cardWordIndex}
            />

            <QueuePreview busy={busy} currentId={track.id} onRefresh={() => refreshPlan(selectedMood, false)} queue={queue} />

            <MoodStrip
              busy={busy}
              chooseMood={chooseMood}
              selectedMood={selectedMood}
            />

            <footer className="bottom-player">
              <span>{formatTime(progress)}</span>
              <ParticleWave
                active={reading || isPlaying}
                onCommit={reading ? seekIntroTo : commitTrackSeek}
                onPreview={reading ? seekIntroTo : previewTrackSeek}
                onSeek={seekBottomProgress}
                onSeekStart={reading ? undefined : beginTrackSeek}
                progressRatio={reading ? readProgress : displayProgressRatio}
                visualRef={particleRef}
              />
              <button onClick={playback} aria-label="播放或暂停">
                {busy && !reading ? '…' : isPlaying || reading ? 'Ⅱ' : '▶'}
              </button>
            </footer>
          </section>
        </div>
        {modalNodes}
      </section>
    </main>
  );
}
