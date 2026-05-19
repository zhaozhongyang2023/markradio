import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  TextField,
  Tabs
} from '@decky/ui';
import { definePlugin } from '@decky/api';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type Track = {
  id?: string;
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
    tts?: { text?: string };
    queue?: Track[];
    plan?: { say?: string; reply?: string };
  };
};

const DEFAULT_API_BASE = 'http://127.0.0.1:38765';
const API_BASE_KEY = 'moodwave.deck.apiBase';
const moods = ['开心', '平静', '忧郁', '悲伤', '治愈', '愤怒'];
const searchExamples = ['适合 JRPG 夜晚探索', '深夜戴耳机', '小时候网吧风格', '雨天适合发呆', '像千与千寻一样'];

const GAME_VIBES = [
  { id: 'Boss战',  icon: '🗡️', vibe: '燃一点。' },
  { id: '探索地图', icon: '🗺️', vibe: '适合慢慢跑图。' },
  { id: '赛车竞速', icon: '🏎️', vibe: '今晚速度别停。' },
  { id: '种田放松', icon: '🌾', vibe: '今晚别太累了。' },
  { id: '模拟器怀旧', icon: '📺', vibe: '像小时候一样。' }
];

// ── 工具 ──
function normalizeBase(v: string) { return (v || DEFAULT_API_BASE).replace(/\/+$/, ''); }

async function apiRequest<T>(apiBase: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${normalizeBase(apiBase)}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}

// ── 共享状态 Hook ──
function useMoodWave(apiBase: string) {
  const [now, setNow] = useState<NowPayload>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('连接 MoodWave 后端');

  async function refresh() {
    const p = await apiRequest<NowPayload>(apiBase, '/api/now');
    setNow(p); setMessage('在线');
  }
  async function run(label: string, t: () => Promise<unknown>) {
    setBusy(true); setMessage(label);
    try { await t(); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : '请求失败'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    refresh().catch(() => setMessage('连接失败'));
    const h = setInterval(() => refresh().catch(() => {}), 5000);
    return () => clearInterval(h);
  }, [apiBase]);
  return { now, busy, message, run, refresh };
}

// ═══════════════════════════════════════
//  SteamOS 深色沉浸风 行内样式
// ═══════════════════════════════════════
const S = {
  // 氛围标签
  vibeWrap: { display: 'flex', gap: 8, marginTop: 6, marginBottom: 14, flexWrap: 'wrap' as const },
  vibeBtn: (active: boolean) => ({
    flex: '1 1 calc(33% - 8px)',
    minWidth: 80,
    padding: 14,
    border: active ? '1px solid #42d8b2' : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    background: active ? 'rgba(66,216,178,0.10)' : 'rgba(255,255,255,0.04)',
    color: active ? '#42d8b2' : 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 140ms ease',
    lineHeight: 1.4,
  }),
  vibeIcon: { display: 'block', fontSize: 22, marginBottom: 4 },
  vibeText: { display: 'block', fontSize: 10, opacity: 0.54, marginTop: 2, fontStyle: 'italic' as const },

  // 大按钮
  bigBtn: (disabled: boolean) => ({
    width: '100%', padding: '14px 0', marginTop: 10, marginBottom: 8,
    fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none',
    background: disabled ? 'rgba(66,216,178,0.18)' : '#42d8b2',
    color: disabled ? 'rgba(66,216,178,0.5)' : '#071510',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all 160ms ease',
  }),

  // 结果区
  resultBox: {
    marginTop: 16, padding: '14px 16px', borderRadius: 10,
    background: 'rgba(66,216,178,0.06)', border: '1px solid rgba(66,216,178,0.12)',
  },
  djIntro: { fontSize: 12, fontWeight: 600, color: '#42d8b2', marginBottom: 14, lineHeight: 1.6 },
  songItem: { padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' },
  songTitle: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.82)' },
  songArtist: { fontSize: 11, opacity: 0.56 },
  songReason: { fontSize: 10, opacity: 0.44, marginTop: 3, fontStyle: 'italic' as const },

  // 操作按钮行
  actionRow: { display: 'flex', gap: 10, marginTop: 14 },
  actionBtn: (primary: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 8,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.10)',
    background: primary ? '#42d8b2' : 'rgba(255,255,255,0.05)',
    color: primary ? '#071510' : 'rgba(255,255,255,0.68)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  }),

  // 迷你播放器（带 DJ 文案）
  miniBar: {
    marginTop: 16, padding: '10px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
  },
  miniDJ: { fontSize: 10, opacity: 0.48, marginBottom: 6 },
  miniRow: { display: 'flex', alignItems: 'center', gap: 8 },
  miniTitle: { flex: 1, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.72)', overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const },
  miniBtn: (disabled: boolean) => ({
    width: 30, height: 30, borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
    color: disabled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.70)',
    fontSize: 14, cursor: disabled ? 'default' : 'pointer',
  }),

  // 电台模式心情按钮
  moodGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  moodBtn: (active: boolean, tone: string) => ({
    flex: '1 1 calc(33% - 6px)',
    minWidth: 72,
    padding: '12px 8px',
    border: active ? `1px solid ${tone}` : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    background: active ? `${tone}18` : 'rgba(255,255,255,0.04)',
    color: active ? tone : 'rgba(255,255,255,0.66)',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 140ms ease',
  }),

  // 通用
  sectionNote: { fontSize: 11, opacity: 0.48, marginTop: 4, marginBottom: 2 },
  statusLine: { fontSize: 11, opacity: 0.54, marginTop: 6 },
};

