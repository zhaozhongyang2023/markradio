import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  TextField
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
//  样式常量
// ═══════════════════════════════════════
const S = {
  // Tab 切换栏
  tabBar: { display: 'flex', gap: 4, padding: '8px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tabBtn: (active: boolean) => ({
    flex: 1, padding: '10px 0', border: 'none', borderRadius: '8px 8px 0 0',
    background: active ? 'rgba(66,216,178,0.12)' : 'transparent',
    color: active ? '#42d8b2' : 'rgba(255,255,255,0.45)',
    fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
    borderBottom: active ? '2px solid #42d8b2' : '2px solid transparent',
    transition: 'all 140ms ease',
  }),

  vibeWrap: { display: 'flex', gap: 6, marginTop: 6, marginBottom: 12, flexWrap: 'wrap' as const },
  vibeBtn: (active: boolean) => ({
    flex: '1 1 calc(33% - 6px)', minWidth: 72, padding: 12,
    border: active ? '1px solid #42d8b2' : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, background: active ? 'rgba(66,216,178,0.10)' : 'rgba(255,255,255,0.04)',
    color: active ? '#42d8b2' : 'rgba(255,255,255,0.68)',
    fontSize: 11, fontWeight: active ? 700 : 500, textAlign: 'center' as const,
    cursor: 'pointer', transition: 'all 140ms ease', lineHeight: 1.4,
  }),
  vibeIcon: { display: 'block', fontSize: 20, marginBottom: 3 },
  vibeText: { display: 'block', fontSize: 9, opacity: 0.5, marginTop: 2, fontStyle: 'italic' as const },

  bigBtn: (disabled: boolean) => ({
    width: '100%', padding: '12px 0', marginTop: 8, marginBottom: 8,
    fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none',
    background: disabled ? 'rgba(66,216,178,0.15)' : '#42d8b2',
    color: disabled ? 'rgba(66,216,178,0.4)' : '#071510',
    cursor: disabled ? 'default' : 'pointer', transition: 'all 160ms ease',
  }),

  resultBox: {
    marginTop: 14, padding: '12px 14px', borderRadius: 10,
    background: 'rgba(66,216,178,0.05)', border: '1px solid rgba(66,216,178,0.10)',
  },
  djIntro: { fontSize: 12, fontWeight: 600, color: '#42d8b2', marginBottom: 12, lineHeight: 1.6 },
  songItem: { padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.05)' },
  songTitle: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' },
  songArtist: { fontSize: 11, opacity: 0.52 },
  songReason: { fontSize: 10, opacity: 0.42, marginTop: 3, fontStyle: 'italic' as const },

  actionRow: { display: 'flex', gap: 8, marginTop: 12 },
  actionBtn: (primary: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 8,
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.10)',
    background: primary ? '#42d8b2' : 'rgba(255,255,255,0.05)',
    color: primary ? '#071510' : 'rgba(255,255,255,0.64)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 140ms ease',
  }),

  sectionNote: { fontSize: 10, opacity: 0.5, lineHeight: 1.5 },
  statusStrip: { fontSize: 10, opacity: 0.45, textAlign: 'center' as const, marginTop: 6 },

  miniPlayer: {
    marginTop: 14, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  miniTrack: { fontSize: 11, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  miniBtn: { padding: '6px 10px', fontSize: 11, marginLeft: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' },
};

// ═══════════════════════════════════════
//  迷你播放器（跨 Tab 共享）
// ═══════════════════════════════════════
function MiniPlayer({ apiBase, now, busy, run, playing }: {
  apiBase: string; now: NowPayload; busy: boolean;
  run: (l: string, t: () => Promise<unknown>) => void; playing: boolean;
}) {
  const track = now.now?.track || now.plan?.queue?.[0] || {};
  const line = track.title ? `${track.title} - ${track.artist || ''}` : '等待电台开始';
  return (
    <div style={S.miniPlayer}>
      <div style={S.miniTrack}>{line}</div>
      <button style={S.miniBtn} disabled={busy} onClick={() => run(playing ? '暂停' : '播放', () => apiRequest(apiBase, playing ? '/api/pause' : '/api/play', {}))}>
        {playing ? '⏸' : '▶'}
      </button>
      <button style={S.miniBtn} disabled={busy} onClick={() => run('下一首', () => apiRequest(apiBase, '/api/next', {}))}>
        ⏭
      </button>
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
  const planMood = (now.plan?.mood || '').trim();
  const [selectedMood, setSelectedMood] = useState(planMood || moods[0]);
  const queue = now.plan?.queue || [];
  const djText = now.plan?.tts?.text || now.plan?.plan?.say || now.plan?.plan?.reply || '今晚适合慢一点。';

  useEffect(() => { if (planMood && planMood !== selectedMood) setSelectedMood(planMood); }, [planMood]);

  async function refreshPlan(mood: string, muteMsg?: boolean) {
    await apiRequest(apiBase, '/api/ai/radio', { mood, mode: 'steamdeck', deferTts: true });
    if (!muteMsg) { /* message handled by useMoodWave */ }
  }

  return (
    <div>
      <PanelSection title="AI 电台">
        <PanelSectionRow>
          <div style={S.sectionNote}>
            {busy ? message : (now.plan ? `今日心情：${planMood || '未知'}` : message)}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={S.vibeWrap}>
            {moods.map(m => (
              <button key={m} style={S.vibeBtn(m === selectedMood)} disabled={busy} onClick={() => { setSelectedMood(m); refreshPlan(m, true); }}>
                {m}
              </button>
            ))}
          </div>
        </PanelSectionRow>
      </PanelSection>

      {queue.length > 0 && (
        <PanelSection title="AI DJ 推荐">
          <PanelSectionRow>
            <div style={S.resultBox}>
              <div style={S.djIntro}>AI DJ：{djText}</div>
              {queue.slice(0, 3).map((t, i) => (
                <div key={t.id || i} style={S.songItem}>
                  <div style={S.songTitle}>{t.title}</div>
                  <div style={S.songArtist}>{t.artist}</div>
                  {t.reason && <div style={S.songReason}>{t.reason}</div>}
                </div>
              ))}
            </div>
          </PanelSectionRow>
          <PanelSectionRow>
            <div style={S.actionRow}>
              <button style={S.actionBtn(true)} disabled={busy} onClick={() => run('▶ 全部播放', () => apiRequest(apiBase, '/api/play', {}))}>▶ 播放</button>
              <button style={S.actionBtn(false)} disabled={busy} onClick={() => run('换个心情', () => refreshPlan(selectedMood, false))}>↻ 换心情</button>
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}
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
  const queue = now.plan?.queue || [];
  const djText = now.plan?.tts?.text || now.plan?.plan?.say || '';
  const showResult = queue.length > 0 && now.plan?.mood;

  async function callGameRadio() {
    await apiRequest(apiBase, '/api/ai/game-radio', {
      gameVibe: gameVibe || '探索地图',
      gameName: gameName || undefined,
      mode: 'steamdeck',
      deferTts: true
    });
  }
  async function refreshGameVibe() {
    if (gameVibe) await callGameRadio();
  }

  return (
    <div>
      <PanelSection title="🎮 Tonight's Game Radio">
        <PanelSectionRow>
          <div style={S.sectionNote}>选氛围，AI 自动配 BGM</div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={S.vibeWrap}>
            {GAME_VIBES.map(v => (
              <button key={v.id} style={S.vibeBtn(gameVibe === v.id)} disabled={busy} onClick={() => setGameVibe(v.id)}>
                <span style={S.vibeIcon}>{v.icon}</span>
                {v.id}
                <span style={S.vibeText}>{v.vibe}</span>
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
          <button disabled={busy || !gameVibe} style={S.bigBtn(busy || !gameVibe)} onClick={() => run('游戏电台启动中', callGameRadio)}>
            {busy ? '…' : '▶ 开始游戏电台'}
          </button>
        </PanelSectionRow>
      </PanelSection>

      {showResult && (
        <PanelSection title="AI DJ 推荐">
          <PanelSectionRow>
            <div style={S.resultBox}>
              {djText && <div style={S.djIntro}>AI DJ：{djText}</div>}
              {queue.slice(0, 3).map((t, i) => (
                <div key={t.id || i} style={S.songItem}>
                  <div style={S.songTitle}>{t.title}</div>
                  <div style={S.songArtist}>{t.artist}</div>
                  {t.reason && <div style={S.songReason}>{t.reason}</div>}
                </div>
              ))}
            </div>
          </PanelSectionRow>
          <PanelSectionRow>
            <div style={S.actionRow}>
              <button style={S.actionBtn(true)} disabled={busy} onClick={() => run('▶ 播放', () => apiRequest(apiBase, '/api/play', {}))}>▶ 播放</button>
              <button style={S.actionBtn(false)} disabled={busy} onClick={refreshGameVibe}>↻ 换个氛围</button>
            </div>
          </PanelSectionRow>
        </PanelSection>
      )}
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
    </div>
  );
}

// ═══════════════════════════════════════
//  主入口（自定义 Tab 栏，不用 Decky Tabs）
// ═══════════════════════════════════════
function Content() {
  const [apiBase, setApiBase] = useState(() => {
    try { return localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE; }
    catch { return DEFAULT_API_BASE; }
  });
  const [activeTab, setActiveTab] = useState('radio');
  const { now, busy, message, run } = useMoodWave(apiBase);
  const playing = Boolean(now.now?.playing);

  function saveApiBase(v: string) {
    const next = normalizeBase(v);
    setApiBase(next);
    try { localStorage.setItem(API_BASE_KEY, next); } catch {}
  }

  const tabs = [
    { id: 'radio', title: '🎧 AI Radio' },
    { id: 'game', title: '🎮 Game Radio' },
    { id: 'search', title: '🔍 AI 寻歌' },
  ];

  return (
    <div>
      <div style={{ padding: '8px 16px 0' }}>
        <TextField
          label="API Base"
          value={apiBase}
          onChange={(e: ChangeEvent<HTMLInputElement>) => saveApiBase(e.target.value)}
        />
      </div>

      {/* 自定义 Tab 栏 */}
      <div style={S.tabBar}>
        {tabs.map(t => (
          <button key={t.id} style={S.tabBtn(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.title}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div style={{ display: activeTab === 'radio' ? 'block' : 'none' }}>
        <RadioTab apiBase={apiBase} now={now} busy={busy} message={message} run={run} />
      </div>
      <div style={{ display: activeTab === 'game' ? 'block' : 'none' }}>
        <GameRadioTab apiBase={apiBase} now={now} busy={busy} run={run} />
      </div>
      <div style={{ display: activeTab === 'search' ? 'block' : 'none' }}>
        <SearchTab apiBase={apiBase} now={now} busy={busy} run={run} playing={playing} />
      </div>

      <MiniPlayer apiBase={apiBase} now={now} busy={busy} run={run} playing={playing} />
    </div>
  );
}

export default definePlugin(() => ({
  name: 'MoodWave Deck Companion',
  titleView: <div className={staticClasses.Title}>MoodWave</div>,
  content: <Content />,
  icon: <span style={{ fontWeight: 800 }}>MW</span>
}));
