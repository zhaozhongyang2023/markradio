import { PanelSection, PanelSectionRow, TextField, staticClasses } from '@decky/ui';
import { definePlugin } from '@decky/api';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

const ICON_BASE64 = "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";

const DEFAULT_API_BASE = 'http://127.0.0.1:38765';
const CONFIG_VERSION = 7;
const API_BASE_KEY = 'moodwave.deck.apiBase';
const GAME_NAME_KEY = 'moodwave.deck.gameName';
const MINIMAL_KEY = 'moodwave.deck.minimalMode';
const AUTO_CONTINUE_KEY = 'moodwave.deck.autoContinue';
const PAGE_KEY = 'moodwave.deck.page';

type Track = {
  id?: string;
  source?: string;
  sourceId?: string;
  title?: string;
  artist?: string;
  reason?: string;
  lyric?: Array<{ time: number; text: string }>;
  duration?: number;
};

type NowPayload = {
  now?: {
    track?: Track | null;
    playing?: boolean;
    progressRatio?: number;
    mood?: string;
    mode?: string;
  };
  plan?: {
    mood?: string;
    mode?: string;
    tts?: { text?: string; url?: string };
    queue?: Track[];
    plan?: { say?: string; reply?: string; gameVibeSentence?: string };
    cardTts?: Array<{ ok?: boolean; pending?: boolean; url?: string; text?: string; deferred?: boolean }>;
  };
  weather?: { source?: string; city?: string; condition?: string; temperature?: number | null; summary?: string } | null;
  plans?: {
    radio?: NowPayload['plan'];
    search?: NowPayload['plan'];
    game?: NowPayload['plan'];
  };
};

type Page = 'radio' | 'search' | 'game' | 'settings';

const moods = [
  { id: '开心', icon: '☼' },
  { id: '平静', icon: '◌' },
  { id: '忧郁', icon: '☁' },
  { id: '悲伤', icon: '☂' },
  { id: '治愈', icon: '✦' },
  { id: '愤怒', icon: '⚡' }
];
const searchExamples = [
  { id: '雨天英文老歌', icon: '🌧' },
  { id: '中古世纪民谣', icon: '🎻' },
  { id: '九零年代港乐', icon: '📼' },
  { id: '儿时玩的网吧', icon: '🖥' },
];
const gameVibes = [
  { id: 'Boss战', icon: '⚔', hint: '今晚燃一点，法印按到底' },
  { id: '探索地图', icon: '⌖', hint: '慢慢走，不急着赶路' },
  { id: '雨夜跑图', icon: '🌙', hint: '外面下雨，适合慢慢走' },
  { id: '赛车竞速', icon: '🏎️', hint: '今晚速度别停' },
  { id: '种田放松', icon: '✧', hint: '今晚别太累了' },
  { id: '模拟器怀旧', icon: '▣', hint: '像小时候一样' },
];