// ═══════════════════════════════════════
//  迷你播放器（跨 Tab，带 DJ 文案）
// ═══════════════════════════════════════
function MiniPlayer({ apiBase, now, busy, run, playing }: {
  apiBase: string; now: NowPayload; busy: boolean;
  run: (l: string, t: () => Promise<unknown>) => void; playing: boolean;
}) {
  const track = now.now?.track || now.plan?.queue?.[0];
  const djLine = now.plan?.tts?.text || now.plan?.plan?.say || now.plan?.plan?.reply || '';
  if (!track?.title) return null;
  const line = track.artist ? `${track.title} - ${track.artist}` : track.title;
  return (
    <div style={S.miniBar}>
      {djLine ? <div style={S.miniDJ}>📻 {djLine}</div> : null}
      <div style={S.miniRow}>
        <span style={S.miniTitle}>{line}</span>
        <button disabled={busy} style={S.miniBtn(busy)} onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}>
          {playing ? '⏸' : '▶'}
        </button>
        <button disabled={busy} style={S.miniBtn(busy)} onClick={() => run('下一首', () => apiRequest(apiBase, '/api/next', {}))}>
          ⏭
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  🎧 AI Radio Tab
// ═══════════════════════════════════════
function RadioTab({ apiBase, now, busy, message, run }: {
  apiBase: string; now: NowPayload; busy: boolean; message: string;
  run: (l: string, t: () => Promise<unknown>) => void;
}) {
  const playing = Boolean(now.now?.playing);
  return (
    <div>
      <PanelSection title="AI Radio">
        <PanelSectionRow>
          <div style={S.statusLine}>
            {message === '在线' ? '📡 电台已连接' : message}
          </div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="今晚心情">
        <PanelSectionRow>
          <div style={S.moodGrid}>
            {moods.map((mood) => {
              const moodTone = ({ 开心: '#f0c96a', 平静: '#74d8c4', 忧郁: '#9daee8', 悲伤: '#82b5df', 治愈: '#82cf8b', 愤怒: '#ef8d62' } as Record<string,string>)[mood] || '#74d8c4';
              return (
                <button
                  key={mood}
                  disabled={busy}
                  style={S.moodBtn(false, moodTone)}
                  onClick={() => run(`按${mood}开台`, () => apiRequest(apiBase, '/api/ai/radio', { mood, mode: 'steamdeck' }))}
                >
                  {mood}
                </button>
              );
            })}
          </div>
        </PanelSectionRow>
      </PanelSection>

      <MiniPlayer apiBase={apiBase} now={now} busy={busy} run={run} playing={playing} />
    </div>
  );
}

// ═══════════════════════════════════════
//  🎮 Game Radio Tab
// ═══════════════════════════════════════
function GameRadioTab({ apiBase, now, busy, run }: {
  apiBase: string; now: NowPayload; busy: boolean;
  run: (l: string, t: () => Promise<unknown>) => void;
}) {
  const [gameVibe, setGameVibe] = useState('');
  const [gameName, setGameName] = useState('');
  const [result, setResult] = useState<{ dj_intro?: string; songs?: Track[] } | null>(null);

  async function startGameRadio() {
    if (!gameVibe) return;
    await run(`正在为${gameVibe}开台`, async () => {
      const vibeObj = GAME_VIBES.find(v => v.id === gameVibe);
      const payload = await apiRequest<{ ok: boolean; dj_intro: string; songs: Track[] }>(apiBase, '/api/ai/game-radio', {
        gameVibe,
        gameName: gameName.trim() || undefined,
        vibeHint: vibeObj?.vibe || ''
      });
      setResult(payload);
      if (payload.songs?.length) await apiRequest(apiBase, '/api/play', {});
    });
  }

  async function refreshGameVibe() {
    if (!gameVibe) return;
    setResult(null);
    await run(`正在为${gameVibe}换氛围`, async () => {
      const vibeObj = GAME_VIBES.find(v => v.id === gameVibe);
      const payload = await apiRequest<{ ok: boolean; dj_intro: string; songs: Track[] }>(apiBase, '/api/ai/game-radio', {
        gameVibe,
        gameName: gameName.trim() || undefined,
        vibeHint: vibeObj?.vibe || ''
      });
      setResult(payload);
      if (payload.songs?.length) await apiRequest(apiBase, '/api/play', {});
    });
  }

  const playing = Boolean(now.now?.playing);

  return (
    <div>
      <PanelSection title="Tonight's Game Radio">
        <PanelSectionRow>
          <div style={S.sectionNote}>✨ 让 AI 为你的游戏过程自动配乐</div>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="游戏氛围">
        <PanelSectionRow>
          <div style={S.vibeWrap}>
            {GAME_VIBES.map((vibe) => (
              <button
                key={vibe.id}
                style={S.vibeBtn(gameVibe === vibe.id)}
                onClick={() => setGameVibe(vibe.id)}
                disabled={busy}
              >
                <span style={S.vibeIcon}>{vibe.icon}</span>
                {vibe.id}
                <span style={S.vibeText}>{vibe.vibe}</span>
              </button>
            ))}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="在玩什么游戏？（可选）"
            value={gameName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGameName(e.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <button disabled={busy || !gameVibe} style={S.bigBtn(busy || !gameVibe)} onClick={startGameRadio}>
            {busy ? '…' : `▶  开始电台 · ${gameVibe || '选一个氛围'}`}
          </button>
        </PanelSectionRow>
      </PanelSection>

      {result && (
        <PanelSection title="AI DJ">
          <PanelSectionRow>
            <div style={S.resultBox}>
              {result.dj_intro ? <div style={S.djIntro}>"{result.dj_intro}"</div> : null}
              {(result.songs || []).slice(0, 3).map((song, i) => (
                <div key={song.id || i} style={S.songItem}>
                  <div style={S.songTitle}>{i + 1}. {song.title || '未知歌曲'}</div>
                  {song.artist ? <div style={S.songArtist}>{song.artist}</div> : null}
                  {song.reason ? <div style={S.songReason}>{song.reason}</div> : null}
                </div>
              ))}
            </div>
          </PanelSectionRow>
          <PanelSectionRow>
            <div style={S.actionRow}>
              <button disabled={busy} style={S.actionBtn(true)} onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}>
                {playing ? '⏸ 暂停' : '▶ 播放'}
              </button>
              <button disabled={busy} style={S.actionBtn(false)} onClick={refreshGameVibe}>↻ 换个氛围</button>
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}

      <MiniPlayer apiBase={apiBase} now={now} busy={busy} run={run} playing={playing} />
    </div>
  );
}

// ═══════════════════════════════════════
//  🔍 AI 寻歌 Tab
// ═══════════════════════════════════════
function SearchTab({ apiBase, now, busy, run, playing }: {
  apiBase: string; now: NowPayload; busy: boolean;
  run: (l: string, t: () => Promise<unknown>) => void; playing: boolean;
}) {
  const [query, setQuery] = useState(searchExamples[0]);
  const track = now.now?.track || now.plan?.queue?.[0] || {};
  const djText = now.plan?.tts?.text || now.plan?.plan?.say || now.plan?.plan?.reply || '今晚适合慢一点。';
  const currentLine = useMemo(() => {
    const t = track.title || '等待电台开始';
    const a = track.artist ? ` - ${track.artist}` : '';
    return `${t}${a}`;
  }, [track.title, track.artist]);

  return (
    <div>
      <PanelSection title="AI 寻歌">
        <PanelSectionRow>
          <div style={S.sectionNote}>告诉 AI 你现在想听什么</div>
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label="描述想要的氛围"
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <button
            disabled={busy || !query.trim()}
            style={S.bigBtn(busy || !query.trim())}
            onClick={() => run('正在找这段氛围', () => apiRequest(apiBase, '/api/ai/search', { query, mode: 'steamdeck' }))}
          >
            {busy ? '…' : '🔍  开始电台'}
          </button>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="当前播放">
        <PanelSectionRow>
          <div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{currentLine}</div>
            <div style={{ marginTop: 8, opacity: 0.68, fontSize: 11 }}>AI DJ：{djText}</div>
            {track.reason ? <div style={{ marginTop: 8, opacity: 0.54, fontSize: 10 }}>{track.reason}</div> : null}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <ButtonItem disabled={busy} onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}>
              {playing ? '暂停' : '播放'}
            </ButtonItem>
            <ButtonItem disabled={busy} onClick={() => run('下一首', () => apiRequest(apiBase, '/api/next', {}))}>
              下一首
            </ButtonItem>
          </div>
        </PanelSectionRow>
      </PanelSection>

      <MiniPlayer apiBase={apiBase} now={now} busy={busy} run={run} playing={playing} />
    </div>
  );
}

// ═══════════════════════════════════════
//  主入口
// ═══════════════════════════════════════
function Content() {
  const [apiBase, setApiBase] = useState(() => localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE);
  const [activeTab, setActiveTab] = useState('radio');
  const { now, busy, message, run } = useMoodWave(apiBase);
  const playing = Boolean(now.now?.playing);

  function saveApiBase(v: string) {
    const next = normalizeBase(v);
    setApiBase(next);
    localStorage.setItem(API_BASE_KEY, next);
  }

  return (
    <div>
      <div style={{ padding: '8px 16px 0' }}>
        <TextField
          label="API Base"
          value={apiBase}
          onChange={(e: ChangeEvent<HTMLInputElement>) => saveApiBase(e.target.value)}
        />
      </div>
      <Tabs
        activeTab={activeTab}
        onShowTab={(t: string) => setActiveTab(t)}
        tabs={[
          {
            id: 'radio',
            title: '🎧 AI Radio',
            content: <RadioTab apiBase={apiBase} now={now} busy={busy} message={message} run={run} />
          },
          {
            id: 'game',
            title: '🎮 Game Radio',
            content: <GameRadioTab apiBase={apiBase} now={now} busy={busy} run={run} />
          },
          {
            id: 'search',
            title: '🔍 AI 寻歌',
            content: <SearchTab apiBase={apiBase} now={now} busy={busy} run={run} playing={playing} />
          }
        ]}
      />
    </div>
  );
}

export default definePlugin(() => ({
  name: 'MoodWave Deck Companion',
  titleView: <div className={staticClasses.Title}>MoodWave</div>,
  content: <Content />,
  icon: <span style={{ fontWeight: 800 }}>MW</span>
}));
