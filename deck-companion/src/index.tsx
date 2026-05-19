import { PanelSection, PanelSectionRow, TextField, staticClasses } from '@decky/ui';
import { definePlugin } from '@decky/api';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

const DEFAULT_API_BASE = 'http://127.0.0.1:38765';
const API_BASE_KEY = 'moodwave.deck.apiBase';

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
  { id: 'Boss战', icon: '⚔', hint: '燃一点，别停。' },
  { id: '探索地图', icon: '⌖', hint: '适合慢慢跑图。' },
  { id: '刷素材', icon: '◆', hint: '稳定一点，不打扰。' },
  { id: '种田放松', icon: '✧', hint: '今晚别太累了。' },
  { id: '模拟器怀旧', icon: '▣', hint: '像小时候一样。' }
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
  title
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`mw-button${active ? ' is-active' : ''}`}
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
  const [query, setQuery] = useState(searchExamples[0].id);
  const [gameVibe, setGameVibe] = useState('探索地图');
  const [gameName, setGameName] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const djRef = useRef<HTMLAudioElement>(null);

  async function refresh() {
    try {
      const payload = await apiRequest<NowPayload>(apiBase, '/api/now');
      setNow(payload);
      setStatus('在线');
    } catch {
      setStatus('离线');
    }
  }

  async function run(label: string, task: () => Promise<unknown>) {
    setBusy(true);
    setStatus(label);
    try {
      await task();
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [apiBase]);

  const track = now.now?.track || now.plan?.queue?.[0] || null;
  const playing = Boolean(now.now?.playing);
  const currentMood = (now.plan?.mood || now.now?.mood || '').trim();
  const queue = now.plan?.queue || [];
  const djLine = now.plan?.tts?.text || now.plan?.plan?.say || now.plan?.plan?.reply || '';
  const trackLine = track?.title ? `${track.title}${track.artist ? ` - ${track.artist}` : ''}` : '等待电台开播';
  const audioUrl = track ? `${normalizeBase(apiBase)}/media/audio?id=${track.sourceId || track.id || ''}` : '';
  const ttsUrl = now.plan?.tts?.url ? `${normalizeBase(apiBase)}${now.plan.tts.url}` : '';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (playing) {
      if (audio.src !== audioUrl) {
        audio.src = audioUrl;
        audio.load();
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [audioUrl, playing]);

  useEffect(() => {
    const djAudio = djRef.current;
    if (!djAudio || !ttsUrl) return;
    if (djAudio.src === ttsUrl) return;
    djAudio.src = ttsUrl;
    djAudio.load();
    if (audioRef.current) audioRef.current.volume = 0.22;
    djAudio.play().catch(() => {});
    djAudio.onended = () => {
      if (audioRef.current) audioRef.current.volume = 1;
    };
  }, [ttsUrl]);

  function saveApiBase(value: string) {
    const next = normalizeBase(value);
    setApiBase(next);
    localStorage.setItem(API_BASE_KEY, next);
  }

  async function startRadio(mood: string) {
    await run(`正在开台 · ${mood}`, async () => {
      await apiRequest(apiBase, '/api/ai/radio', { mood, mode: 'steamdeck', deferTts: true });
      await apiRequest(apiBase, '/api/play', {});
    });
  }

  async function searchRadio() {
    const prompt = query.trim();
    if (!prompt) return;
    await run('正在找歌单', async () => {
      await apiRequest(apiBase, '/api/ai/search', { query: prompt, mode: 'steamdeck', deferTts: true });
      await apiRequest(apiBase, '/api/play', {});
    });
  }

  async function nextRadio() {
    await run('正在换氛围', async () => {
      await apiRequest(apiBase, '/api/ai/next-radio', { scene: query, mode: 'steamdeck', deferTts: true });
      await apiRequest(apiBase, '/api/play', {});
    });
  }

  async function startGameRadio(label = '正在生成') {
    const vibe = gameVibes.find((item) => item.id === gameVibe);
    await run(label, async () => {
      await apiRequest(apiBase, '/api/ai/game-radio', {
        gameVibe,
        gameName: gameName.trim() || undefined,
        vibeHint: vibe?.hint || '',
        mode: 'steamdeck',
        deferTts: true
      });
      await apiRequest(apiBase, '/api/play', {});
    });
  }

  return (
    <div className="mw-root">
      <style>{`
        .mw-root {
          padding: 6px 10px 54px;
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
      <audio ref={audioRef} style={{ display: 'none' }} />
      <audio ref={djRef} style={{ display: 'none' }} />

      <div className="mw-status">
        <span>{busy ? <><span className="mw-busy-dot" />{status}</> : `${status}${currentMood ? ` · ${currentMood}` : ''}`}</span>
        <span>{playing ? '播放中' : '待机'}</span>
      </div>

      <div className="mw-topbar">
        <div className="mw-tabs">
          <AppButton active={page === 'radio'} onClick={() => setPage('radio')}><span className="mw-icon">◉</span>电台</AppButton>
          <AppButton active={page === 'search'} onClick={() => setPage('search')}><span className="mw-icon">⌕</span>寻歌</AppButton>
          <AppButton active={page === 'game'} onClick={() => setPage('game')}><span className="mw-icon">▣</span>游戏</AppButton>
        </div>
        <AppButton active={page === 'settings'} title="设置" onClick={() => setPage('settings')}>
          <span className="mw-icon">⚙</span>
        </AppButton>
      </div>

      {page !== 'settings' && (
        <div className="mw-card mw-mini">
          <div className="mw-mini-head">
            <div className="mw-mini-title">{trackLine}</div>
            <div className="mw-mini-state">{playing ? '播放中' : '待机'}</div>
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
          <div className="mw-section-title"><span>◉</span>AI Radio</div>
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
          <div className="mw-section-title"><span>⌕</span>AI 寻歌</div>
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
              label="一句话描述"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            />
          </PanelSectionRow>
          <div className="mw-action-row">
            <AppButton active disabled={busy || !query.trim()} onClick={searchRadio}>开始电台</AppButton>
            <AppButton disabled={busy} onClick={nextRadio}>换氛围</AppButton>
          </div>
        </div>
      )}

      {page === 'game' && (
        <div>
          <div className="mw-section-title"><span>▣</span>游戏电台</div>
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
            <AppButton active disabled={busy || !gameVibe} onClick={() => startGameRadio('正在生成游戏电台')}>开始</AppButton>
            <AppButton disabled={busy || !gameVibe} onClick={() => startGameRadio('正在换游戏氛围')}>换氛围</AppButton>
          </div>
        </div>
      )}

      {page === 'settings' && (
        <PanelSection title="设置">
          <PanelSectionRow>
            <TextField
              label="在玩什么"
              value={gameName}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setGameName(event.target.value)}
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
        </PanelSection>
      )}

      {page !== 'settings' && (djLine || queue.length > 0) && (
        <div>
          <div className="mw-section-title"><span>✦</span>AI DJ</div>
          <div className="mw-card">
            {djLine ? <div className="mw-dj">{djLine}</div> : null}
            {queue.slice(0, 2).map((item, index) => (
              <div className="mw-song" key={item.id || index}>
                <div className="mw-song-title">{item.title || '未知歌曲'}</div>
                {item.artist ? <div className="mw-song-artist">{item.artist}</div> : null}
              </div>
            ))}
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
