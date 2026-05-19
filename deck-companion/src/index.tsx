import { PanelSection, PanelSectionRow, TextField, staticClasses } from '@decky/ui';
import { definePlugin } from '@decky/api';
import { ChangeEvent, useEffect, useState } from 'react';

const DEFAULT_API_BASE = 'http://127.0.0.1:38766';
const API_BASE_KEY = 'moodwave.deck.apiBase';
const GAME_NAME_KEY = 'moodwave.deck.gameName';

type Track = {
  id?: string;
  source?: string;
  sourceId?: string;
  title?: string;
  artist?: string;
  reason?: string;
};

type NowPayload = {
  now?: {
    track?: Track | null;
    playing?: boolean;
    mood?: string;
  };
  plan?: {
    mood?: string;
    tts?: { text?: string; url?: string };
    queue?: Track[];
    plan?: { say?: string; reply?: string };
    cardTts?: Array<{ ok?: boolean; pending?: boolean; url?: string; text?: string; deferred?: boolean }>;
  };
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
  { id: 'JRPG夜晚探索', icon: '◇' },
  { id: '深夜戴耳机', icon: '◐' },
  { id: '小时候网吧', icon: '▣' },
  { id: '雨天发呆', icon: '⌁' }
];
const gameVibes = [
  { id: 'Boss战', icon: '⚔', hint: '燃一点' },
  { id: '探索地图', icon: '⌖', hint: '适合慢慢跑图' },
  { id: '种田放松', icon: '✧', hint: '今天别太累了' },
  { id: '模拟器怀旧', icon: '▣', hint: '像小时候一样' }
];

function normalizeBase(value: string) {
  return (value || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
}

async function apiRequest<T>(apiBase: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${normalizeBase(apiBase)}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
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

function Content() {
  const [apiBase, setApiBase] = useState(() => normalizeBase(localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE));
  const [page, setPage] = useState<Page>('radio');
  const [now, setNow] = useState<NowPayload>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('连接中');
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState(searchExamples[0].id);
  const [gameVibe, setGameVibe] = useState('探索地图');
  const [gameName, setGameName] = useState(() => localStorage.getItem(GAME_NAME_KEY) || '');

  async function refresh() {
    try {
      const payload = await apiRequest<NowPayload>(apiBase, '/api/now');
      setNow(payload);
      setStatus('在线');
    } catch {
      setStatus('离线');
    }
  }

  async function switchMode(mode: Page) {
    if (mode === 'settings') { setPage('settings'); return; }
    setPage(mode);
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
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [apiBase]);

  const currentPlan = (page !== 'settings' ? now.plans?.[page] : null) || now.plan;
  const track = now.now?.track || currentPlan?.queue?.[0] || null;
  const playing = Boolean(now.now?.playing);
  const currentMood = (currentPlan?.mood || now.now?.mood || '').trim();
  const queue = currentPlan?.queue || [];
  const djLine = currentPlan?.tts?.text || currentPlan?.plan?.say || currentPlan?.plan?.reply || '';
  const trackLine = track?.title ? `${track.title}${track.artist ? ` - ${track.artist}` : ''}` : "AI DJ 准备中...";

  function saveGameName(value: string) {
    const v = String(value || "");
    setGameName(v);
    localStorage.setItem(GAME_NAME_KEY, v);
  }

  function saveApiBase(value: string) {
    const next = normalizeBase(value);
    setApiBase(next);
    localStorage.setItem(API_BASE_KEY, next);
  }

  async function startRadio(mood: string) {
    await run(`正在开台 · ${mood}`, async () => {
      await apiRequest(apiBase, '/api/ai/radio', { mood, mode: 'steamdeck', deferTts: true });
    });
  }

  async function searchRadio() {
    const prompt = query.trim();
    if (!prompt) return;
    await run('正在找歌单', async () => {
      await apiRequest(apiBase, '/api/ai/search', { query: prompt, mode: 'steamdeck', deferTts: true });
    });
  }

  async function nextRadio() {
    await run('正在换氛围', async () => {
      await apiRequest(apiBase, '/api/ai/next-radio', { scene: query, mode: 'steamdeck', deferTts: true });
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
        deferTts: true
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
        .mw-mini-state {
          flex: 0 0 auto;
          color: rgba(66,216,178,.86);
          font-size: 9.5px;
          font-weight: 800;
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

      <div className="mw-status">
        <span>{progress > 0 ? <div className="mw-progress" style={{width: `${progress}%`}} /> : null}{busy ? <><span style={{fontSize:10,opacity:.6,marginRight:6}}>{progress}%</span><span className="mw-busy-dot" /><><span>{status}</span><span className="mw-busy-ellipsis"><i /><i /><i /></span></></> : `${status}${currentMood ? ` · ${currentMood}` : ''}`}</span>
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
              onChange={(event: ChangeEvent<HTMLInputElement>) => saveGameName(event.target.value)}
              onBlur={(event: ChangeEvent<HTMLInputElement>) => saveGameName(event.target.value)}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <TextField
              label="API Base"
              value={apiBase}
              onChange={(event: ChangeEvent<HTMLInputElement>) => saveApiBase(event.target.value)}
              onBlur={(event: ChangeEvent<HTMLInputElement>) => saveApiBase(event.target.value)}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <AppButton disabled={busy} onClick={() => run('测试连接', refresh)}>测试连接</AppButton>
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
    </div>
  );
}

export default definePlugin(() => ({
  name: 'MoodWave Deck Companion',
  titleView: <div className={staticClasses.Title}>MoodWave</div>,
  content: <Content />,
  icon: <span style={{ fontWeight: 800 }}>MW</span>
}));