function normalizeBase(value: string) {
  return (value || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
}

async function apiRequest<T>(apiBase: string, path: string, body?: unknown): Promise<T> {
  const url = `${normalizeBase(apiBase)}${path}`;
  const opts: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function AppButton({
  children,
  active = false,
  disabled = false,
  onClick,
  title,
  className: extraClass = '',
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`mw-button${active ? ' is-active' : ''}${extraClass ? ' ' + extraClass : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const cityNameMap: Record<string, string> = {
  'Rongcheng': '荣成',
  'Beijing': '北京',
  'Shanghai': '上海',
  'Guangzhou': '广州',
  'Shenzhen': '深圳',
  'Hangzhou': '杭州',
  'Chengdu': '成都',
  'Nanjing': '南京',
  'Wuhan': '武汉',
  'Xiamen': '厦门',
  'Qingdao': '青岛',
  'Dalian': '大连',
  'Suzhou': '苏州',
  'Chongqing': '重庆',
  'Xian': '西安',
  'Changsha': '长沙',
  'Kunming': '昆明',
  'Fuzhou': '福州',
  'Zhengzhou': '郑州',
  'Jinan': '济南',
  'Harbin': '哈尔滨',
  'Shenyang': '沈阳',
  'Tianjin': '天津',
};

function cityLabel(raw: string): string {
  const name = (raw || '').split(',')[0].trim();
  return cityNameMap[name] || name;
}

function Content() {
  const [apiBase, setApiBase] = useState(() => {
    const storedVersion = localStorage.getItem('moodwave.deck.configVersion');
    const storedBase = localStorage.getItem(API_BASE_KEY);
    if (storedVersion !== String(CONFIG_VERSION)) {
      localStorage.removeItem(API_BASE_KEY);
      localStorage.setItem('moodwave.deck.configVersion', String(CONFIG_VERSION));
      return normalizeBase(DEFAULT_API_BASE);
    }
    return normalizeBase(storedBase || DEFAULT_API_BASE);
  });
  const [page, setPage] = useState<Page>(() => (localStorage.getItem(PAGE_KEY) as Page) || 'radio');
  const [now, setNow] = useState<NowPayload>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('连接中');
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState(searchExamples[0].id);
  const [gameVibe, setGameVibe] = useState('探索地图');
  const [gameName, setGameName] = useState(() => localStorage.getItem(GAME_NAME_KEY) || '');
  const gameNameEditedRef = useRef(false);  // 用户手动编辑后不再自动覆盖
  const [minimalMode, setMinimalMode] = useState(() => localStorage.getItem(MINIMAL_KEY) === '1');
  const [autoContinue, setAutoContinue] = useState(() => localStorage.getItem(AUTO_CONTINUE_KEY) === '1');

  async function refresh() {
    try {
      const payload = await apiRequest<NowPayload>(apiBase, '/api/now');
      setNow(payload);
      setStatus('在线');
      // 自动检测当前运行的游戏名
      try {
        const dfl = (window as any).DFL;
        const runningName = dfl?.Router?.MainRunningApp?.display_name;
        if (runningName && !gameNameEditedRef.current) {
          setGameName(String(runningName));
        }
      } catch { /* DFL 不可用时静默跳过 */ }
    } catch (e: any) {
      setStatus('离线: ' + (e?.message || String(e)).slice(0, 40));
    }
  }

  async function switchMode(mode: Page) {
    if (mode === 'settings') { setPage('settings'); return; }
    setPage(mode);
    localStorage.setItem(PAGE_KEY, mode);
    try { await apiRequest(apiBase, '/api/switch-mode', { mode }); }
    catch { /* ignore */ }
    await refresh();
  }

  async function run(label: string, task: () => Promise<unknown>) {
    setBusy(true);
    setStatus(label);
    setProgress(0);
    // 模拟进度增长到 85%
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return 85;
        const step = prev < 30 ? 6 : prev < 60 ? 3 : 1;
        return Math.min(85, prev + step);
      });
    }, 200);
    runTimerRef.current = timer;
    try {
      await task();
      setProgress(100);
      setTimeout(() => setProgress(0), 600);
      await refresh();
    } catch (error) {
      setProgress(0);
      setStatus(error instanceof Error ? error.message : '请求失败');
    } finally {
      clearInterval(timer);
      runTimerRef.current = null;
      setBusy(false);
    }
  }

  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 组件卸载时清理运行中的 timer
  useEffect(() => {
    return () => {
      if (runTimerRef.current) clearInterval(runTimerRef.current);
      setBusy(false);
      setProgress(0);
    };
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const currentPlan = minimalMode ? now.plan : ((page !== 'settings' ? now.plans?.[page] : null) || now.plan);
  const track = now.now?.track || currentPlan?.queue?.[0] || null;
  const playing = Boolean(now.now?.playing);
  const serverProgressRatio = Number(now.now?.progressRatio) || 0;
  const [localProgressRatio, setLocalProgressRatio] = useState(serverProgressRatio);
  const progressAnchorRef = useRef({ ratio: 0, ts: 0 });

  // 本地进度计时器：播放时每 250ms 递增，不发起网络请求
  useEffect(() => {
    if (playing && track?.duration) {
      setLocalProgressRatio(serverProgressRatio);
      progressAnchorRef.current = { ratio: serverProgressRatio, ts: Date.now() };
      const timer = setInterval(() => {
        const elapsed = (Date.now() - progressAnchorRef.current.ts) / 1000;
        const duration = (track.duration || 180);
        const estimated = progressAnchorRef.current.ratio + elapsed / duration;
        setLocalProgressRatio(Math.min(0.99, estimated));
      }, 250);
      return () => clearInterval(timer);
    } else {
      setLocalProgressRatio(serverProgressRatio);
    }
  }, [playing, track?.id, serverProgressRatio]);

  const progressRatio = playing ? localProgressRatio : serverProgressRatio;

  // 轻量心跳：播放中每 15s 同步一次服务端进度，校正漂移
  const [progressTick, setProgressTick] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setProgressTick(t => t + 1), 15000);
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (!playing || progressTick === 0) return;
    refresh().catch(() => {});
  }, [progressTick]);
  const currentMood = (now.now?.mood || currentPlan?.mood || '').trim();
  const queue = currentPlan?.queue || [];
  const djLine = currentPlan?.tts?.text || currentPlan?.plan?.say || currentPlan?.plan?.reply || '';
  const djForTrack = (() => {
    const idx = queue.findIndex(t => t.id === track?.id || t.sourceId === track?.sourceId);
    if (idx >= 0 && currentPlan?.cardTts?.[idx]?.text) return currentPlan.cardTts[idx].text || '';
    return '';
  })();
  const trackLine = track?.title ? `${track.title}${track.artist ? ` - ${track.artist}` : ''}` : "AI DJ 准备中...";

  function saveGameName(value: string, fromBlur = false) {
    const v = String(value || "");
    if (fromBlur) gameNameEditedRef.current = true;
    setGameName(v);
    localStorage.setItem(GAME_NAME_KEY, v);
  }

  function saveApiBase(value: string) {
    const next = normalizeBase(value);
    setApiBase(next);
    localStorage.setItem(API_BASE_KEY, next);
    // 直接用新地址请求，避免闭包捕获旧 apiBase
    apiRequest<NowPayload>(next, '/api/now')
      .then((payload) => { setNow(payload); setStatus('在线'); })
      .catch(() => {});
  }

  function getActiveMode(now: NowPayload): 'radio' | 'search' | 'game' | null {
    const serverMode = now.now?.mode;
    if (serverMode === 'radio' || serverMode === 'search' || serverMode === 'game') return serverMode;
    const plans = now.plans || {};
    const plan = now.plan;
    if (plan?.queue?.length) {
      for (const mode of ['game', 'search', 'radio'] as const) {
        if (plans[mode]?.queue?.[0]?.id === plan.queue[0]?.id) return mode;
      }
    }
    if (plans.game?.queue?.length) return 'game';
    if (plans.search?.queue?.length) return 'search';
    if (plans.radio?.queue?.length) return 'radio';
    return null;
  }

  async function handleMinimalNextBetter() {
    const mode = getActiveMode(now);
    if (mode === 'game') {
      await startGameRadio('换个感觉');
    } else if (mode === 'radio') {
      await nextRadio('');
    } else {
      await nextRadio(query);
    }
  }

  function getSceneText() {
    const mode = getActiveMode(now);
    if (mode === 'game' && gameName.trim()) return '🎮 正在陪你玩 ' + gameName.trim();
    if (mode === 'game') {
      const vibe = gameVibes.find(v => v.id === gameVibe);
      return vibe ? `${vibe.icon} ${vibe.id} — ${vibe.hint}` : ('🎮 ' + (gameVibe || '游戏电台'));
    }
    if (mode === 'search') return query.trim() ? '寻歌 · ' + query.trim() : '寻歌电台';
    return currentMood ? '心情电台 · ' + currentMood : '心情电台';
  }

  function getWorldContext() {
    const city = cityLabel(now.weather?.city || '');
    const condition = now.weather?.condition || '未知';
    const temp = now.weather?.temperature != null ? ' ' + Math.round(now.weather.temperature) + '°C' : '';
    const hasGame = getActiveMode(now) === 'game' && Boolean(gameName.trim());
    const moodIcon = moods.find(m => m.id === currentMood)?.icon || '';
    const vibeSentence = now.plan?.plan?.gameVibeSentence || '';
    const vibe = gameVibes.find(v => v.id === gameVibe);
    const vibeHint = vibe?.hint || '';
    return { city, condition, temp, hasGame, moodIcon, vibeSentence, vibeHint };
  }

  function getCurrentLyric(track: Track | null, progressRatio: number): string {
    if (!track?.lyric?.length) return '';
    const duration = track.duration || 180;
    const seconds = progressRatio * duration;
    let idx = -1;
    for (let i = 0; i < track.lyric.length; i++) {
      if (track.lyric[i].time <= seconds) idx = i;
      else break;
    }
    return idx >= 0 ? track.lyric[idx].text : '';
  }

  async function startRadio(mood: string) {
    await run(`正在开台 · ${mood}`, async () => {
      await apiRequest(apiBase, '/api/ai/radio', { mood, mode: 'steamdeck', deferTts: true, autoContinue: autoContinue });
    });
  }

  async function searchRadio() {
    const prompt = query.trim();
    if (!prompt) return;
    await run('正在找歌单', async () => {
      await apiRequest(apiBase, '/api/ai/search', { query: prompt, mode: 'steamdeck', deferTts: true, autoContinue: autoContinue });
    });
  }

  async function nextRadio(scene = '') {
    await run('正在换氛围', async () => {
      await apiRequest(apiBase, '/api/ai/next-radio', { scene: scene || '', mode: 'steamdeck', deferTts: true, autoContinue: autoContinue });
    });
  }

  async function startGameRadio(label = 'AI DJ 准备中') {
    const vibe = gameVibes.find((item) => item.id === gameVibe);
    await run(label, async () => {
      await apiRequest(apiBase, '/api/ai/game-radio', {
        gameVibe,
        gameName: gameName.trim() || undefined,
        vibeHint: vibe?.hint || '',
        mode: 'steamdeck',
        deferTts: true,
        autoContinue: autoContinue
      });
    });
  }

  return (
    <div className="mw-root">
      <style>{`
        .mw-root {
          position: relative;
          padding: 6px 10px 54px;
        }
        .mw-progress {
          position: absolute;
          top: 0;
          left: 0;
          height: 2px;
          background: #42d8b2;
          transition: width .3s ease;
          border-radius: 0 1px 1px 0;
          z-index: 10;
          color: rgba(255,255,255,.86);
          font-size: 12px;
          letter-spacing: 0;
          min-width: 0;
        }
        .mw-brand-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .mw-brand-bar img {
          width: 16px;
          height: 16px;
          opacity: .7;
        }
        .mw-brand-bar span {
          color: rgba(255,255,255,.38);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .02em;
        }
        .mw-minimal-logo {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 16px;
          height: 16px;
          opacity: .5;
        }
        .mw-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 0 0 6px;
          color: rgba(255,255,255,.52);
          font-size: 10px;
          line-height: 14px;
          min-width: 0;
        }
        .mw-topbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 30px;
          gap: 5px;
          margin-bottom: 6px;
        }
        .mw-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 4px;
        }
        .mw-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 5px;
        }
        .mw-grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .mw-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          width: 100%;
          min-width: 0;
          height: 28px;
          padding: 0 6px;
          border: 1px solid rgba(255,255,255,.11);
          border-radius: 6px;
          background: rgba(255,255,255,.055);
          color: rgba(255,255,255,.76);
          font-size: 10.5px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mw-button.is-active {
          border-color: rgba(66,216,178,.7);
          background: rgba(66,216,178,.16);
          color: #42d8b2;
        }
        .mw-button:disabled {
          opacity: .42;
        }
        .mw-button.is-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-size: 14px;
          line-height: 1;
          text-overflow: clip;
        }
        .mw-button .mw-icon {
          display: inline-block;
          min-width: 14px;
          margin-right: 4px;
          color: rgba(66,216,178,.92);
          font-size: 11px;
          text-align: center;
        }
        .mw-button.is-icon .mw-icon {
          margin-right: 0;
        }
        .mw-button:not(.is-icon) .mw-icon { margin-right: 4px; }
        .mw-button.is-transport {
          padding: 0;
          font-size: 15px;
          line-height: 1;
          text-overflow: clip;
        }
        .mw-busy-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          margin-right: 5px;
          border-radius: 999px;
          background: #42d8b2;
          box-shadow: 0 0 8px rgba(66,216,178,.7);
          vertical-align: 1px;
          animation: mw-pulse 1.2s ease-in-out infinite;
        }
        @keyframes mw-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(66,216,178,.7); }
          50% { opacity: .4; box-shadow: 0 0 4px rgba(66,216,178,.3); }
        }
        .mw-busy-ellipsis {
          display: inline-flex;
          gap: 3px;
          margin-left: 2px;
        }
        .mw-busy-ellipsis i {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #42d8b2;
          animation: mw-bounce 1.2s ease-in-out infinite;
        }
        .mw-busy-ellipsis i:nth-child(1) { animation-delay: 0s; }
        .mw-busy-ellipsis i:nth-child(2) { animation-delay: .2s; }
        .mw-busy-ellipsis i:nth-child(3) { animation-delay: .4s; }
        @keyframes mw-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .3; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .mw-button:focus-visible {
          outline: 2px solid #42d8b2;
          outline-offset: 1px;
        }
        .mw-card {
          padding: 7px 8px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 7px;
          background: rgba(255,255,255,.04);
          min-width: 0;
        }
        .mw-card-accent {
          background: rgba(66,216,178,0.06);
        }
        .mw-mini {
          margin-bottom: 7px;
        }
        .mw-mini-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }
        .mw-mini-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: rgba(255,255,255,.82);
          font-size: 11px;
          font-weight: 800;
        }
        .mw-progress-bar {
          height: 3px;
          margin: 5px 0 0;
          border-radius: 2px;
          background: rgba(255,255,255,.08);
          overflow: hidden;
        }
        .mw-progress-bar-fill {
          height: 100%;
          background: #42d8b2;
          border-radius: 2px;
          transition: width .5s linear;
        }
        .mw-mini-state {
          flex: 0 0 auto;
          color: rgba(66,216,178,.86);
          font-size: 9.5px;
          font-weight: 800;
        }
        /* 极简播放态 */
        .mw-minimal {
          padding: 6px 0;
        }
        .mw-minimal-tags {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .mw-minimal-tag {
          display: inline-flex;
          align-items: center;
          padding: 1.5px 6px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 4px;
          background: rgba(255,255,255,.04);
          color: rgba(255,255,255,.78);
          font-size: 9px;
          font-weight: 600;
          line-height: 16px;
        }
        .mw-minimal-world-card {
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px;
          background: rgba(255,255,255,.04);
          margin-bottom: 10px;
          min-width: 0;
        }
        .mw-minimal-world-location {
          color: rgba(255,255,255,.52);
          font-size: 12px;
          margin-bottom: 8px;
        }
        .mw-minimal-world-label {
          color: rgba(255,255,255,.38);
          font-size: 10px;
          font-weight: 600;
          margin-bottom: 3px;
          letter-spacing: .04em;
        }
        .mw-minimal-world-game {
          color: rgba(255,255,255,.92);
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .mw-minimal-world-mood {
          color: rgba(255,255,255,.6);
          font-size: 11px;
          font-weight: 500;
        }
        .mw-minimal-scene {
          color: rgba(255,255,255,.78);
          font-size: 9px;
          font-weight: 500;
          margin-bottom: 10px;
          line-height: 1.3;
          letter-spacing: 0.02em;
        }
        .mw-minimal-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
        .mw-minimal-loading-bar {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,.08);
        }
        .mw-minimal-loading-fill {
          height: 100%;
          border-radius: 2px;
          background: #42d8b2;
          transition: width .3s linear;
        }
        .mw-minimal-loading-pct {
          color: rgba(66,216,178,.78);
          font-size: 9px;
          font-weight: 600;
          min-width: 24px;
          text-align: right;
        }
        .mw-minimal-quote {
          padding: 10px 12px;
          border-left: 4px solid #42d8b2;
          border-radius: 0 8px 8px 0;
          background: rgba(66,216,178,.08);
          color: #42d8b2;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
          margin-bottom: 10px;
          min-width: 0;
        }
        .mw-minimal-quote-track {
          font-size: 11px;
          font-weight: 500;
          color: rgba(66,216,178,.6);
          border-left: none;
          padding-left: 12px;
          margin-top: -4px;
        }
        .mw-minimal-playing {
          color: rgba(66,216,178,.78);
          font-size: 9px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .mw-minimal-track {
          color: rgba(255,255,255,.74);
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mw-minimal-progress {
          height: 2.5px;
          margin-bottom: 9px;
          border-radius: 2px;
          background: rgba(255,255,255,.08);
          overflow: hidden;
        }
        .mw-minimal-progress-fill {
          height: 100%;
          background: #42d8b2;
          border-radius: 2px;
          transition: width .5s linear;
        }
        .mw-minimal-lyric {
          color: rgba(255,255,255,.48);
          font-size: 9px;
          margin-bottom: 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mw-minimal-transport {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 4px;
          margin-bottom: 5px;
        }
        .mw-minimal-transport .mw-button {
          font-size: 13px;
          height: 26px;
        }
        .mw-minimal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
        }
        .mw-minimal-actions .mw-button {
          height: 26px;
          font-size: 10px;
        }
        .mw-minimal-toggle {
          flex: 0 0 auto;
          padding: 1px 6px;
          border: 1px solid rgba(66,216,178,.5);
          border-radius: 4px;
          background: transparent;
          color: #42d8b2;
          font-size: 9.5px;
          font-weight: 700;
          cursor: pointer;
          line-height: 16px;
        }
        .mw-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 7px 0 5px;
          color: rgba(255,255,255,.9);
          font-size: 15px;
          font-weight: 800;
          line-height: 18px;
        }
        .mw-section-title span {
          color: #42d8b2;
          font-size: 13px;
        }
        .mw-action-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 5px;
          margin-top: 8px;
        }
        .mw-dj {
          margin-bottom: 5px;
          color: #42d8b2;
          font-size: 10.5px;
          font-weight: 700;
          line-height: 1.35;
        }
        .mw-song {
          padding: 4px 0;
          border-top: 1px solid rgba(255,255,255,.06);
          min-width: 0;
        }
        .mw-song:first-of-type {
          border-top: 0;
          padding-top: 0;
        }
        .mw-song-active {
          position: relative;
          padding-left: 6px;
          border-left: 3px solid #42d8b2;
          background: rgba(66,216,178,0.04);
          border-radius: 2px;
        }
        .mw-song-active::before {
          content: "▶";
          position: absolute;
          left: -16px;
          top: 4px;
          font-size: 8px;
          color: #42d8b2;
        }
        .mw-song-title,
        .mw-track {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mw-song-title {
          color: rgba(255,255,255,.82);
          font-size: 10.5px;
          font-weight: 700;
        }
        .mw-song-artist,
        .mw-song-reason {
          color: rgba(255,255,255,.46);
          font-size: 10px;
          line-height: 1.35;
        }
        .mw-track {
          margin-bottom: 7px;
          color: rgba(255,255,255,.78);
          font-size: 11px;
          font-weight: 700;
        }
        .decky-panel-section {
          margin-bottom: 4px !important;
        }
        .decky-panel-section-row {
          padding: 3px 0 !important;
          margin-bottom: 0 !important;
        }
      `}</style>

      {minimalMode && track ? (
        <div className="mw-minimal" style={{ position: "relative" }}>
          <img className="mw-minimal-logo" src={`data:image/png;base64,${ICON_BASE64}`} alt="MoodWave" />
          {(() => {
            const ctx = getWorldContext();
            if (ctx.hasGame) {
              return (
                <div className="mw-minimal-world-card">
                  <div className="mw-minimal-world-location">📍 {ctx.city || '本地'} · {ctx.condition}{ctx.temp}</div>
                  <div className="mw-minimal-world-label">正在陪你玩</div>
                  <div className="mw-minimal-world-game">🎮 {gameName}</div>
                  <div className="mw-minimal-world-mood">
                    {ctx.moodIcon ? ctx.moodIcon + ' ' : ''}{currentMood}{ctx.vibeSentence ? ' · "' + ctx.vibeSentence + '"' : ctx.vibeHint ? ' · ' + ctx.vibeHint : ''}
                  </div>
                </div>
              );
            }
            return (
              <>
                <div className="mw-minimal-tags">
                  {now.weather ? <div className="mw-minimal-tag">{cityLabel(now.weather.city || '') || '本地'} · {now.weather.condition || '未知'}{now.weather.temperature != null ? ' ' + Math.round(now.weather.temperature) + '°C' : ''}</div> : <div className="mw-minimal-tag">本地 · 未知</div>}
                  {currentMood ? <div className="mw-minimal-tag">{currentMood}</div> : null}
                </div>
                <div className="mw-minimal-scene">{getSceneText()}</div>
              </>
            );
          })()}
          {busy ? (
            <div className="mw-minimal-loading">
              <div className="mw-minimal-loading-bar">
                <div className="mw-minimal-loading-fill" style={{width: `${progress}%`}} />
              </div>
              <span className="mw-minimal-loading-pct">{progress}%</span>
            </div>
          ) : null}
          {djLine ? (
            <div className="mw-minimal-quote">{djLine}</div>
          ) : null}
          {djForTrack ? (
            <div className="mw-minimal-quote mw-minimal-quote-track">{djForTrack}</div>
          ) : null}
          <div className="mw-minimal-playing">📻 正在陪你</div>
          <div className="mw-minimal-track">{track.title || '未知歌曲'}{track.artist ? ' — ' + track.artist : ''}</div>
          {playing ? <div className="mw-minimal-progress"><div className="mw-minimal-progress-fill" style={{width: `${Math.round(progressRatio * 100)}%`}} /></div> : null}
          {(() => { const lyric = getCurrentLyric(track, progressRatio); return lyric ? <div className="mw-minimal-lyric">{lyric}</div> : null; })()}
          <div className="mw-minimal-transport">
            <button type="button" className="mw-button is-transport" disabled={busy} title="上一首" onClick={() => run('上一首', () => apiRequest(apiBase, '/api/prev', {}))}>⏮</button>
            <button type="button" className="mw-button is-transport" disabled={busy} title={playing ? '暂停' : '播放'} onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}>{playing ? '⏯' : '▶'}</button>
            <button type="button" className="mw-button is-transport" disabled={busy} title="下一首" onClick={() => run('下一首', () => apiRequest(apiBase, '/api/next', {}))}>⏭</button>
          </div>
          <div className="mw-minimal-actions">
            <AppButton disabled={busy} onClick={handleMinimalNextBetter}>↻ 来点别的</AppButton>
            <AppButton onClick={() => { setMinimalMode(false); localStorage.removeItem(MINIMAL_KEY); }}>✦ 打开电台</AppButton>
          </div>
        </div>
      ) : (
        <>
        <div className="mw-status">
          <span>{progress > 0 ? <div className="mw-progress" style={{width: `${progress}%`}} /> : null}{busy ? <><span style={{fontSize:10,opacity:.6,marginRight:6}}>{progress}%</span><span className="mw-busy-dot" /><><span>{status}</span><span className="mw-busy-ellipsis"><i /><i /><i /></span></></> : `${status}${currentMood ? ` · ${currentMood}` : ''}`}</span>
          {playing && track ? <button className="mw-minimal-toggle" onClick={() => { setMinimalMode(true); localStorage.setItem(MINIMAL_KEY, '1'); }} title="极简模式">◁ 极简</button> : null}
        </div>

      <div className="mw-brand-bar">
        <img src={`data:image/png;base64,${ICON_BASE64}`} alt="MoodWave" />
        <span>MoodWave · AI DJ</span>
      </div>

      <div className="mw-topbar">
        <div className="mw-tabs">
          <AppButton active={page === 'radio'} disabled={busy} onClick={() => switchMode('radio')}><span className="mw-icon">◉</span>电台</AppButton>
          <AppButton active={page === 'search'} disabled={busy} onClick={() => switchMode('search')}><span className="mw-icon">⌕</span>寻歌</AppButton>
          <AppButton active={page === 'game'} disabled={busy} onClick={() => switchMode('game')}><span className="mw-icon">▣</span>游戏</AppButton>
        </div>
        <AppButton active={page === 'settings'} title="设置" disabled={busy} onClick={() => switchMode('settings')} className="is-icon">
          <span>⚙</span>
        </AppButton>
      </div>

      {page !== 'settings' && (
        <div className="mw-card mw-mini">
          <div className="mw-mini-head">
            <div className="mw-mini-title">{trackLine}</div>
            <div className="mw-mini-state">{playing ? "📻 正在陪你" : '我在等你'}</div>
          </div>
          <div className="mw-grid">
            <button
              type="button"
              className="mw-button is-transport"
              disabled={busy}
              title={playing ? '暂停' : '播放'}
              onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}
            >
              {playing ? 'Ⅱ' : '▶'}
            </button>
            <button
              type="button"
              className="mw-button is-transport"
              disabled={busy}
              title="上一首"
              onClick={() => run('上一首', () => apiRequest(apiBase, '/api/prev', {}))}
            >
              ‹
            </button>
            <button
              type="button"
              className="mw-button is-transport"
              disabled={busy}
              title="下一首"
              onClick={() => run('下一首', () => apiRequest(apiBase, '/api/next', {}))}
            >
              ›
            </button>
          </div>
          {playing ? <div className="mw-progress-bar"><div className="mw-progress-bar-fill" style={{width: `${Math.round(progressRatio * 100)}%`}} /></div> : null}
        </div>
      )}

      {page === 'radio' && (
        <div>
          <div className="mw-section-title"><span>◉</span>现在是什么感觉？</div>
          <div className="mw-card">
            <div className="mw-grid">
              {moods.map((mood) => (
                <AppButton
                  key={mood.id}
                  active={currentMood === mood.id}
                  disabled={busy}
                  onClick={() => startRadio(mood.id)}
                >
                  <span className="mw-icon">{mood.icon}</span>{mood.id}
                </AppButton>
              ))}
            </div>
          </div>
        </div>
      )}

      {page === 'search' && (
        <div>
          <div className="mw-section-title"><span>⌕</span>🎮 现在在玩什么？</div>
          <div className="mw-card">
            <div className="mw-grid two">
              {searchExamples.map((example) => (
                <AppButton
                  key={example.id}
                  active={query === example.id}
                  disabled={busy}
                  title={example.id}
                  onClick={() => setQuery(example.id)}
                >
                  <span className="mw-icon">{example.icon}</span>{example.id}
                </AppButton>
              ))}
            </div>
          </div>
          <PanelSectionRow>
            <TextField
              label="🎧 想听什么？"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            />
          </PanelSectionRow>
          <div className="mw-action-row">
            <AppButton active disabled={busy || !query.trim()} onClick={searchRadio}>▶ 开始电台</AppButton>
            <AppButton disabled={busy} onClick={nextRadio}>↻ 来点别的</AppButton>
          </div>
        </div>
      )}

      {page === 'game' && (
        <div>
          <div className="mw-section-title"><span>▣</span>现在想怎么玩？</div>
          <div className="mw-card">
            <div className="mw-grid two">
              {gameVibes.map((vibe) => (
                <AppButton
                  key={vibe.id}
                  active={gameVibe === vibe.id}
                  disabled={busy}
                  title={vibe.hint}
                  onClick={() => setGameVibe(vibe.id)}
                >
                  <span className="mw-icon">{vibe.icon}</span>{vibe.id}
                </AppButton>
              ))}
            </div>
          </div>
          <div className="mw-action-row">
            <AppButton active disabled={busy || !gameVibe} onClick={() => startGameRadio('电台启动中')}>▶ 开始电台</AppButton>
            <AppButton disabled={busy || !gameVibe} onClick={() => startGameRadio('换个感觉')}>↻ 来点别的</AppButton>
          </div>
        </div>
      )}

      {page === 'settings' && (
        <PanelSection title="设置">
          <PanelSectionRow>
            <TextField
              label="🎮 现在在玩什么？"
              value={gameName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => saveGameName(event.target.value, false)}
              onBlur={(event: ChangeEvent<HTMLInputElement>) => saveGameName(event.target.value, true)}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <TextField
              label="API Base"
              value={apiBase}
              onChange={(event: ChangeEvent<HTMLInputElement>) => saveApiBase(event.target.value)}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <AppButton disabled={busy} onClick={() => run('测试连接', refresh)}>测试连接</AppButton>
          </PanelSectionRow>
          <PanelSectionRow>
            <AppButton
              active={autoContinue}
              onClick={() => {
                const next = !autoContinue;
                setAutoContinue(next);
                localStorage.setItem(AUTO_CONTINUE_KEY, next ? '1' : '0');
              }}
            >
              {autoContinue ? '✓ ' : ''}自动续播 · 播完自动换下一组
            </AppButton>
          </PanelSectionRow>
        </PanelSection>
      )}

      {page !== 'settings' && (djLine || queue.length > 0) && (
        <div>
          <div className="mw-section-title"><span>✦</span>AI DJ</div>
          <div className="mw-card mw-card-accent">
            {djLine ? <div className="mw-dj">{djLine}</div> : null}
            {queue.map((item, index) => {
              const isCurrent = track && (item.id === track.id || item.sourceId === track.sourceId);
              return (
              <div className={`mw-song${isCurrent ? ' mw-song-active' : ''}`} key={item.id || index}>
                <div className="mw-song-title">{item.title || '未知歌曲'}</div>
                {item.artist ? <div className="mw-song-artist">{item.artist}</div> : null}
                {item.reason ? <div className="mw-song-reason">{item.reason}</div> : null}
              </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default definePlugin(() => ({
  name: 'MoodWave Deck Companion',
  titleView: <div className={staticClasses.Title} style={{ display: "flex", alignItems: "center", gap: 8 }}><img src={`data:image/png;base64,${ICON_BASE64}`} style={{ width: 20, height: 20 }} />MoodWave</div>,
  content: <Content />,
  icon: <img src={`data:image/png;base64,${ICON_BASE64}`} style={{ width: 32, height: 32 }} />
}));
